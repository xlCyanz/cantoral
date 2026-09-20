use rusqlite::Connection;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::db::{self, Db};
use crate::models::{DuplicateGroup, Folder, Playlist, Track};
use crate::scanner::{self, ScanSlot};

/// Everything the frontend needs to hydrate its store.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub tracks: Vec<Track>,
    pub folders: Vec<Folder>,
    pub playlists: Vec<Playlist>,
}

fn snapshot(conn: &Connection) -> anyhow::Result<Snapshot> {
    Ok(Snapshot {
        tracks: db::list_tracks(conn)?,
        folders: db::list_folders(conn)?,
        playlists: db::list_playlists(conn)?,
    })
}

/// What the duplicates view needs in one round trip.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateReport {
    pub groups: Vec<DuplicateGroup>,
    /// Groups the user has waved off. Carried so the view can offer them back
    /// instead of the dismissal being a one-way door.
    pub dismissed: i64,
}

fn duplicate_report(conn: &Connection) -> anyhow::Result<DuplicateReport> {
    Ok(DuplicateReport {
        groups: db::duplicate_groups(conn)?,
        dismissed: db::dismissed_count(conn)?,
    })
}

/// Location of the live database. Scans open their own connection from it so
/// they never hold the mutex the UI's own commands need.
pub struct DbPath(pub std::path::PathBuf);


type CmdResult<T> = Result<T, String>;

/// Convert an error for the frontend, recording it in the log file on the way
/// out so failures are diagnosable after the fact.
fn e<E: std::fmt::Display>(err: E) -> String {
    let msg = err.to_string();
    log::error!("{msg}");
    msg
}

#[tauri::command]
pub fn get_library(db: State<Db>) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(e)?;
    snapshot(&conn).map_err(e)
}

/// Run a scan on its own connection, so the main mutex is held only for the
/// short setup and snapshot steps rather than for the whole walk.
fn run_scan(
    app: &AppHandle,
    db_path: &std::path::Path,
    slot: &ScanSlot,
    folder_id: i64,
    path: &str,
    recursive: bool,
) -> CmdResult<()> {
    // One scan at a time. The claim is released when it goes out of scope at
    // the end of this function, whichever way the scan ends.
    let claim = slot.claim().ok_or_else(|| {
        "Ya hay un escaneo en curso. Espera a que termine, o cancélalo, antes de empezar otro."
            .to_string()
    })?;
    let cover_dir = app.path().app_data_dir().map_err(e)?.join("covers");
    let scan_conn = db::open_secondary(db_path).map_err(e)?;
    log::info!("scan start: {path} (recursive={recursive})");
    let started = std::time::Instant::now();
    let count = scanner::scan_folder(
        &scan_conn,
        folder_id,
        path,
        &cover_dir,
        recursive,
        claim.cancel_flag(),
        &|p| {
            let _ = app.emit("scan-progress", p);
        },
    )
    .map_err(e)?;
    log::info!("scan done: {count} files in {:?}", started.elapsed());
    Ok(())
}

#[tauri::command]
pub fn add_and_scan_folder(
    app: AppHandle,
    db: State<Db>,
    db_path: State<DbPath>,
    slot: State<ScanSlot>,
    path: String,
    recursive: bool,
) -> CmdResult<Snapshot> {
    // Whether the folder was already indexed decides what happens if the scan
    // fails below: a re-scan keeps its folder, a first scan must not leave one.
    let (fid, ya_estaba) = {
        let conn = db.0.lock().map_err(e)?;
        if let Some(other) = db::overlapping_folder(&conn, &path).map_err(e)? {
            return Err(format!(
                "«{}» se cruza con la carpeta ya indexada «{}». Quita una de las dos o elige otra ubicación.",
                path, other
            ));
        }
        let ya_estaba = db::folder_id_by_path(&conn, &path).map_err(e)?.is_some();
        let nombre = std::path::Path::new(&path)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(path.as_str())
            .to_string();
        (
            db::add_folder(&conn, &path, &nombre, recursive).map_err(e)?,
            ya_estaba,
        )
    };

    if let Err(err) = run_scan(&app, &db_path.0, &slot, fid, &path, recursive) {
        // The row went in before the walk started, so a scan that fails — an
        // unplugged drive, a folder that cannot be read — used to leave a
        // folder with zero tracks sitting in Configuración for the user to
        // clean up by hand.
        if !ya_estaba {
            let conn = db.0.lock().map_err(e)?;
            if let Err(limpieza) = db::remove_folder(&conn, fid) {
                log::error!("could not drop the folder left by a failed scan: {limpieza}");
            }
        }
        return Err(err);
    }

    let conn = db.0.lock().map_err(e)?;
    snapshot(&conn).map_err(e)
}

