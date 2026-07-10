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
  last_scan TEXT
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
  added_at  TEXT NOT NULL
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
                   JOIN tags tg ON tg.id = tt.tag_id WHERE tt.track_id = t.id)
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
) -> Result<i64> {
    conn.execute(
        "INSERT INTO tracks (folder_id, path, titulo, artista, album, dur_sec, formato, video, missing, added_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,0,?9)
         ON CONFLICT(path) DO UPDATE SET
           folder_id=excluded.folder_id, titulo=excluded.titulo, artista=excluded.artista,
           album=excluded.album, dur_sec=excluded.dur_sec, formato=excluded.formato,
           video=excluded.video, missing=0",
        params![folder_id, path, titulo, artista, album, dur_sec, formato, video as i64, now()],
    )?;
    let id: i64 = conn.query_row("SELECT id FROM tracks WHERE path=?1", params![path], |r| r.get(0))?;
    Ok(id)
}

// ---------------------------------------------------------------- folders

pub fn list_folders(conn: &Connection) -> Result<Vec<Folder>> {
    let mut stmt = conn.prepare(
        "SELECT f.id, f.nombre, f.path,
                (SELECT COUNT(*) FROM tracks t WHERE t.folder_id=f.id)
         FROM folders f ORDER BY f.id",
    )?;
    let rows = stmt.query_map([], |r| {
        let id: i64 = r.get(0)?;
        Ok(Folder {
            id: id.to_string(),
            nombre: r.get(1)?,
            ruta: r.get(2)?,
            count: r.get(3)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<_, _>>()?)
}

pub fn add_folder(conn: &Connection, path: &str, nombre: &str) -> Result<i64> {
    conn.execute(
        "INSERT INTO folders(path, nombre, added_at) VALUES(?1,?2,?3)
         ON CONFLICT(path) DO UPDATE SET nombre=excluded.nombre",
        params![path, nombre, now()],
    )?;
    let id: i64 = conn.query_row("SELECT id FROM folders WHERE path=?1", params![path], |r| r.get(0))?;
    Ok(id)
}

pub fn remove_folder(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM folders WHERE id=?1", params![id])?;
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
