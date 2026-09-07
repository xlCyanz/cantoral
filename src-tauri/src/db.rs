use anyhow::Result;
use rusqlite::{params, Connection};
use std::sync::Mutex;

use crate::models::{fmt_dur, Folder, Playlist, Track};

/// Tauri-managed database handle.
pub struct Db(pub Mutex<Connection>);

const SCHEMA: &str = r#"
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS folders (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  path     TEXT NOT NULL UNIQUE,
  nombre   TEXT NOT NULL,
  added_at TEXT NOT NULL,
  last_scan TEXT,
  recursive INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tracks (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  path      TEXT NOT NULL UNIQUE,
  titulo    TEXT NOT NULL DEFAULT '',
  artista   TEXT NOT NULL DEFAULT '',
  album     TEXT NOT NULL DEFAULT '',
  dur_sec   INTEGER NOT NULL DEFAULT 0,
  formato   TEXT NOT NULL DEFAULT '',
  tono      TEXT NOT NULL DEFAULT '',
  bpm       INTEGER NOT NULL DEFAULT 0,
  ocasion   TEXT NOT NULL DEFAULT '',
  fav       INTEGER NOT NULL DEFAULT 0,
  missing   INTEGER NOT NULL DEFAULT 0,
  video     INTEGER NOT NULL DEFAULT 0,
  cover_path TEXT,
  added_at  TEXT NOT NULL,
  mtime     INTEGER NOT NULL DEFAULT 0,
  fsize     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS playlists (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre    TEXT NOT NULL,
  fecha     TEXT NOT NULL DEFAULT '',
  ocasion   TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id    INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS track_tags (
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (track_id, tag_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_tracks_titulo ON tracks(titulo);
CREATE INDEX IF NOT EXISTS idx_tracks_folder ON tracks(folder_id);
"#;

pub fn open_and_migrate(path: &std::path::Path) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(SCHEMA)?;
    // A scan runs on its own connection, so both sides must wait rather than
    // fail with SQLITE_BUSY while the other holds the write lock.
    conn.execute_batch("PRAGMA busy_timeout = 15000;")?;
    // Migrations for databases created before a column existed (no-op if present).
    let _ = conn.execute("ALTER TABLE tracks ADD COLUMN cover_path TEXT", []);
    let _ = conn.execute(
        "ALTER TABLE folders ADD COLUMN recursive INTEGER NOT NULL DEFAULT 1",
        [],
    );
    let _ = conn.execute("ALTER TABLE tracks ADD COLUMN mtime INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE tracks ADD COLUMN fsize INTEGER NOT NULL DEFAULT 0", []);
    Ok(conn)
}

/// Open a second connection to the same database, for work that must not hold
/// the main mutex (scanning). WAL lets it write while the UI keeps reading;
/// `busy_timeout` makes the two wait for each other instead of erroring.
pub fn open_secondary(path: &std::path::Path) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 15000;")?;
    Ok(conn)
}

fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

// ---------------------------------------------------------------- tracks

pub fn list_tracks(conn: &Connection) -> Result<Vec<Track>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.path, t.titulo, t.artista, t.album, t.dur_sec, t.formato,
                t.tono, t.bpm, t.ocasion, t.fav, t.missing, t.video,
                COALESCE(f.nombre,''),
                (SELECT group_concat(tg.name, ',') FROM track_tags tt
                   JOIN tags tg ON tg.id = tt.tag_id WHERE tt.track_id = t.id),
                t.cover_path
         FROM tracks t LEFT JOIN folders f ON f.id = t.folder_id
         ORDER BY t.id",
    )?;
    let rows = stmt.query_map([], |r| {
        let id: i64 = r.get(0)?;
        let dur_sec: i64 = r.get(5)?;
        let tags_csv: Option<String> = r.get(14)?;
        let tags = tags_csv
            .filter(|s| !s.is_empty())
            .map(|s| s.split(',').map(|x| x.to_string()).collect())
            .unwrap_or_default();
        Ok(Track {
            id: id.to_string(),
            path: r.get(1)?,
            titulo: r.get(2)?,
            artista: r.get(3)?,
            album: r.get(4)?,
            dur_sec,
            dur: fmt_dur(dur_sec),
            formato: r.get(6)?,
            tono: r.get(7)?,
            bpm: r.get(8)?,
            ocasion: r.get(9)?,
            fav: r.get::<_, i64>(10)? != 0,
            missing: r.get::<_, i64>(11)? != 0,
            video: r.get::<_, i64>(12)? != 0,
            carpeta: r.get(13)?,
            tags,
            added: id,
            cover: r.get::<_, Option<String>>(15)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<_, _>>()?)
}

pub fn update_track_meta(
    conn: &Connection,
    id: i64,
    tono: &str,
    bpm: i64,
    ocasion: &str,
) -> Result<()> {
    conn.execute(
        "UPDATE tracks SET tono=?1, bpm=?2, ocasion=?3 WHERE id=?4",
        params![tono, bpm, ocasion, id],
    )?;
    Ok(())
}

pub fn set_fav(conn: &Connection, id: i64, fav: bool) -> Result<()> {
    conn.execute(
        "UPDATE tracks SET fav=?1 WHERE id=?2",
        params![fav as i64, id],
    )?;
    Ok(())
}

pub fn set_track_tags(conn: &Connection, id: i64, tags: &[String]) -> Result<()> {
    conn.execute("DELETE FROM track_tags WHERE track_id=?1", params![id])?;
    for name in tags {
        let name = name.trim();
        if name.is_empty() {
            continue;
        }
        conn.execute(
            "INSERT OR IGNORE INTO tags(name) VALUES(?1)",
            params![name],
        )?;
        let tag_id: i64 =
            conn.query_row("SELECT id FROM tags WHERE name=?1", params![name], |r| r.get(0))?;
        conn.execute(
            "INSERT OR IGNORE INTO track_tags(track_id, tag_id) VALUES(?1,?2)",
            params![id, tag_id],
        )?;
    }
    Ok(())
}

/// Insert or update a scanned track by path. Preserves user-edited church
/// fields (tono/bpm/ocasion/fav) on re-scan. Returns the track row id.
#[allow(clippy::too_many_arguments)]
pub fn upsert_track(
    conn: &Connection,
    folder_id: i64,
    path: &str,
    titulo: &str,
    artista: &str,
    album: &str,
    dur_sec: i64,
    formato: &str,
    video: bool,
    mtime: i64,
    fsize: i64,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO tracks (folder_id, path, titulo, artista, album, dur_sec, formato, video, missing, added_at, mtime, fsize)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,0,?9,?10,?11)
         ON CONFLICT(path) DO UPDATE SET
           folder_id=excluded.folder_id, titulo=excluded.titulo, artista=excluded.artista,
           album=excluded.album, dur_sec=excluded.dur_sec, formato=excluded.formato,
           video=excluded.video, missing=0, mtime=excluded.mtime, fsize=excluded.fsize",
        params![folder_id, path, titulo, artista, album, dur_sec, formato, video as i64, now(), mtime, fsize],
    )?;
    let id: i64 = conn.query_row("SELECT id FROM tracks WHERE path=?1", params![path], |r| r.get(0))?;
    Ok(id)
}

/// Row id plus the file stamp recorded for a path, if it is already indexed.
pub fn track_stamp(conn: &Connection, path: &str) -> Result<Option<(i64, i64, i64)>> {
    let mut stmt = conn.prepare("SELECT id, mtime, fsize FROM tracks WHERE path=?1")?;
    let mut rows = stmt.query(params![path])?;
    match rows.next()? {
        Some(r) => Ok(Some((r.get(0)?, r.get(1)?, r.get(2)?))),
        None => Ok(None),
    }
}

/// Re-attach an unchanged track to its folder without re-reading its metadata.
pub fn touch_existing_track(conn: &Connection, id: i64, folder_id: i64) -> Result<()> {
    conn.execute(
        "UPDATE tracks SET folder_id=?1, missing=0 WHERE id=?2",
        params![folder_id, id],
    )?;
    Ok(())
}

pub fn set_cover_path(conn: &Connection, id: i64, cover_path: &str) -> Result<()> {
    conn.execute(
        "UPDATE tracks SET cover_path=?1 WHERE id=?2",
        params![cover_path, id],
    )?;
    Ok(())
}

/// Mark a folder's tracks whose file no longer exists as missing (present ones as found).
pub fn reconcile_missing(conn: &Connection, folder_id: i64) -> Result<()> {
    let mut stmt = conn.prepare("SELECT id, path FROM tracks WHERE folder_id=?1")?;
    let rows: Vec<(i64, String)> = stmt
        .query_map(params![folder_id], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<std::result::Result<_, _>>()?;
    for (id, path) in rows {
        let missing = !std::path::Path::new(&path).exists();
        conn.execute("UPDATE tracks SET missing=?1 WHERE id=?2", params![missing as i64, id])?;
    }
    Ok(())
}

// ---------------------------------------------------------------- folders

pub fn list_folders(conn: &Connection) -> Result<Vec<Folder>> {
    let mut stmt = conn.prepare(
        "SELECT f.id, f.nombre, f.path,
                (SELECT COUNT(*) FROM tracks t WHERE t.folder_id=f.id),
                f.last_scan, f.recursive
         FROM folders f ORDER BY f.id",
    )?;
    let rows = stmt.query_map([], |r| {
        let id: i64 = r.get(0)?;
        Ok(Folder {
            id: id.to_string(),
            nombre: r.get(1)?,
            ruta: r.get(2)?,
            count: r.get(3)?,
            last_scan: r.get(4)?,
            recursive: r.get::<_, i64>(5)? != 0,
        })
    })?;
    Ok(rows.collect::<std::result::Result<_, _>>()?)
}

pub fn add_folder(conn: &Connection, path: &str, nombre: &str, recursive: bool) -> Result<i64> {
    conn.execute(
        "INSERT INTO folders(path, nombre, added_at, recursive) VALUES(?1,?2,?3,?4)
         ON CONFLICT(path) DO UPDATE SET nombre=excluded.nombre, recursive=excluded.recursive",
        params![path, nombre, now(), recursive as i64],
    )?;
    let id: i64 = conn.query_row("SELECT id FROM folders WHERE path=?1", params![path], |r| r.get(0))?;
    Ok(id)
}

/// Path and «include subfolders» setting a rescan of this folder should use.
pub fn folder_scan_target(conn: &Connection, id: i64) -> Result<(String, bool)> {
    let (path, recursive): (String, i64) = conn.query_row(
        "SELECT path, recursive FROM folders WHERE id=?1",
        params![id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    Ok((path, recursive != 0))
}

/// Delete a folder, first removing the extracted cover files of its tracks so
/// the covers directory does not accumulate orphans after the cascade delete.
pub fn remove_folder(conn: &Connection, id: i64) -> Result<()> {
    let mut stmt =
        conn.prepare("SELECT cover_path FROM tracks WHERE folder_id=?1 AND cover_path IS NOT NULL")?;
    let covers: Vec<String> = stmt
        .query_map(params![id], |r| r.get(0))?
        .collect::<std::result::Result<_, _>>()?;
    drop(stmt);
    for c in covers {
        let _ = std::fs::remove_file(&c);
    }
    conn.execute("DELETE FROM folders WHERE id=?1", params![id])?;
    Ok(())
}

/// Existing folder whose tree overlaps `path`, if any. Indexing a folder that
/// contains — or sits inside — an already indexed one would move its tracks
/// between folders and desync the counts.
pub fn overlapping_folder(conn: &Connection, path: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT path FROM folders")?;
    let existing: Vec<String> = stmt
        .query_map([], |r| r.get(0))?
        .collect::<std::result::Result<_, _>>()?;
    let new = std::path::Path::new(path);
    for other in existing {
        let o = std::path::Path::new(&other);
        if new == o {
            continue; // re-adding the same folder is a plain rescan
        }
        if new.starts_with(o) || o.starts_with(new) {
            return Ok(Some(other));
        }
    }
    Ok(None)
}

/// Re-check every indexed file, so tracks deleted while the app was closed are
/// flagged (and restored ones un-flagged) without a full rescan.
pub fn reconcile_all(conn: &Connection) -> Result<()> {
    let ids: Vec<i64> = conn
        .prepare("SELECT id FROM folders")?
        .query_map([], |r| r.get(0))?
        .collect::<std::result::Result<_, _>>()?;
    for id in ids {
        reconcile_missing(conn, id)?;
    }
    Ok(())
}

pub fn touch_folder_scan(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("UPDATE folders SET last_scan=?1 WHERE id=?2", params![now(), id])?;
    Ok(())
}

// ---------------------------------------------------------------- playlists

pub fn list_playlists(conn: &Connection) -> Result<Vec<Playlist>> {
    let mut stmt = conn.prepare("SELECT id, nombre, fecha, ocasion FROM playlists ORDER BY id")?;
    let base: Vec<(i64, String, String, String)> = stmt
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?
        .collect::<std::result::Result<_, _>>()?;

    let mut out = Vec::new();
    for (id, nombre, fecha, ocasion) in base {
        let mut ts = conn.prepare(
            "SELECT track_id FROM playlist_tracks WHERE playlist_id=?1 ORDER BY position",
        )?;
        let ids: Vec<String> = ts
            .query_map(params![id], |r| r.get::<_, i64>(0).map(|v| v.to_string()))?
            .collect::<std::result::Result<_, _>>()?;
        out.push(Playlist { id: id.to_string(), nombre, fecha, ocasion, ids });
    }
    Ok(out)
}

pub fn create_playlist(conn: &Connection, nombre: &str, fecha: &str, ocasion: &str) -> Result<i64> {
    conn.execute(
        "INSERT INTO playlists(nombre, fecha, ocasion, created_at) VALUES(?1,?2,?3,?4)",
        params![nombre, fecha, ocasion, now()],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn set_playlist_order(conn: &Connection, playlist_id: i64, ids: &[i64]) -> Result<()> {
    conn.execute("DELETE FROM playlist_tracks WHERE playlist_id=?1", params![playlist_id])?;
    for (pos, tid) in ids.iter().enumerate() {
        conn.execute(
            "INSERT INTO playlist_tracks(playlist_id, track_id, position) VALUES(?1,?2,?3)",
            params![playlist_id, tid, pos as i64],
        )?;
    }
    Ok(())
}

/// Append a track to the end of a playlist (no-op if already present).
pub fn add_to_playlist(conn: &Connection, playlist_id: i64, track_id: i64) -> Result<()> {
    let exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id=?1 AND track_id=?2",
        params![playlist_id, track_id],
        |r| r.get(0),
    )?;
    if exists > 0 {
        return Ok(());
    }
    let pos: i64 = conn.query_row(
        "SELECT COALESCE(MAX(position)+1,0) FROM playlist_tracks WHERE playlist_id=?1",
        params![playlist_id],
        |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO playlist_tracks(playlist_id, track_id, position) VALUES(?1,?2,?3)",
        params![playlist_id, track_id, pos],
    )?;
    Ok(())
}

/// Rename a playlist / change its service date and occasion.
pub fn update_playlist(
    conn: &Connection,
    id: i64,
    nombre: &str,
    fecha: &str,
    ocasion: &str,
) -> Result<()> {
    conn.execute(
        "UPDATE playlists SET nombre=?1, fecha=?2, ocasion=?3 WHERE id=?4",
        params![nombre, fecha, ocasion, id],
    )?;
    Ok(())
}

pub fn delete_playlist(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM playlists WHERE id=?1", params![id])?;
    Ok(())
}

// ---------------------------------------------------------------- settings

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    let v = conn
        .query_row("SELECT value FROM settings WHERE key=?1", params![key], |r| r.get(0))
        .ok();
    Ok(v)
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO settings(key,value) VALUES(?1,?2)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![key, value],
    )?;
    Ok(())
}

// ---------------------------------------------------------------- tests

#[cfg(test)]
mod tests {
    use super::*;

    /// Fresh in-memory database with the production schema.
    fn mem() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        conn
    }

    fn add_track(conn: &Connection, fid: i64, path: &str, titulo: &str) -> i64 {
        upsert_track(conn, fid, path, titulo, "Artista", "Album", 120, "MP3", false, 10, 100).unwrap()
    }

    #[test]
    fn upsert_preserves_user_edited_fields_on_rescan() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let id = add_track(&conn, fid, "/m/a.mp3", "A");

        update_track_meta(&conn, id, "Sol", 72, "Adoración").unwrap();
        set_fav(&conn, id, true).unwrap();
        set_track_tags(&conn, id, &["lento".into()]).unwrap();

        // A rescan re-reads tag metadata but must not clobber church fields.
        let again = add_track(&conn, fid, "/m/a.mp3", "A (retag)");
        assert_eq!(again, id);

        let t = &list_tracks(&conn).unwrap()[0];
        assert_eq!(t.titulo, "A (retag)");
        assert_eq!(t.tono, "Sol");
        assert_eq!(t.bpm, 72);
        assert_eq!(t.ocasion, "Adoración");
        assert!(t.fav);
        assert_eq!(t.tags, vec!["lento".to_string()]);
    }

    #[test]
    fn track_stamp_reports_the_recorded_file_stamp() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let id = add_track(&conn, fid, "/m/a.mp3", "A");

        assert_eq!(track_stamp(&conn, "/m/a.mp3").unwrap(), Some((id, 10, 100)));
        assert_eq!(track_stamp(&conn, "/m/missing.mp3").unwrap(), None);
    }

    #[test]
    fn touch_existing_track_reattaches_without_touching_metadata() {
        let conn = mem();
        let f1 = add_folder(&conn, "/one", "one", true).unwrap();
        let f2 = add_folder(&conn, "/two", "two", true).unwrap();
        let id = add_track(&conn, f1, "/one/a.mp3", "A");
        conn.execute("UPDATE tracks SET missing=1", []).unwrap();

        touch_existing_track(&conn, id, f2).unwrap();

        let t = &list_tracks(&conn).unwrap()[0];
        assert!(!t.missing);
        assert_eq!(t.carpeta, "two");
        assert_eq!(t.titulo, "A");
    }

    #[test]
    fn reconcile_marks_vanished_files_as_missing() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        add_track(&conn, fid, "/m/definitely-not-on-disk.mp3", "A");

        reconcile_all(&conn).unwrap();

        assert!(list_tracks(&conn).unwrap()[0].missing);
    }

    #[test]
    fn overlapping_folder_rejects_nesting_but_allows_siblings() {
        let conn = mem();
        add_folder(&conn, "/music/himnos", "himnos", true).unwrap();

        // A parent of an indexed folder, and a child of one, both overlap.
        assert_eq!(
            overlapping_folder(&conn, "/music").unwrap(),
            Some("/music/himnos".into())
        );
        assert_eq!(
            overlapping_folder(&conn, "/music/himnos/2025").unwrap(),
            Some("/music/himnos".into())
        );
        // A sibling is fine, and re-adding the same folder is just a rescan.
        assert_eq!(overlapping_folder(&conn, "/music/coros").unwrap(), None);
        assert_eq!(overlapping_folder(&conn, "/music/himnos").unwrap(), None);
    }

    #[test]
    fn remove_folder_deletes_its_tracks() {
        let conn = mem();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        add_track(&conn, fid, "/m/a.mp3", "A");

        remove_folder(&conn, fid).unwrap();

        assert!(list_tracks(&conn).unwrap().is_empty());
    }

    #[test]
    fn playlist_order_round_trips_and_add_is_idempotent() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let a = add_track(&conn, fid, "/m/a.mp3", "A");
        let b = add_track(&conn, fid, "/m/b.mp3", "B");
        let pid = create_playlist(&conn, "Culto", "hoy", "Adoración").unwrap();

        add_to_playlist(&conn, pid, a).unwrap();
        add_to_playlist(&conn, pid, b).unwrap();
        add_to_playlist(&conn, pid, a).unwrap(); // already there

        assert_eq!(list_playlists(&conn).unwrap()[0].ids, vec![a.to_string(), b.to_string()]);

        set_playlist_order(&conn, pid, &[b, a]).unwrap();
        assert_eq!(list_playlists(&conn).unwrap()[0].ids, vec![b.to_string(), a.to_string()]);
    }

    #[test]
    fn update_playlist_changes_name_date_and_occasion() {
        let conn = mem();
        let pid = create_playlist(&conn, "Sin título", "", "").unwrap();

        update_playlist(&conn, pid, "Culto 20 Jul", "Domingo 20", "Ensayo").unwrap();

        let pl = &list_playlists(&conn).unwrap()[0];
        assert_eq!(pl.nombre, "Culto 20 Jul");
        assert_eq!(pl.fecha, "Domingo 20");
        assert_eq!(pl.ocasion, "Ensayo");
    }

    #[test]
    fn folder_scan_target_returns_the_stored_recursive_choice() {
        let conn = mem();
        let shallow = add_folder(&conn, "/shallow", "shallow", false).unwrap();
        let deep = add_folder(&conn, "/deep", "deep", true).unwrap();

        assert_eq!(folder_scan_target(&conn, shallow).unwrap(), ("/shallow".into(), false));
        assert_eq!(folder_scan_target(&conn, deep).unwrap(), ("/deep".into(), true));
    }

    #[test]
    fn settings_round_trip_and_overwrite() {
        let conn = mem();
        assert_eq!(get_setting(&conn, "themeMode").unwrap(), None);
        set_setting(&conn, "themeMode", "dark").unwrap();
        set_setting(&conn, "themeMode", "system").unwrap();
        assert_eq!(get_setting(&conn, "themeMode").unwrap(), Some("system".into()));
    }
}