#[tauri::command]
pub fn rescan_folder(
    app: AppHandle,
    db: State<Db>,
    db_path: State<DbPath>,
    slot: State<ScanSlot>,
    id: String,
) -> CmdResult<Snapshot> {
    let fid = id.parse::<i64>().map_err(e)?;
    // Re-use the «include subfolders» choice made when the folder was added.
    let (path, recursive) = {
        let conn = db.0.lock().map_err(e)?;
        db::folder_scan_target(&conn, fid).map_err(e)?
    };

    run_scan(&app, &db_path.0, &slot, fid, &path, recursive)?;

    let conn = db.0.lock().map_err(e)?;
    snapshot(&conn).map_err(e)
}

/// Ask the running scan to stop after the file it is on.
///
/// Reaches only the scan that is running right now: a cancel with nothing in
/// flight does nothing at all, rather than leaving a flag raised for whatever
/// scan comes next.
#[tauri::command]
pub fn cancel_scan(slot: State<ScanSlot>) -> CmdResult<()> {
    slot.cancel();
    Ok(())
}

/// Tracks that look like the same song, grouped.
#[tauri::command]
pub fn find_duplicates(db: State<Db>) -> CmdResult<DuplicateReport> {
    let conn = db.0.lock().map_err(e)?;
    duplicate_report(&conn).map_err(e)
}

/// Fold the copies into the one the user chose to keep.
#[tauri::command]
pub fn merge_duplicates(db: State<Db>, keep: String, drop: Vec<String>) -> CmdResult<Snapshot> {
    let keep_id = keep.parse::<i64>().map_err(e)?;
    let drop_ids = drop
        .iter()
        .map(|d| d.parse::<i64>())
        .collect::<std::result::Result<Vec<i64>, _>>()
        .map_err(e)?;
    let conn = db.0.lock().map_err(e)?;
    db::merge_tracks(&conn, keep_id, &drop_ids).map_err(e)?;
    log::info!("merged {} copies into track {keep}", drop_ids.len());
    snapshot(&conn).map_err(e)
}

/// Remember that a group is not duplicates after all.
#[tauri::command]
pub fn dismiss_duplicates(db: State<Db>, signature: String) -> CmdResult<DuplicateReport> {
    let conn = db.0.lock().map_err(e)?;
    db::dismiss_duplicates(&conn, &signature).map_err(e)?;
    duplicate_report(&conn).map_err(e)
}

/// Offer every dismissed group again.
#[tauri::command]
pub fn restore_dismissed_duplicates(db: State<Db>) -> CmdResult<DuplicateReport> {
    let conn = db.0.lock().map_err(e)?;
    db::clear_duplicate_dismissals(&conn).map_err(e)?;
    duplicate_report(&conn).map_err(e)
}

/// Re-check every indexed file on disk. Called after startup so tracks deleted
/// while the app was closed show up as missing without a full rescan.
#[tauri::command]
pub fn reconcile_library(db: State<Db>) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(e)?;
    db::reconcile_all(&conn).map_err(e)?;
    snapshot(&conn).map_err(e)
}

#[tauri::command]
pub fn remove_folder(db: State<Db>, id: String) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(e)?;
    db::remove_folder(&conn, id.parse::<i64>().map_err(e)?).map_err(e)?;
    snapshot(&conn).map_err(e)
}

/// Point a track at the file's new location, keeping its tags and favourite.
#[tauri::command]
pub fn relocate_track(db: State<Db>, id: String, path: String) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(e)?;
    db::relocate_track(&conn, id.parse::<i64>().map_err(e)?, std::path::Path::new(&path))
        .map_err(e)?;
    log::info!("track {id} relocated to {path}");
    snapshot(&conn).map_err(e)
}

