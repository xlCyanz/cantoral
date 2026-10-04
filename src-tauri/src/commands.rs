use rusqlite::Connection;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::compartir;
use crate::copias::{self, Motivo};
use crate::db::{self, Db};
use crate::models::{DuplicateGroup, Folder, LyricHit, Playlist, Sheet, Track};
use crate::scanner::{self, ScanClaim, ScanSlot, Tarea};

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

/// Run a long piece of work on a blocking thread of the async runtime.
///
/// A command without `async` runs on the main thread — the one the native
/// event loop and every other IPC request go through — so a scan walked there
/// froze the window until it finished: «Cancelar» went unanswered and the live
/// refresh queued up behind it (#123). The work here gets the state it needs
/// from `app` rather than from `State<…>`, which borrows the request and cannot
/// travel to another thread.
async fn fuera_del_hilo_principal<T, F>(app: AppHandle, trabajo: F) -> CmdResult<T>
where
    T: Send + 'static,
    F: FnOnce(&AppHandle) -> CmdResult<T> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || trabajo(&app)).await.map_err(e)?
}

// Every other command that takes the main mutex is `#[tauri::command(async)]`.
// They are short, but one run on the main thread while a long command holds the
// mutex would wait for it there — and freeze the window exactly as the long
// command itself used to.

#[tauri::command(async)]
pub fn get_library(db: State<Db>) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(e)?;
    snapshot(&conn).map_err(e)
}

/// Every culto list with its order, and nothing else.
///
/// What a change to the lists answers with. It used to be the whole snapshot,
/// so adding one track to a culto sent back every track of the library (#136).
#[tauri::command(async)]
pub fn get_playlists(db: State<Db>) -> CmdResult<Vec<Playlist>> {
    let conn = db.0.lock().map_err(e)?;
    db::list_playlists(&conn).map_err(e)
}

/// What a running scan has indexed since the track `after`, plus the folders.
///
/// The live refresh asks for this every couple of seconds; the folders ride
/// along because their counts are what the sidebar shows growing.
#[derive(Serialize)]
pub struct Novedades {
    pub tracks: Vec<Track>,
    pub folders: Vec<Folder>,
}

#[tauri::command(async)]
pub fn get_tracks_since(db: State<Db>, after: String) -> CmdResult<Novedades> {
    let after = after.parse::<i64>().map_err(e)?;
    let conn = db.0.lock().map_err(e)?;
    Ok(Novedades {
        tracks: db::list_tracks_since(&conn, after).map_err(e)?,
        folders: db::list_folders(&conn).map_err(e)?,
    })
}

/// Take the scan slot for `tarea`, or explain to the user what holds it.
///
/// One task at a time among scans, restores and the folder changes a scan
/// would trip over (#127). The core is where the rule lives: the buttons are
/// disabled too, but anything reaching the command by IPC gets the same answer.
fn tomar(slot: &ScanSlot, tarea: Tarea) -> CmdResult<ScanClaim<'_>> {
    slot.tomar(tarea).map_err(|ocupante| scanner::mensaje_ocupado(ocupante, tarea))
}