/// Remove one track from the catalogue. The audio file itself is never touched.
#[tauri::command]
pub fn delete_track(db: State<Db>, id: String) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(e)?;
    db::delete_track(&conn, id.parse::<i64>().map_err(e)?).map_err(e)?;
    snapshot(&conn).map_err(e)
}

/// Point a whole indexed folder at its new location, rewriting every track under
/// it. For the case that actually happens: the music moved to another drive.
#[tauri::command]
pub fn relocate_folder(db: State<Db>, id: String, path: String) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(e)?;
    let n = db::relocate_folder(&conn, id.parse::<i64>().map_err(e)?, std::path::Path::new(&path))
        .map_err(e)?;
    log::info!("folder {id} relocated to {path} ({n} tracks rewritten)");
    snapshot(&conn).map_err(e)
}

#[tauri::command]
pub fn set_track_fav(db: State<Db>, id: String, fav: bool) -> CmdResult<()> {
    let conn = db.0.lock().map_err(e)?;
    db::set_fav(&conn, id.parse::<i64>().map_err(e)?, fav).map_err(e)
}

#[tauri::command]
pub fn update_track(
    db: State<Db>,
    id: String,
    tono: String,
    bpm: i64,
    ocasion: String,
    tags: Vec<String>,
) -> CmdResult<()> {
    let conn = db.0.lock().map_err(e)?;
    let tid = id.parse::<i64>().map_err(e)?;
    db::update_track_meta(&conn, tid, &tono, bpm, &ocasion).map_err(e)?;
    db::set_track_tags(&conn, tid, &tags).map_err(e)?;
    Ok(())
}

#[tauri::command]
pub fn create_playlist(
    db: State<Db>,
    nombre: String,
    fecha: String,
    ocasion: String,
) -> CmdResult<String> {
    let conn = db.0.lock().map_err(e)?;
    let id = db::create_playlist(&conn, &nombre, &fecha, &ocasion).map_err(e)?;
    Ok(id.to_string())
}

#[tauri::command]
pub fn set_playlist_order(db: State<Db>, playlist: String, ids: Vec<String>) -> CmdResult<()> {
    let conn = db.0.lock().map_err(e)?;
    let pid = playlist.parse::<i64>().map_err(e)?;
    let numeric: Vec<i64> = ids.iter().filter_map(|s| s.parse::<i64>().ok()).collect();
    db::set_playlist_order(&conn, pid, &numeric).map_err(e)
}

#[tauri::command]
pub fn add_to_playlist(db: State<Db>, playlist: String, track: String) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(e)?;
    db::add_to_playlist(&conn, playlist.parse::<i64>().map_err(e)?, track.parse::<i64>().map_err(e)?)
        .map_err(e)?;
    snapshot(&conn).map_err(e)
}

#[tauri::command]
pub fn update_playlist(
    db: State<Db>,
    playlist: String,
    nombre: String,
    fecha: String,
    ocasion: String,
) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(e)?;
    db::update_playlist(&conn, playlist.parse::<i64>().map_err(e)?, &nombre, &fecha, &ocasion)
        .map_err(e)?;
    snapshot(&conn).map_err(e)
}

/// Write a printable playlist sheet. The frontend renders the HTML; this only
/// puts it on disk. Restricted to .html/.htm so the command cannot be used as a
/// general-purpose write-anything primitive.
#[tauri::command]
pub fn export_playlist(dest: String, html: String) -> CmdResult<()> {
    let ext = std::path::Path::new(&dest)
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    if ext != "html" && ext != "htm" {
        return Err("El archivo exportado debe terminar en .html".into());
    }
    std::fs::write(&dest, html.as_bytes()).map_err(e)
}

#[tauri::command]
pub fn delete_playlist(db: State<Db>, playlist: String) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(e)?;
    db::delete_playlist(&conn, playlist.parse::<i64>().map_err(e)?).map_err(e)?;
    snapshot(&conn).map_err(e)
}

/// Read a candidate backup without touching it, so the confirmation dialog can
/// say what the user is about to replace their library with.
#[tauri::command]
pub fn inspect_backup(src: String) -> CmdResult<db::BackupInfo> {
    db::inspect_backup(std::path::Path::new(&src)).map_err(e)
}

/// Replace the live database with a backup file, then return the fresh snapshot.
///
/// Nothing on disk is touched until the backup has been read and confirmed to be
/// a Cantoral database, and the previous file is moved aside rather than deleted,
/// so a restore that fails half way leaves the library exactly as it was.
#[tauri::command]
pub fn restore_database(
    db: State<Db>,
    db_path: State<DbPath>,
    src: String,
) -> CmdResult<Snapshot> {
    let live = db_path.0.as_path();
    let src = std::path::Path::new(&src);

    // Validated first, while the live connection is still open: a file picked by
    // mistake is rejected without the app having given anything up.
    db::inspect_backup(src).map_err(e)?;

    // Fold the WAL back into the main file and release it, so the restore can
    // move it aside (an open handle makes that fail on Windows).
    {
        let mut guard = db.0.lock().map_err(e)?;
        let _ = guard.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
        *guard = rusqlite::Connection::open_in_memory().map_err(e)?;
    }

    match db::restore_from_backup(live, src) {
        Ok(conn) => {
            let snap = snapshot(&conn).map_err(e)?;
            *db.0.lock().map_err(e)? = conn;
            log::info!("database restored from {}", src.display());
            Ok(snap)
        }
        Err(err) => {
            // `restore_from_backup` already put the previous database back; all
            // that is left is to reopen it, so the app stays usable.
            match db::open_and_migrate(live) {
                Ok(conn) => *db.0.lock().map_err(e)? = conn,
                Err(reopen) => log::error!("could not reopen the database after a failed restore: {reopen}"),
            }
            Err(e(err))
        }
    }
}

#[tauri::command]
pub fn get_setting(db: State<Db>, key: String) -> CmdResult<Option<String>> {
    let conn = db.0.lock().map_err(e)?;
    db::get_setting(&conn, &key).map_err(e)
}

#[tauri::command]
pub fn set_setting(db: State<Db>, key: String, value: String) -> CmdResult<()> {
    let conn = db.0.lock().map_err(e)?;
    db::set_setting(&conn, &key, &value).map_err(e)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbInfo {
    pub path: String,
    pub size: u64,
}

/// Real location and size of the local database file.
#[tauri::command]
pub fn get_db_info(db_path: State<DbPath>) -> CmdResult<DbInfo> {
    let path = db_path.0.as_path();
    let size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    Ok(DbInfo { path: path.to_string_lossy().to_string(), size })
}

/// Copy the database to `dest`. The WAL is first checkpointed into the main file
/// so the copy is complete — a plain copy alone would miss data still in the WAL.
#[tauri::command]
pub fn backup_database(db: State<Db>, db_path: State<DbPath>, dest: String) -> CmdResult<()> {
    let src = db_path.0.as_path();
    {
        let conn = db.0.lock().map_err(e)?;
        let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
    }
    std::fs::copy(src, &dest).map_err(e)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::export_playlist;

    fn tmp(name: &str) -> String {
        std::env::temp_dir().join(name).to_string_lossy().to_string()
    }

    #[test]
    fn export_writes_the_sheet_verbatim() {
        let dest = tmp("cantoral-export-test.html");
        let _ = std::fs::remove_file(&dest);

        export_playlist(dest.clone(), "<h1>Culto</h1>".into()).unwrap();

        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "<h1>Culto</h1>");
        let _ = std::fs::remove_file(&dest);
    }

    #[test]
    fn export_refuses_anything_that_is_not_html() {
        // The command must not double as a write-anything primitive.
        for bad in ["cantoral-export-test.db", "cantoral-export-test.sh", "cantoral-export-test"] {
            let dest = tmp(bad);
            let _ = std::fs::remove_file(&dest);
            assert!(export_playlist(dest.clone(), "x".into()).is_err(), "{bad} should be refused");
            assert!(!std::path::Path::new(&dest).exists(), "{bad} must not be created");
        }
    }

    #[test]
    fn export_accepts_either_html_spelling_and_ignores_case() {
        for ok in ["cantoral-export-test.htm", "cantoral-export-test.HTML"] {
            let dest = tmp(ok);
            let _ = std::fs::remove_file(&dest);
            assert!(export_playlist(dest.clone(), "x".into()).is_ok(), "{ok} should be accepted");
            let _ = std::fs::remove_file(&dest);
        }
    }
}