/// Run a scan on its own connection, so the main mutex is held only for the
/// short setup and snapshot steps rather than for the whole walk.
///
/// Takes the claim by value: it is released when it goes out of scope at the
/// end of this function, whichever way the scan ends.
fn run_scan(
    app: &AppHandle,
    db_path: &std::path::Path,
    claim: ScanClaim<'_>,
    folder_id: i64,
    path: &str,
    recursive: bool,
) -> CmdResult<()> {
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
pub async fn add_and_scan_folder(
    app: AppHandle,
    path: String,
    recursive: bool,
) -> CmdResult<Snapshot> {
    fuera_del_hilo_principal(app, move |app| add_and_scan_folder_bloqueante(app, path, recursive))
        .await
}

fn add_and_scan_folder_bloqueante(
    app: &AppHandle,
    path: String,
    recursive: bool,
) -> CmdResult<Snapshot> {
    let db = app.state::<Db>();
    let db_path = app.state::<DbPath>();
    let slot = app.state::<ScanSlot>();
    // Taken before the folder row goes in, so nothing can remove or move the
    // folder between adding it and walking it.
    let claim = tomar(&slot, Tarea::Escaneo)?;
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
        (db::add_folder(&conn, &path, &nombre, recursive).map_err(e)?, ya_estaba)
    };

    permitir_asset(app, &path);

    if let Err(err) = run_scan(app, &db_path.0, claim, fid, &path, recursive) {
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
pub async fn rescan_folder(app: AppHandle, id: String) -> CmdResult<Snapshot> {
    fuera_del_hilo_principal(app, move |app| rescan_folder_bloqueante(app, id)).await
}

fn rescan_folder_bloqueante(app: &AppHandle, id: String) -> CmdResult<Snapshot> {
    let db = app.state::<Db>();
    let db_path = app.state::<DbPath>();
    let slot = app.state::<ScanSlot>();
    let fid = id.parse::<i64>().map_err(e)?;
    let claim = tomar(&slot, Tarea::Escaneo)?;
    // Re-use the «include subfolders» choice made when the folder was added.
    let (path, recursive) = {
        let conn = db.0.lock().map_err(e)?;
        db::folder_scan_target(&conn, fid).map_err(e)?
    };

    run_scan(app, &db_path.0, claim, fid, &path, recursive)?;

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
///
/// Read on a connection of its own, like a scan: grouping a big library takes
/// a while, and the main mutex held all that time would stall every other
/// command waiting on it.
#[tauri::command]
pub async fn find_duplicates(app: AppHandle) -> CmdResult<DuplicateReport> {
    fuera_del_hilo_principal(app, |app| {
        let conn = db::open_secondary(&app.state::<DbPath>().0).map_err(e)?;
        duplicate_report(&conn).map_err(e)
    })
    .await
}

/// Fold the copies into the one the user chose to keep.
#[tauri::command(async)]
pub fn merge_duplicates(
    db: State<Db>,
    db_path: State<DbPath>,
    keep: String,
    drop: Vec<String>,
) -> CmdResult<Snapshot> {
    let keep_id = keep.parse::<i64>().map_err(e)?;
    let drop_ids = drop
        .iter()
        .map(|d| d.parse::<i64>())
        .collect::<std::result::Result<Vec<i64>, _>>()
        .map_err(e)?;
    let conn = db.0.lock().map_err(e)?;
    fusionar(&conn, &copias::carpeta(&db_path.0), keep_id, &drop_ids).map_err(e)?;
    log::info!("merged {} copies into track {keep}", drop_ids.len());
    snapshot(&conn).map_err(e)
}

/// Fusionar, con la copia automática antes (#143). Si la copia no se puede
/// guardar, no se fusiona nada.
fn fusionar(
    conn: &Connection,
    copias: &std::path::Path,
    keep: i64,
    drop: &[i64],
) -> anyhow::Result<()> {
    copias::guardar(conn, copias, Motivo::Fusionar, None)?;
    db::merge_tracks(conn, keep, drop)
}

/// Remember that a group is not duplicates after all.
#[tauri::command(async)]
pub fn dismiss_duplicates(db: State<Db>, signature: String) -> CmdResult<DuplicateReport> {
    let conn = db.0.lock().map_err(e)?;
    db::dismiss_duplicates(&conn, &signature).map_err(e)?;
    duplicate_report(&conn).map_err(e)
}

/// Offer every dismissed group again.
#[tauri::command(async)]
pub fn restore_dismissed_duplicates(db: State<Db>) -> CmdResult<DuplicateReport> {
    let conn = db.0.lock().map_err(e)?;
    db::clear_duplicate_dismissals(&conn).map_err(e)?;
    duplicate_report(&conn).map_err(e)
}

/// Let `asset://` reach a folder the user just pointed the library at.
///
/// The scope starts empty, so a folder nobody granted is a folder whose covers
/// and audio the webview cannot load — silently, which is why every path that
/// introduces one calls this.
fn permitir_asset(app: &AppHandle, ruta: &str) {
    if let Err(err) = app.asset_protocol_scope().allow_directory(ruta, true) {
        log::error!("could not grant asset access to «{ruta}»: {err}");
    }
}

/// Every path `asset://` has to reach for this database: its indexed folders.
///
/// Split from [`conceder_alcance`] so the decision can be tested without an
/// `AppHandle`, which these tests have no way to build.
fn rutas_con_alcance(conn: &Connection) -> anyhow::Result<Vec<String>> {
    Ok(db::list_folders(conn)?.into_iter().map(|carpeta| carpeta.ruta).collect())
}

/// Open `asset://` to every folder of the database behind `conn`.
///
/// Run at startup and again after a restore: a backup brings folders of its
/// own, usually from another PC, and without this their covers and audio stay
/// out of the webview's reach until the app is restarted (#124).
pub fn conceder_alcance(app: &AppHandle, conn: &Connection) {
    let inicio = std::time::Instant::now();
    match rutas_con_alcance(conn) {
        Ok(rutas) => {
            rutas.iter().for_each(|ruta| permitir_asset(app, ruta));
            log::info!("asset access granted to {} folders in {:?}", rutas.len(), inicio.elapsed());
        }
        Err(err) => log::error!("could not list the folders to grant asset access to: {err}"),
    }
}

/// Parse a list of ids coming from the frontend.
fn ids_de(ids: &[String]) -> CmdResult<Vec<i64>> {
    ids.iter().map(|i| i.parse::<i64>()).collect::<std::result::Result<Vec<i64>, _>>().map_err(e)
}

/// Append a whole selection to a list, in the order given, in one transaction.
#[tauri::command(async)]
pub fn add_tracks_to_playlist(
    db: State<Db>,
    playlist: String,
    tracks: Vec<String>,
) -> CmdResult<Vec<Playlist>> {
    let conn = db.0.lock().map_err(e)?;
    let n =
        db::add_tracks_to_playlist(&conn, playlist.parse::<i64>().map_err(e)?, &ids_de(&tracks)?)
            .map_err(e)?;
    log::info!("{n} tracks added to playlist {playlist}");
    db::list_playlists(&conn).map_err(e)
}

/// Mark or unmark a whole selection as favourites.
///
/// Nothing comes back: the store already painted the hearts before asking, and
/// the only other thing the answer could carry is the whole catalogue (#136).
#[tauri::command(async)]
pub fn set_tracks_fav(db: State<Db>, ids: Vec<String>, fav: bool) -> CmdResult<()> {
    let conn = db.0.lock().map_err(e)?;
    db::set_tracks_fav(&conn, &ids_de(&ids)?, fav).map_err(e)
}

/// Drop a whole selection from the catalogue. The audio files are untouched.
#[tauri::command(async)]
pub fn delete_tracks(db: State<Db>, ids: Vec<String>) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(e)?;
    let parsed = ids_de(&ids)?;
    db::delete_tracks(&conn, &parsed).map_err(e)?;
    log::info!("{} tracks removed from the catalogue", parsed.len());
    snapshot(&conn).map_err(e)
}

/// The lyrics and chords of one track.
#[tauri::command(async)]
pub fn get_track_sheet(db: State<Db>, id: String) -> CmdResult<Sheet> {
    let conn = db.0.lock().map_err(e)?;
    db::track_sheet(&conn, id.parse::<i64>().map_err(e)?).map_err(e)
}

/// The sheets of several tracks at once, for a whole service list.
#[tauri::command(async)]
pub fn get_sheets(db: State<Db>, ids: Vec<String>) -> CmdResult<Vec<Sheet>> {
    let parsed = ids
        .iter()
        .map(|i| i.parse::<i64>())
        .collect::<std::result::Result<Vec<i64>, _>>()
        .map_err(e)?;
    let conn = db.0.lock().map_err(e)?;
    db::sheets_for(&conn, &parsed).map_err(e)
}

/// Write a track's lyrics and chords.
#[tauri::command(async)]
pub fn update_track_sheet(
    db: State<Db>,
    id: String,
    letra: String,
    acordes: String,
) -> CmdResult<()> {
    let conn = db.0.lock().map_err(e)?;
    db::set_track_sheet(&conn, id.parse::<i64>().map_err(e)?, &letra, &acordes).map_err(e)
}

/// The tracks whose sheet holds every word searched for (#144).
#[tauri::command(async)]
pub fn search_lyrics(db: State<Db>, consulta: String) -> CmdResult<Vec<LyricHit>> {
    let conn = db.0.lock().map_err(e)?;
    db::search_lyrics(&conn, &consulta).map_err(e)
}

/// Re-check every indexed file on disk. Called after startup so tracks deleted
/// while the app was closed show up as missing without a full rescan.
///
/// One `stat` per track, so on its own connection: the main mutex is taken only
/// for the snapshot at the end.
#[tauri::command]
pub async fn reconcile_library(app: AppHandle) -> CmdResult<Snapshot> {
    fuera_del_hilo_principal(app, |app| {
        let inicio = std::time::Instant::now();
        let propia = db::open_secondary(&app.state::<DbPath>().0).map_err(e)?;
        db::reconcile_all(&propia).map_err(e)?;
        drop(propia);
        log::info!("reconcile done in {:?}", inicio.elapsed());
        let db = app.state::<Db>();
        let conn = db.0.lock().map_err(e)?;
        snapshot(&conn).map_err(e)
    })
    .await
}

#[tauri::command(async)]
pub fn remove_folder(
    db: State<Db>,
    db_path: State<DbPath>,
    slot: State<ScanSlot>,
    id: String,
) -> CmdResult<Snapshot> {
    let _claim = tomar(&slot, Tarea::QuitarCarpeta)?;
    let conn = db.0.lock().map_err(e)?;
    quitar_carpeta(&conn, &copias::carpeta(&db_path.0), id.parse::<i64>().map_err(e)?)
        .map_err(e)?;
    snapshot(&conn).map_err(e)
}

/// Quitar una carpeta, con la copia automática antes (#143). La toma de la
/// ranura de escaneo ya la hizo quien llama, así que la copia nunca se hace
/// con un escaneo escribiendo a medias (#127).
fn quitar_carpeta(conn: &Connection, copias: &std::path::Path, id: i64) -> anyhow::Result<()> {
    copias::guardar(conn, copias, Motivo::QuitarCarpeta, None)?;
    db::remove_folder(conn, id)
}

/// Point a track at the file's new location, keeping what it carries.
#[tauri::command(async)]
pub fn relocate_track(
    app: AppHandle,
    db: State<Db>,
    id: String,
    path: String,
) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(e)?;
    db::relocate_track(&conn, id.parse::<i64>().map_err(e)?, std::path::Path::new(&path))
        .map_err(e)?;
    // The file the user picked can live outside every indexed folder, so it is
    // granted on its own rather than through its parent.
    if let Err(err) = app.asset_protocol_scope().allow_file(&path) {
        log::error!("could not grant asset access to «{path}»: {err}");
    }
    log::info!("track {id} relocated to {path}");
    snapshot(&conn).map_err(e)
}

/// Remove one track from the catalogue. The audio file itself is never touched.
#[tauri::command(async)]
pub fn delete_track(db: State<Db>, id: String) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(e)?;
    db::delete_track(&conn, id.parse::<i64>().map_err(e)?).map_err(e)?;
    snapshot(&conn).map_err(e)
}

/// Point a whole indexed folder at its new location, rewriting every track under
/// it. For the case that actually happens: the music moved to another drive.
#[tauri::command(async)]
pub fn relocate_folder(
    app: AppHandle,
    db: State<Db>,
    slot: State<ScanSlot>,
    id: String,
    path: String,
) -> CmdResult<Snapshot> {
    let _claim = tomar(&slot, Tarea::ReapuntarCarpeta)?;
    let conn = db.0.lock().map_err(e)?;
    let n = db::relocate_folder(&conn, id.parse::<i64>().map_err(e)?, std::path::Path::new(&path))
        .map_err(e)?;
    permitir_asset(&app, &path);
    log::info!("folder {id} relocated to {path} ({n} tracks rewritten)");
    snapshot(&conn).map_err(e)
}

#[tauri::command(async)]
pub fn set_track_fav(db: State<Db>, id: String, fav: bool) -> CmdResult<()> {
    let conn = db.0.lock().map_err(e)?;
    db::set_fav(&conn, id.parse::<i64>().map_err(e)?, fav).map_err(e)
}

#[tauri::command(async)]
pub fn update_track(db: State<Db>, id: String, artista: String, ocasion: String) -> CmdResult<()> {
    let conn = db.0.lock().map_err(e)?;
    let tid = id.parse::<i64>().map_err(e)?;
    db::update_track_meta(&conn, tid, &artista, &ocasion).map_err(e)?;
    Ok(())
}

/// Una línea del frontend en el log de la app.
///
/// La consola del webview no llega a ningún sitio en una PC de iglesia; esto
/// sí, y es lo que permite saber qué hacía la interfaz cuando alguien dice que
/// se quedó pegada. Se recorta para que un mensaje desbocado no llene el disco.
#[tauri::command(async)]
pub fn registrar(nivel: String, mensaje: String) {
    let mensaje: String = mensaje.chars().take(2000).collect();
    match nivel.as_str() {
        "error" => log::error!(target: "ui", "{mensaje}"),
        "warn" => log::warn!(target: "ui", "{mensaje}"),
        _ => log::info!(target: "ui", "{mensaje}"),
    }
}

/// Where the app writes its log, for the «Mostrar el registro» button.
///
/// The folder differs per system —on Windows it is under `%LOCALAPPDATA%`, not
/// `%APPDATA%` where the database lives— and nobody at a church PC should have
/// to know which. Same directory `tauri-plugin-log` writes to in `lib.rs`.
#[tauri::command(async)]
pub fn ruta_del_log(app: AppHandle) -> CmdResult<String> {
    let dir = app.path().app_log_dir().map_err(e)?;
    Ok(dir.join("cantoral.log").to_string_lossy().to_string())
}

/// Store the duration the webview read from a video whose tags had none.
///
/// Async like every other command that takes the mutex: at startup the
/// frontend calls this once per such video, and on the main thread each call
/// would queue behind the reconcile snapshot with the window frozen meanwhile.
#[tauri::command(async)]
pub fn update_track_duration(
    db: State<Db>,
    id: String,
    path: String,
    duration: i64,
) -> CmdResult<()> {
    if duration <= 0 {
        return Err("La duración debe ser mayor que cero".into());
    }
    let conn = db.0.lock().map_err(e)?;
    db::update_track_duration(&conn, id.parse::<i64>().map_err(e)?, &path, duration).map_err(e)
}

/// Guardar la miniatura que la webview sacó de un video.
///
/// Lo que llega son los bytes de la imagen y nada más: dónde se escribe lo
/// decide el núcleo (ver `miniaturas::guardar`). Devuelve la ruta para que la
/// fila la enseñe sin recargar el catálogo, o `None` si la pista ya no es ese
/// video.
#[tauri::command(async)]
pub fn save_video_thumbnail(
    app: AppHandle,
    db: State<Db>,
    id: String,
    path: String,
    bytes: Vec<u8>,
) -> CmdResult<Option<String>> {
    let cover_dir = app.path().app_data_dir().map_err(e)?.join("covers");
    let id = id.parse::<i64>().map_err(e)?;
    let conn = db.0.lock().map_err(e)?;
    crate::miniaturas::guardar(&conn, &cover_dir, id, &path, &bytes).map_err(e)
}

/// Apuntar que de un video no salió miniatura, para no intentarlo otra vez.
#[tauri::command(async)]
pub fn mark_video_thumbnail_failed(db: State<Db>, id: String, path: String) -> CmdResult<()> {
    let conn = db.0.lock().map_err(e)?;
    db::mark_thumbnail_failed(&conn, id.parse::<i64>().map_err(e)?, &path).map_err(e)
}

/// Create a playlist, optionally with the track order of `desde` (a template).
#[tauri::command(async)]
pub fn create_playlist(
    db: State<Db>,
    nombre: String,
    ocasion: String,
    desde: Option<String>,
) -> CmdResult<String> {
    let conn = db.0.lock().map_err(e)?;
    // An unparseable id means «no template», not an error: the list is what the
    // user asked for, and creating it empty beats refusing to create it.
    let origen = desde.and_then(|d| d.parse::<i64>().ok());
    let id = db::create_playlist(&conn, &nombre, &ocasion, origen).map_err(e)?;
    Ok(id.to_string())
}

/// Copy a playlist with its order. Returns the new id so the UI can open it.
#[tauri::command(async)]
pub fn duplicate_playlist(db: State<Db>, playlist: String) -> CmdResult<String> {
    let conn = db.0.lock().map_err(e)?;
    let id = db::duplicate_playlist(&conn, playlist.parse::<i64>().map_err(e)?).map_err(e)?;
    Ok(id.to_string())
}

#[tauri::command(async)]
pub fn set_playlist_template(
    db: State<Db>,
    playlist: String,
    plantilla: bool,
) -> CmdResult<Vec<Playlist>> {
    let conn = db.0.lock().map_err(e)?;
    db::set_playlist_template(&conn, playlist.parse::<i64>().map_err(e)?, plantilla).map_err(e)?;
    db::list_playlists(&conn).map_err(e)
}

#[tauri::command(async)]
pub fn set_playlist_order(db: State<Db>, playlist: String, ids: Vec<String>) -> CmdResult<()> {
    let conn = db.0.lock().map_err(e)?;
    let pid = playlist.parse::<i64>().map_err(e)?;
    // Pistas y momentos (#145), cada uno por su clave: `12` o `m:12`.
    let orden: Vec<db::Elemento> = ids.iter().filter_map(|s| db::Elemento::de_clave(s)).collect();
    db::set_playlist_order(&conn, pid, &orden).map_err(e)
}

/// El id de fila de un momento a partir de su clave (`m:12`).
fn id_de_momento(clave: &str) -> CmdResult<i64> {
    match db::Elemento::de_clave(clave) {
        Some(db::Elemento::Momento(id)) => Ok(id),
        _ => Err(format!("«{clave}» no es un momento del culto")),
    }
}

/// Añadir un momento sin música —una oración, una lectura— al final de un
/// culto (#145). Contesta con las listas, como agregar pistas.
#[tauri::command(async)]
pub fn add_playlist_momento(
    db: State<Db>,
    playlist: String,
    tipo: String,
    titulo: String,
    texto: String,
) -> CmdResult<Vec<Playlist>> {
    let conn = db.0.lock().map_err(e)?;
    db::add_playlist_momento(&conn, playlist.parse::<i64>().map_err(e)?, &tipo, &titulo, &texto)
        .map_err(e)?;
    db::list_playlists(&conn).map_err(e)
}

/// Cambiar lo que dice un momento del culto. Su sitio en el orden no se toca.
#[tauri::command(async)]
pub fn update_playlist_momento(
    db: State<Db>,
    momento: String,
    tipo: String,
    titulo: String,
    texto: String,
) -> CmdResult<Vec<Playlist>> {
    let conn = db.0.lock().map_err(e)?;
    db::update_playlist_momento(&conn, id_de_momento(&momento)?, &tipo, &titulo, &texto)
        .map_err(e)?;
    db::list_playlists(&conn).map_err(e)
}

#[tauri::command(async)]
pub fn add_to_playlist(db: State<Db>, playlist: String, track: String) -> CmdResult<Vec<Playlist>> {
    let conn = db.0.lock().map_err(e)?;
    db::add_to_playlist(
        &conn,
        playlist.parse::<i64>().map_err(e)?,
        track.parse::<i64>().map_err(e)?,
    )
    .map_err(e)?;
    db::list_playlists(&conn).map_err(e)
}

#[tauri::command(async)]
pub fn update_playlist(
    db: State<Db>,
    playlist: String,
    nombre: String,
    ocasion: String,
) -> CmdResult<Vec<Playlist>> {
    let conn = db.0.lock().map_err(e)?;
    db::update_playlist(&conn, playlist.parse::<i64>().map_err(e)?, &nombre, &ocasion)
        .map_err(e)?;
    db::list_playlists(&conn).map_err(e)
}

/// Apuntar que un culto se acaba de abrir o de cambiar. Ver `db::touch_playlist`.
#[tauri::command(async)]
pub fn touch_playlist(db: State<Db>, playlist: String) -> CmdResult<()> {
    let conn = db.0.lock().map_err(e)?;
    db::touch_playlist(&conn, playlist.parse::<i64>().map_err(e)?).map_err(e)
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

/// Las pantallas conectadas, para elegir por cuál sale la proyección.
#[tauri::command]
pub fn projection_monitors(app: AppHandle) -> CmdResult<Vec<crate::proyeccion::Monitor>> {
    crate::proyeccion::monitores(&app)
}

/// Abre la salida a pantalla completa en la pantalla pedida, o la mueve allí.
#[tauri::command]
pub async fn open_projection(app: AppHandle, monitor: usize) -> CmdResult<()> {
    crate::proyeccion::abrir(&app, monitor)
}

/// Cierra la salida.
#[tauri::command]
pub fn close_projection(app: AppHandle) -> CmdResult<()> {
    crate::proyeccion::cerrar(&app)
}

/// Manda a la salida lo que tiene que mostrar.
#[tauri::command]
pub fn set_projection(app: AppHandle, contenido: serde_json::Value) -> CmdResult<()> {
    crate::proyeccion::emitir(&app, contenido)
}

/// Is there a newer Cantoral published?
///
/// Desktop only: on mobile the store does this, and the plugin is not even
/// compiled in, so the frontend is told there is nothing configured.
#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> CmdResult<crate::updates::UpdateCheck> {
    #[cfg(desktop)]
    {
        crate::updates::buscar(&app).await
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        Ok(crate::updates::UpdateCheck::SinConfigurar)
    }
}

/// Download and install the update, then restart into it. Does not return.
#[tauri::command]
pub async fn install_update(app: AppHandle) -> CmdResult<()> {
    #[cfg(desktop)]
    {
        crate::updates::instalar(&app).await
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        Err("Esta compilación de Cantoral no trae actualizaciones automáticas.".into())
    }
}

/// Whether Cantoral opens by itself when the user signs in to the computer.
///
/// Asked of the system every time rather than kept in the settings: the user
/// can also turn it off from the system (the Windows Task Manager, macOS
/// Login Items), and then the system is the one that is right. `None` where
/// there is no such thing — mobile.
#[tauri::command]
pub fn get_autostart(app: AppHandle) -> CmdResult<Option<bool>> {
    #[cfg(desktop)]
    {
        use tauri_plugin_autostart::ManagerExt;
        app.autolaunch().is_enabled().map(Some).map_err(e)
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        Ok(None)
    }
}

/// Turn opening with the system on or off, and return how it was left.
///
/// Answers with what the system says afterwards, not with what was asked: if
/// a policy on a church PC refuses the change, the checkbox shows the truth.
#[tauri::command]
pub fn set_autostart(app: AppHandle, activar: bool) -> CmdResult<bool> {
    #[cfg(desktop)]
    {
        use tauri_plugin_autostart::ManagerExt;
        let lanzador = app.autolaunch();
        if activar {
            lanzador.enable().map_err(e)?;
        } else {
            lanzador.disable().map_err(e)?;
        }
        let quedo = lanzador.is_enabled().map_err(e)?;
        log::info!("autostart: asked {activar}, system says {quedo}");
        Ok(quedo)
    }
    #[cfg(not(desktop))]
    {
        let _ = (app, activar);
        Err("En este sistema Cantoral no se puede abrir al encender el equipo.".into())
    }
}

/// Write a playlist as the `.cantoral.json` another installation can import.
///
/// Its own command rather than a looser `export_playlist`: that one is capped
/// at .html precisely so it cannot become a write-anything primitive, and
/// widening it to take a second extension would trade that guarantee away for
/// nothing. The frontend builds the JSON; this only puts it on disk.
#[tauri::command]
pub fn export_playlist_json(dest: String, json: String) -> CmdResult<()> {
    if !compartir::es_json(&dest) {
        return Err("El archivo exportado debe terminar en .json".into());
    }
    std::fs::write(&dest, json.as_bytes()).map_err(e)
}

/// Read a shared playlist file without touching the library.
///
/// Takes any `.json`, not only the `.cantoral.json` the app writes (#131): a
/// file renamed by hand, or by a mail client that mangles double extensions,
/// is still a list someone meant to share. That is safe because `leer` only
/// returns something when the content is a valid Cantoral list, and its
/// errors never echo the file's content, so this is no general-purpose read.
///
/// Nothing is created until the user has seen what matched: the same shape as
/// `inspect_backup`, because both answer «what am I about to let in?».
#[tauri::command]
pub fn read_playlist_file(src: String) -> CmdResult<compartir::PlaylistFile> {
    if !compartir::es_json(&src) {
        return Err("Una lista exportada de Cantoral termina en .json".into());
    }
    compartir::leer(std::path::Path::new(&src)).map_err(|err| format!("{err}"))
}

#[tauri::command(async)]
pub fn delete_playlist(db: State<Db>, playlist: String) -> CmdResult<Vec<Playlist>> {
    let conn = db.0.lock().map_err(e)?;
    db::delete_playlist(&conn, playlist.parse::<i64>().map_err(e)?).map_err(e)?;
    db::list_playlists(&conn).map_err(e)
}

/// Read a candidate backup without touching it, so the confirmation dialog can
/// say what the user is about to replace their library with. A backup from a
/// newer Cantoral is refused here already, so the question is never posed for
/// a restore that `restore_database` would turn down anyway.
#[tauri::command]
pub fn inspect_backup(src: String) -> CmdResult<db::BackupInfo> {
    db::validate_backup(std::path::Path::new(&src)).map_err(e)
}

/// What a failed restore answers when the previous database could not be
/// reopened either. The frontend recognises it by this exact text (the same
/// constant lives in `src/lib/api.ts`) and shows it as the library's error
/// state rather than as a toast that is gone in five seconds (#124).
pub const BIBLIOTECA_SIN_ABRIR: &str =
    "La biblioteca no se pudo reabrir. Cierra y vuelve a abrir Cantoral.";

/// Replace the live database with a backup file, then return the fresh snapshot.
///
/// Nothing on disk is touched until the backup has been read and confirmed to be
/// a Cantoral database, and the previous file is moved aside rather than deleted,
/// so a restore that fails half way leaves the library exactly as it was.
#[tauri::command]
pub async fn restore_database(app: AppHandle, src: String) -> CmdResult<Snapshot> {
    fuera_del_hilo_principal(app, move |app| restore_database_bloqueante(app, src)).await
}

fn restore_database_bloqueante(app: &AppHandle, src: String) -> CmdResult<Snapshot> {
    let db = app.state::<Db>();
    let db_path = app.state::<DbPath>();
    let slot = app.state::<ScanSlot>();
    let live = db_path.0.as_path();
    let src = std::path::Path::new(&src);

    // A scan holds its own connection to the file this is about to move aside.
    let _claim = tomar(&slot, Tarea::Restaurar)?;

    // Validated first, while the live connection is still open: a file picked by
    // mistake, or one from a newer Cantoral, is rejected without the app having
    // given anything up.
    db::validate_backup(src).map_err(e)?;

    // Held until the restore is over. While it runs the mutex holds a blank
    // in-memory database, and with the window no longer frozen for the length
    // of the restore, a command let in meanwhile would read an empty library
    // or write into nothing. It waits here instead.
    let mut guard = db.0.lock().map_err(e)?;

    restaurar(&mut guard, live, src, &copias::carpeta(live))?;
    let snap = snapshot(&guard).map_err(e)?;
    conceder_alcance(app, &guard);
    log::info!("database restored from {}", src.display());
    Ok(snap)
}

/// El reemplazo de la base en sí, sin Tauri de por medio para poder probarlo.
///
/// Primero la copia automática de la biblioteca actual (#143): si no se puede
/// guardar, no se restaura nada. El respaldo que se restaura queda protegido de
/// la rotación, porque puede ser una de esas mismas copias.
fn restaurar(
    guard: &mut Connection,
    live: &std::path::Path,
    src: &std::path::Path,
    dir_copias: &std::path::Path,
) -> CmdResult<()> {
    copias::guardar(guard, dir_copias, Motivo::Restaurar, Some(src)).map_err(e)?;

    // Fold the WAL back into the main file and release it, so the restore can
    // move it aside (an open handle makes that fail on Windows).
    let _ = guard.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
    *guard = rusqlite::Connection::open_in_memory().map_err(e)?;

    match db::restore_from_backup(live, src) {
        Ok(conn) => {
            *guard = conn;
            Ok(())
        }
        Err(err) => {
            // `restore_from_backup` already put the previous database back; all
            // that is left is to reopen it, so the app stays usable.
            match db::open_and_migrate(live) {
                Ok(conn) => {
                    *guard = conn;
                    Err(e(err))
                }
                Err(reopen) => {
                    // The mutex is left holding the blank in-memory database:
                    // anything edited from here on would be lost on close. Only
                    // a restart gets the file back, so say that instead of the
                    // restore's own error (#124).
                    log::error!("restore failed: {err}");
                    log::error!("could not reopen the database after a failed restore: {reopen}");
                    Err(BIBLIOTECA_SIN_ABRIR.into())
                }
            }
        }
    }
}

/// Las copias automáticas que se guardaron antes de quitar una carpeta,
/// restaurar o fusionar, de la más nueva a la más antigua (#143). Se restauran
/// por el camino de siempre: `inspect_backup` y `restore_database`.
#[tauri::command(async)]
pub fn list_auto_backups(db_path: State<DbPath>) -> CmdResult<Vec<copias::CopiaAutomatica>> {
    copias::listar(&copias::carpeta(&db_path.0)).map_err(e)
}

#[tauri::command(async)]
pub fn get_setting(db: State<Db>, key: String) -> CmdResult<Option<String>> {
    let conn = db.0.lock().map_err(e)?;
    db::get_setting(&conn, &key).map_err(e)
}

#[tauri::command(async)]
pub fn set_setting(db: State<Db>, key: String, value: String) -> CmdResult<()> {
    let conn = db.0.lock().map_err(e)?;
    db::set_setting(&conn, &key, &value).map_err(e)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbInfo {
    pub path: String,
    pub size: u64,
    /// RFC3339 time of the last backup that was actually written, if any.
    pub ultima_copia: Option<String>,
}

/// Where `backup_database` notes the last backup that succeeded.
const ULTIMA_COPIA: &str = "ultimaCopia";

/// Real location and size of the local database file, and when it was last
/// backed up — what a shared church PC needs to know before trusting it.
#[tauri::command(async)]
pub fn get_db_info(db: State<Db>, db_path: State<DbPath>) -> CmdResult<DbInfo> {
    let path = db_path.0.as_path();
    let size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    let ultima_copia = {
        let conn = db.0.lock().map_err(e)?;
        db::get_setting(&conn, ULTIMA_COPIA).map_err(e)?
    };
    Ok(DbInfo { path: path.to_string_lossy().to_string(), size, ultima_copia })
}

/// Whether a backup destination ends in `.db`, in any case.
///
/// Same guard as `export_playlist` and `export_playlist_json`, and for the
/// same reason (#131): without it this command could overwrite any writable
/// file with the contents of `cantoral.db`. Only `.db` because it is what the
/// save dialog proposes and the only thing the restore dialog lets you pick.
fn es_db(dest: &str) -> bool {
    std::path::Path::new(dest)
        .extension()
        .and_then(|s| s.to_str())
        .is_some_and(|s| s.eq_ignore_ascii_case("db"))
}

const SOLO_DB: &str = "La copia de seguridad debe terminar en .db";

/// Put the (already checkpointed) database at `dest`, refusing anything that
/// is not a `.db`.
fn copiar_respaldo(src: &std::path::Path, dest: &str) -> CmdResult<()> {
    if !es_db(dest) {
        return Err(SOLO_DB.into());
    }
    std::fs::copy(src, dest).map(|_| ()).map_err(e)
}

/// Copy the database to `dest`. The WAL is first checkpointed into the main file
/// so the copy is complete — a plain copy alone would miss data still in the WAL.
///
/// Returns when it happened, and notes it in the settings, only once the copy
/// is on disk: a date for a copy that failed would be the false reassurance
/// this exists to avoid (#128).
#[tauri::command]
pub async fn backup_database(app: AppHandle, dest: String) -> CmdResult<String> {
    // Refused before the checkpoint: nothing is touched for a bad destination.
    if !es_db(&dest) {
        return Err(SOLO_DB.into());
    }
    fuera_del_hilo_principal(app, move |app| {
        let src = app.state::<DbPath>().0.clone();
        {
            let db = app.state::<Db>();
            let conn = db.0.lock().map_err(e)?;
            let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
        }
        copiar_respaldo(&src, &dest)?;
        let cuando = chrono::Utc::now().to_rfc3339();
        {
            let db = app.state::<Db>();
            let conn = db.0.lock().map_err(e)?;
            // The copy itself is done; failing to note it is not worth
            // reporting the backup as failed.
            if let Err(err) = db::set_setting(&conn, ULTIMA_COPIA, &cuando) {
                log::error!("could not note the backup time: {err}");
            }
        }
        log::info!("database backed up to {dest}");
        Ok(cuando)
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::{
        copiar_respaldo, export_playlist, export_playlist_json, fusionar, quitar_carpeta,
        restaurar, rutas_con_alcance,
    };
    use crate::{copias, db};
    use std::path::Path;

    /// A temp directory of this test's own, cleared when it goes out of scope.
    ///
    /// One per test rather than one shared filename. These tests all wrote to
    /// `cantoral-export-test.*` in the shared temp directory, and on a
    /// case-insensitive filesystem `…test.HTML` and `…test.html` are the same
    /// file — so the test that writes the uppercase one could delete the file
    /// another was in the middle of reading. `cargo test` runs them in
    /// parallel, so it showed up as a failure roughly one run in four, and only
    /// on macOS: the Linux runners in CI never saw it.
    struct Dir(std::path::PathBuf);

    impl Dir {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!("cantoral-export-{name}"));
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).unwrap();
            Dir(dir)
        }

        fn path(&self, name: &str) -> String {
            self.0.join(name).to_string_lossy().to_string()
        }
    }

    impl Drop for Dir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn export_writes_the_sheet_verbatim() {
        let dir = Dir::new("verbatim");
        let dest = dir.path("culto.html");

        export_playlist(dest.clone(), "<h1>Culto</h1>".into()).unwrap();

        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "<h1>Culto</h1>");
    }

    #[test]
    fn the_json_export_writes_what_it_is_given() {
        let dir = Dir::new("json-verbatim");
        let dest = dir.path("culto.json");

        export_playlist_json(dest.clone(), r#"{"cantoral":1}"#.into()).unwrap();

        assert_eq!(std::fs::read_to_string(&dest).unwrap(), r#"{"cantoral":1}"#);
    }

    #[test]
    fn the_json_export_is_no_looser_than_the_sheet_one() {
        // Two commands with one extension each, rather than one command with
        // two: neither may become a way to write arbitrary bytes anywhere.
        let dir = Dir::new("json-refuses");
        for bad in ["culto.html", "culto.db", "culto.sh", "culto"] {
            let dest = dir.path(bad);
            assert!(export_playlist_json(dest.clone(), "{}".into()).is_err(), "{bad}");
            assert!(!std::path::Path::new(&dest).exists(), "{bad} must not have been written");
        }
        // And the sheet export still refuses .json, for the same reason.
        let dest = dir.path("culto.json");
        assert!(export_playlist(dest.clone(), "<h1>x</h1>".into()).is_err());
        assert!(!std::path::Path::new(&dest).exists());
    }

    #[test]
    fn export_refuses_anything_that_is_not_html() {
        // The command must not double as a write-anything primitive.
        let dir = Dir::new("refuses");
        for bad in ["culto.db", "culto.sh", "culto"] {
            let dest = dir.path(bad);
            assert!(export_playlist(dest.clone(), "x".into()).is_err(), "{bad} should be refused");
            assert!(!std::path::Path::new(&dest).exists(), "{bad} must not be created");
        }
    }

    #[test]
    fn a_backup_must_be_a_db() {
        // Sin esta guarda, la copia sobrescribiría cualquier archivo escribible
        // con el contenido de `cantoral.db` (#131).
        let dir = Dir::new("respaldo-extension");
        let src = std::path::PathBuf::from(dir.path("cantoral.db"));
        std::fs::write(&src, b"SQLite format 3\0").unwrap();
        for bad in ["x.txt", "x.db.txt", "x", "x.sqlite"] {
            let dest = dir.path(bad);
            assert!(copiar_respaldo(&src, &dest).is_err(), "{bad} should be refused");
            assert!(!std::path::Path::new(&dest).exists(), "{bad} must not be created");
        }
        for ok in ["copia.db", "COPIA.DB"] {
            let dest = dir.path(ok);
            copiar_respaldo(&src, &dest).unwrap_or_else(|err| panic!("{ok}: {err}"));
            assert_eq!(std::fs::read(&dest).unwrap(), std::fs::read(&src).unwrap());
        }
    }

    #[test]
    fn export_accepts_either_html_spelling_and_ignores_case() {
        let dir = Dir::new("spellings");
        for ok in ["culto.htm", "culto.HTML"] {
            let dest = dir.path(ok);
            assert!(export_playlist(dest.clone(), "x".into()).is_ok(), "{ok} should be accepted");
        }
    }

    #[test]
    fn after_a_restore_every_folder_of_the_database_is_granted() {
        // The invariant behind #124: the paths granted after a restore are the
        // restored database's folders — including the ones the installation
        // never had, which is the whole point of moving a library between PCs.
        let dir = Dir::new("alcance-restaurado");
        let live = std::path::PathBuf::from(dir.path("cantoral.db"));
        let backup = std::path::PathBuf::from(dir.path("respaldo.db"));

        let conn = db::open_and_migrate(&live).unwrap();
        db::add_folder(&conn, "/musica/local", "Local", true).unwrap();
        drop(conn);
        let conn = db::open_and_migrate(&backup).unwrap();
        db::add_folder(&conn, "/otro-pc/Himnos", "Himnos", true).unwrap();
        db::add_folder(&conn, "/otro-pc/Coros", "Coros", false).unwrap();
        conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);").unwrap();
        drop(conn);

        let restaurada = db::restore_from_backup(&live, &backup).unwrap();

        let mut rutas = rutas_con_alcance(&restaurada).unwrap();
        rutas.sort();
        assert_eq!(rutas, ["/otro-pc/Coros", "/otro-pc/Himnos"]);
    }

    // ---- copia automática antes de lo que no se deshace (#143)

    /// Una base en disco con una carpeta de `n` pistas, en `dir/nombre`.
    fn base_con(
        dir: &Dir,
        nombre: &str,
        n: usize,
    ) -> (std::path::PathBuf, rusqlite::Connection, i64) {
        let ruta = std::path::PathBuf::from(dir.path(nombre));
        let conn = db::open_and_migrate(&ruta).unwrap();
        let fid = db::add_folder(&conn, &format!("/m/{nombre}"), "m", true).unwrap();
        for i in 0..n {
            db::upsert_track(
                &conn,
                fid,
                &format!("/m/{nombre}/{i}.mp3"),
                "t",
                "a",
                "al",
                1,
                "MP3",
                false,
                1,
                1,
            )
            .unwrap();
        }
        (ruta, conn, fid)
    }

    fn pistas_en(copia: &str) -> i64 {
        db::inspect_backup(Path::new(copia)).unwrap().tracks
    }

    #[test]
    fn removing_a_folder_saves_a_copy_first_and_the_copy_brings_it_back() {
        let dir = Dir::new("copia-quitar");
        let (live, mut conn, fid) = base_con(&dir, "cantoral.db", 4);
        db::set_track_sheet(&conn, 1, "Letra a mano", "").unwrap();
        let respaldos = copias::carpeta(&live);

        quitar_carpeta(&conn, &respaldos, fid).unwrap();
        assert!(db::list_tracks(&conn).unwrap().is_empty());

        let lista = copias::listar(&respaldos).unwrap();
        assert_eq!(lista.len(), 1);
        assert_eq!(lista[0].motivo, "quitar-carpeta");
        assert_eq!(pistas_en(&lista[0].ruta), 4, "la copia es de antes de quitarla");

        // Restaurarla es el «deshacer»: vuelven las pistas y la letra.
        let src = std::path::PathBuf::from(&lista[0].ruta);
        restaurar(&mut conn, &live, &src, &respaldos).unwrap();
        assert_eq!(db::list_tracks(&conn).unwrap().len(), 4);
        assert_eq!(db::track_sheet(&conn, 1).unwrap().letra, "Letra a mano");
    }

    #[test]
    fn a_folder_is_not_removed_when_its_copy_cannot_be_saved() {
        let dir = Dir::new("copia-quitar-falla");
        let (_live, conn, fid) = base_con(&dir, "cantoral.db", 2);
        let bloqueo = std::path::PathBuf::from(dir.path("respaldos"));
        std::fs::write(&bloqueo, b"no soy una carpeta").unwrap();

        let err = quitar_carpeta(&conn, &bloqueo, fid).unwrap_err();

        assert!(err.to_string().contains("no se quitó la carpeta"), "{err}");
        assert_eq!(db::list_tracks(&conn).unwrap().len(), 2, "no se quitó nada");
    }

    #[test]
    fn merging_saves_a_copy_first() {
        let dir = Dir::new("copia-fusionar");
        let (live, conn, _) = base_con(&dir, "cantoral.db", 3);
        let respaldos = copias::carpeta(&live);

        fusionar(&conn, &respaldos, 1, &[2, 3]).unwrap();

        assert_eq!(db::list_tracks(&conn).unwrap().len(), 1);
        let lista = copias::listar(&respaldos).unwrap();
        assert_eq!(lista[0].motivo, "fusionar");
        assert_eq!(pistas_en(&lista[0].ruta), 3);
    }

    #[test]
    fn a_merge_is_not_done_when_its_copy_cannot_be_saved() {
        let dir = Dir::new("copia-fusionar-falla");
        let (_live, conn, _) = base_con(&dir, "cantoral.db", 3);
        let bloqueo = std::path::PathBuf::from(dir.path("respaldos"));
        std::fs::write(&bloqueo, b"x").unwrap();

        assert!(fusionar(&conn, &bloqueo, 1, &[2, 3]).is_err());
        assert_eq!(db::list_tracks(&conn).unwrap().len(), 3);
    }

    #[test]
    fn restoring_saves_the_current_library_first() {
        let dir = Dir::new("copia-restaurar");
        let (live, mut conn, _) = base_con(&dir, "cantoral.db", 2);
        let (backup, otra, _) = base_con(&dir, "respaldo.db", 5);
        otra.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);").unwrap();
        drop(otra);
        let respaldos = copias::carpeta(&live);

        restaurar(&mut conn, &live, &backup, &respaldos).unwrap();

        assert_eq!(db::list_tracks(&conn).unwrap().len(), 5, "se restauró");
        let lista = copias::listar(&respaldos).unwrap();
        assert_eq!(lista[0].motivo, "restaurar");
        assert_eq!(pistas_en(&lista[0].ruta), 2, "la copia es la biblioteca de antes");
    }

    #[test]
    fn a_restore_is_not_done_when_its_copy_cannot_be_saved() {
        let dir = Dir::new("copia-restaurar-falla");
        let (live, mut conn, _) = base_con(&dir, "cantoral.db", 2);
        let (backup, otra, _) = base_con(&dir, "respaldo.db", 5);
        drop(otra);
        let bloqueo = std::path::PathBuf::from(dir.path("respaldos"));
        std::fs::write(&bloqueo, b"x").unwrap();

        let err = restaurar(&mut conn, &live, &backup, &bloqueo).unwrap_err();

        assert!(err.contains("no se restauró el respaldo"), "{err}");
        assert_eq!(db::list_tracks(&conn).unwrap().len(), 2, "la biblioteca sigue igual");
    }

    #[test]
    fn restoring_the_oldest_automatic_copy_does_not_rotate_it_away() {
        let dir = Dir::new("copia-restaurar-vieja");
        let (live, mut conn, fid) = base_con(&dir, "cantoral.db", 3);
        let respaldos = copias::carpeta(&live);
        // Una de antes de quitar la carpeta, y detrás tantas como caben.
        quitar_carpeta(&conn, &respaldos, fid).unwrap();
        for _ in 1..copias::CONSERVAR {
            copias::guardar(&conn, &respaldos, copias::Motivo::Fusionar, None).unwrap();
        }
        let lista = copias::listar(&respaldos).unwrap();
        assert_eq!(lista.len(), copias::CONSERVAR);
        assert_eq!(lista.last().unwrap().motivo, "quitar-carpeta");
        let mas_vieja = std::path::PathBuf::from(&lista.last().unwrap().ruta);

        restaurar(&mut conn, &live, &mas_vieja, &respaldos).unwrap();

        assert_eq!(db::list_tracks(&conn).unwrap().len(), 3);
    }
}
