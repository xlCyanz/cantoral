use anyhow::{bail, Context, Result};
use rusqlite::{params, Connection, OpenFlags};
use std::path::Path;
use std::sync::Mutex;

use crate::models::{fmt_dur, Folder, Playlist, Track};

/// Tauri-managed database handle.
pub struct Db(pub Mutex<Connection>);

pub const SCHEMA: &str = r#"
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

/// Every track's tags, keyed by track id and sorted by name.
///
/// Read as rows rather than a `group_concat` string: a tag is free text the user
/// types, so a comma in one of them used to come back as two tags. Grouping here
/// also makes the order deterministic, which `group_concat` never promised.
fn tags_by_track(conn: &Connection) -> Result<std::collections::HashMap<i64, Vec<String>>> {
    let mut stmt = conn.prepare(
        "SELECT tt.track_id, tg.name
         FROM track_tags tt JOIN tags tg ON tg.id = tt.tag_id
         ORDER BY tg.name",
    )?;
    let mut out: std::collections::HashMap<i64, Vec<String>> = std::collections::HashMap::new();
    let rows = stmt.query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?)))?;
    for row in rows {
        let (track_id, name) = row?;
        out.entry(track_id).or_default().push(name);
    }
    Ok(out)
}

pub fn list_tracks(conn: &Connection) -> Result<Vec<Track>> {
    let mut tags_of = tags_by_track(conn)?;
    let mut stmt = conn.prepare(
        "SELECT t.id, t.path, t.titulo, t.artista, t.album, t.dur_sec, t.formato,
                t.tono, t.bpm, t.ocasion, t.fav, t.missing, t.video,
                COALESCE(f.nombre,''),
                t.cover_path
         FROM tracks t LEFT JOIN folders f ON f.id = t.folder_id
         ORDER BY t.id",
    )?;
    let rows = stmt.query_map([], |r| {
        let id: i64 = r.get(0)?;
        let dur_sec: i64 = r.get(5)?;
        let tags = tags_of.remove(&id).unwrap_or_default();
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
            cover: r.get::<_, Option<String>>(14)?,
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

/// Tidy a tag the user typed: trim it and collapse runs of whitespace, so
/// «  lento   suave » and «lento suave» are the same tag rather than two.
fn normalise_tag(raw: &str) -> String {
    raw.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Delete tags no track points at any more.
///
/// Without this, correcting a typo left the misspelled tag in the table for
/// good — invisible today, but every tag picker and autocomplete would show it.
fn drop_orphan_tags(conn: &Connection) -> Result<usize> {
    Ok(conn.execute(
        "DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM track_tags)",
        [],
    )?)
}

/// Replace a track's tags. Runs as one transaction: the delete and the inserts
/// are the same edit, and half of it applied is a track that silently lost its
/// tags.
pub fn set_track_tags(conn: &Connection, id: i64, tags: &[String]) -> Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM track_tags WHERE track_id=?1", params![id])?;
    for raw in tags {
        let name = normalise_tag(raw);
        if name.is_empty() {
            continue;
        }
        tx.execute("INSERT OR IGNORE INTO tags(name) VALUES(?1)", params![name])?;
        let tag_id: i64 =
            tx.query_row("SELECT id FROM tags WHERE name=?1", params![name], |r| r.get(0))?;
        tx.execute(
            "INSERT OR IGNORE INTO track_tags(track_id, tag_id) VALUES(?1,?2)",
            params![id, tag_id],
        )?;
    }
    drop_orphan_tags(&tx)?;
    tx.commit()?;
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
    let mut stmt = conn.prepare("SELECT id, path, missing FROM tracks WHERE folder_id=?1")?;
    let rows: Vec<(i64, String, i64)> = stmt
        .query_map(params![folder_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
        .collect::<std::result::Result<_, _>>()?;
    drop(stmt);

    // One transaction for the whole folder. Each UPDATE used to commit on its
    // own, so reconciling a few thousand tracks at startup meant a few thousand
    // fsyncs — and only the rows that actually changed are written now, which in
    // the normal case (nothing moved) is none of them.
    let tx = conn.unchecked_transaction()?;
    for (id, path, was_missing) in rows {
        let missing = !std::path::Path::new(&path).exists();
        if missing as i64 != was_missing {
            tx.execute(
                "UPDATE tracks SET missing=?1 WHERE id=?2",
                params![missing as i64, id],
            )?;
        }
    }
    tx.commit()?;
    Ok(())
}

/// Id of the indexed folder whose tree contains `path`, if any.
fn folder_containing(conn: &Connection, path: &Path) -> Result<Option<i64>> {
    let mut stmt = conn.prepare("SELECT id, path FROM folders")?;
    let rows: Vec<(i64, String)> = stmt
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<std::result::Result<_, _>>()?;
    // Deepest match wins, so a nested folder is preferred over its parent.
    Ok(rows
        .into_iter()
        .filter(|(_, root)| path.starts_with(root))
        .max_by_key(|(_, root)| root.chars().count())
        .map(|(id, _)| id))
}

/// Point a track at the file's new location, keeping everything the user put on
/// it — tags, favourite, key, tempo, occasion.
///
/// The file stamp is taken from the new file, so the next scan sees it as
/// unchanged and does not re-read its metadata. If the new location falls inside
/// another indexed folder, the track moves to it.
pub fn relocate_track(conn: &Connection, id: i64, new_path: &Path) -> Result<()> {
    if !new_path.is_file() {
        bail!("«{}» no es un archivo.", new_path.display());
    }
    let new_str = new_path.to_string_lossy().to_string();

    let taken: Option<i64> = conn
        .query_row(
            "SELECT id FROM tracks WHERE path=?1 AND id<>?2",
            params![new_str, id],
            |r| r.get(0),
        )
        .ok();
    if taken.is_some() {
        bail!("Ese archivo ya está en la biblioteca como otra pista.");
    }

    let (mtime, fsize) = match std::fs::metadata(new_path) {
        Ok(m) => (
            m.modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0),
            m.len() as i64,
        ),
        Err(_) => (0, 0),
    };
    let folder_id = folder_containing(conn, new_path)?;

    match folder_id {
        Some(fid) => conn.execute(
            "UPDATE tracks SET path=?1, mtime=?2, fsize=?3, missing=0, folder_id=?4 WHERE id=?5",
            params![new_str, mtime, fsize, fid, id],
        )?,
        None => conn.execute(
            "UPDATE tracks SET path=?1, mtime=?2, fsize=?3, missing=0 WHERE id=?4",
            params![new_str, mtime, fsize, id],
        )?,
    };
    Ok(())
}

/// Remove a single track from the catalogue, with its extracted cover.
///
/// Its rows in `track_tags` and `playlist_tracks` go with it through the
/// cascade, so a service list that referenced it simply gets shorter rather
/// than pointing at nothing.
pub fn delete_track(conn: &Connection, id: i64) -> Result<()> {
    let cover: Option<String> = conn
        .query_row("SELECT cover_path FROM tracks WHERE id=?1", params![id], |r| r.get(0))
        .ok()
        .flatten();
    if let Some(c) = cover {
        let _ = std::fs::remove_file(c);
    }
    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM tracks WHERE id=?1", params![id])?;
    // The cascade clears track_tags but leaves the tag names behind.
    drop_orphan_tags(&tx)?;
    tx.commit()?;
    Ok(())
}

/// Point a whole indexed folder at its new location, rewriting the path of every
/// track under it.
///
/// This is the case that actually happens — the music moved to another drive, or
/// Windows handed it a different letter. Doing it track by track would be
/// hundreds of dialogs, and the alternative people reach for today (remove the
/// folder and add it again) destroys every tag and favourite it held.
///
/// Returns how many tracks were rewritten.
pub fn relocate_folder(conn: &Connection, id: i64, new_root: &Path) -> Result<i64> {
    if !new_root.is_dir() {
        bail!("«{}» no es una carpeta.", new_root.display());
    }
    let new_str = new_root.to_string_lossy().to_string();

    let old: String = conn.query_row("SELECT path FROM folders WHERE id=?1", params![id], |r| {
        r.get(0)
    })?;
    if old == new_str {
        return Ok(0);
    }
    if let Some(other) = overlapping_folder(conn, &new_str)? {
        if other != old {
            bail!(
                "«{}» se cruza con la carpeta ya indexada «{}».",
                new_str,
                other
            );
        }
    }

    let tx = conn.unchecked_transaction()?;
    tx.execute("UPDATE folders SET path=?1 WHERE id=?2", params![new_str, id])?;
    // Rewrite the prefix only for tracks that actually sit under the old root;
    // one that was relocated elsewhere by hand keeps its own path.
    let old_len = old.chars().count() as i64;
    let n = tx.execute(
        "UPDATE tracks SET path = ?1 || substr(path, ?2 + 1)
         WHERE folder_id = ?3 AND substr(path, 1, ?2) = ?4",
        params![new_str, old_len, id, old],
    )?;
    tx.commit()?;

    reconcile_missing(conn, id)?;
    Ok(n as i64)
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
    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM folders WHERE id=?1", params![id])?;
    // Its tracks go with it through the cascade, and their tags with them.
    drop_orphan_tags(&tx)?;
    tx.commit()?;
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

/// Replace a playlist's order wholesale.
///
/// One transaction, because the delete and the inserts are a single edit. The
/// delete used to commit by itself, so an insert that failed part way — a track
/// deleted between the drag and the save trips the foreign key — left the
/// service list truncated at whatever row had been reached.
pub fn set_playlist_order(conn: &Connection, playlist_id: i64, ids: &[i64]) -> Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM playlist_tracks WHERE playlist_id=?1",
        params![playlist_id],
    )?;
    for (pos, tid) in ids.iter().enumerate() {
        tx.execute(
            "INSERT INTO playlist_tracks(playlist_id, track_id, position) VALUES(?1,?2,?3)",
            params![playlist_id, tid, pos as i64],
        )?;
    }
    tx.commit()?;
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

// ---------------------------------------------------------------- backup / restore

/// Tables a Cantoral database always has. Used to tell a real backup apart from
/// some other `.db` the user picked by mistake in the file dialog.
const REQUIRED_TABLES: &[&str] = &[
    "folders",
    "tracks",
    "playlists",
    "playlist_tracks",
    "tags",
    "track_tags",
    "settings",
];

/// What a candidate backup file holds. Reported before anything is overwritten
/// so the user can be told what they are about to restore.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub tracks: i64,
    pub folders: i64,
    pub playlists: i64,
}

/// Read `path` without modifying it and confirm it is a Cantoral database.
///
/// Opened read-only, so a file that is not SQLite at all fails here rather than
/// after the live database has already been replaced.
pub fn inspect_backup(path: &Path) -> Result<BackupInfo> {
    if !path.exists() {
        bail!("El archivo «{}» no existe.", path.display());
    }
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .with_context(|| format!("«{}» no se pudo abrir como base de datos.", path.display()))?;

    let mut present = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .context("El archivo no parece una base de datos SQLite.")?;
    let names: Vec<String> = present
        .query_map([], |r| r.get(0))
        .context("El archivo no parece una base de datos SQLite.")?
        .collect::<std::result::Result<_, _>>()?;
    drop(present);

    let missing: Vec<&str> = REQUIRED_TABLES
        .iter()
        .copied()
        .filter(|t| !names.iter().any(|n| n == t))
        .collect();
    if !missing.is_empty() {
        bail!(
            "El archivo no es un respaldo de Cantoral: le faltan las tablas {}.",
            missing.join(", ")
        );
    }

    let count = |table: &str| -> Result<i64> {
        Ok(conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))?)
    };
    Ok(BackupInfo {
        tracks: count("tracks")?,
        folders: count("folders")?,
        playlists: count("playlists")?,
    })
}

/// The sidecar files SQLite keeps beside a database in WAL mode.
fn sidecars(live: &Path) -> [std::path::PathBuf; 2] {
    [live.with_extension("db-wal"), live.with_extension("db-shm")]
}

/// Replace the database at `live` with the backup at `src`, and open it.
///
/// The caller must have closed its own connection first, or the files cannot be
/// moved on Windows.
///
/// The previous database is **moved aside, never deleted**: if the copy or the
/// open fails, it is put back and the error propagates, so a bad restore leaves
/// the library exactly as it was. Deleting the WAL before knowing the new file
/// is sound is how a failed restore used to take committed data with it.
pub fn restore_from_backup(live: &Path, src: &Path) -> Result<Connection> {
    // Validate before touching anything on disk.
    inspect_backup(src)?;

    let rollback = live.with_extension("db.rollback");
    let rollback_sidecars = [
        live.with_extension("db-wal.rollback"),
        live.with_extension("db-shm.rollback"),
    ];
    for p in [&[rollback.clone()][..], &rollback_sidecars[..]].concat() {
        let _ = std::fs::remove_file(p);
    }

    let had_live = live.exists();
    if had_live {
        std::fs::rename(live, &rollback)
            .with_context(|| "No se pudo apartar la base de datos actual.")?;
    }
    for (from, to) in sidecars(live).iter().zip(rollback_sidecars.iter()) {
        if from.exists() {
            let _ = std::fs::rename(from, to);
        }
    }

    let restore_previous = || {
        let _ = std::fs::remove_file(live);
        if had_live {
            let _ = std::fs::rename(&rollback, live);
        }
        for (from, to) in rollback_sidecars.iter().zip(sidecars(live).iter()) {
            if from.exists() {
                let _ = std::fs::rename(from, to);
            }
        }
    };

    if let Err(err) = std::fs::copy(src, live) {
        restore_previous();
        return Err(anyhow::Error::new(err).context("No se pudo copiar el respaldo."));
    }
    let conn = match open_and_migrate(live) {
        Ok(conn) => conn,
        Err(err) => {
            restore_previous();
            return Err(err.context("El respaldo no se pudo abrir tras copiarlo."));
        }
    };

    // The restore is committed; the copy kept for rollback is no longer needed.
    let _ = std::fs::remove_file(&rollback);
    for p in &rollback_sidecars {
        let _ = std::fs::remove_file(p);
    }
    Ok(conn)
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

    /// Temp directory holding a live database and any candidate backups.
    struct Dir(std::path::PathBuf);

    impl Dir {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!("cantoral-restore-{name}"));
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).unwrap();
            Dir(dir)
        }
        fn path(&self, name: &str) -> std::path::PathBuf {
            self.0.join(name)
        }
        /// A real Cantoral database holding one folder and `tracks` tracks.
        fn database(&self, name: &str, tracks: usize) -> std::path::PathBuf {
            let path = self.path(name);
            let conn = open_and_migrate(&path).unwrap();
            let fid = add_folder(&conn, "/m", "m", true).unwrap();
            for i in 0..tracks {
                add_track(&conn, fid, &format!("/m/{i}.mp3"), &format!("Pista {i}"));
            }
            conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);").unwrap();
            drop(conn);
            path
        }
    }

    impl Drop for Dir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn inspect_backup_reports_what_the_file_holds() {
        let dir = Dir::new("inspect-ok");
        let backup = dir.database("backup.db", 3);

        let info = inspect_backup(&backup).unwrap();

        assert_eq!(info.tracks, 3);
        assert_eq!(info.folders, 1);
        assert_eq!(info.playlists, 0);
    }

    #[test]
    fn inspect_backup_refuses_anything_that_is_not_a_cantoral_database() {
        let dir = Dir::new("inspect-bad");

        // Not SQLite at all.
        let garbage = dir.path("notas.db");
        std::fs::write(&garbage, b"esto no es una base de datos").unwrap();
        assert!(inspect_backup(&garbage).is_err(), "un archivo cualquiera debe rechazarse");

        // Valid SQLite, but another application's schema.
        let foreign = dir.path("otra.db");
        let conn = Connection::open(&foreign).unwrap();
        conn.execute_batch("CREATE TABLE cosas (id INTEGER);").unwrap();
        drop(conn);
        assert!(inspect_backup(&foreign).is_err(), "otro esquema debe rechazarse");

        // A path that does not exist.
        assert!(inspect_backup(&dir.path("no-existe.db")).is_err());
    }

    #[test]
    fn restore_replaces_the_library_with_the_backup() {
        let dir = Dir::new("restore-ok");
        let live = dir.database("cantoral.db", 2);
        let backup = dir.database("backup.db", 5);

        let conn = restore_from_backup(&live, &backup).unwrap();

        assert_eq!(list_tracks(&conn).unwrap().len(), 5, "la biblioteca es la del respaldo");
        // Nothing is left behind from the rollback copy.
        assert!(!live.with_extension("db.rollback").exists());
    }

    /// The regression this whole path exists for: a restore that cannot go
    /// through must leave the library exactly as it was, not half replaced.
    #[test]
    fn a_rejected_backup_leaves_the_live_database_untouched() {
        let dir = Dir::new("restore-rollback");
        let live = dir.database("cantoral.db", 4);
        let before = std::fs::read(&live).unwrap();

        let garbage = dir.path("respaldo-corrupto.db");
        std::fs::write(&garbage, b"no soy sqlite").unwrap();

        assert!(restore_from_backup(&live, &garbage).is_err());

        assert_eq!(std::fs::read(&live).unwrap(), before, "el archivo no se tocó");
        let conn = open_and_migrate(&live).unwrap();
        assert_eq!(list_tracks(&conn).unwrap().len(), 4, "las pistas siguen ahí");
    }

    #[test]
    fn restoring_onto_a_missing_database_still_works() {
        // First run after a fresh install, or after the file was deleted by hand.
        let dir = Dir::new("restore-sin-base");
        let live = dir.path("cantoral.db");
        let backup = dir.database("backup.db", 2);

        let conn = restore_from_backup(&live, &backup).unwrap();

        assert_eq!(list_tracks(&conn).unwrap().len(), 2);
    }

    /// Temp tree with real files, for the paths that must exist on disk.
    struct Files(std::path::PathBuf);

    impl Files {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!("cantoral-reloc-{name}"));
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).unwrap();
            Files(dir)
        }
        fn dir(&self, rel: &str) -> std::path::PathBuf {
            let p = self.0.join(rel);
            std::fs::create_dir_all(&p).unwrap();
            p
        }
        fn file(&self, rel: &str) -> std::path::PathBuf {
            let p = self.0.join(rel);
            std::fs::create_dir_all(p.parent().unwrap()).unwrap();
            std::fs::write(&p, b"audio").unwrap();
            p
        }
        fn s(&self, rel: &str) -> String {
            self.0.join(rel).to_string_lossy().to_string()
        }
    }

    impl Drop for Files {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn relocating_a_track_keeps_everything_the_user_put_on_it() {
        let files = Files::new("track-ok");
        let conn = mem();
        let fid = add_folder(&conn, &files.s("Himnos"), "Himnos", true).unwrap();
        let id = add_track(&conn, fid, &files.s("Himnos/viejo.mp3"), "Sublime Gracia");
        update_track_meta(&conn, id, "Sol", 72, "Adoración").unwrap();
        set_fav(&conn, id, true).unwrap();
        set_track_tags(&conn, id, &["lento".into()]).unwrap();
        conn.execute("UPDATE tracks SET missing=1", []).unwrap();

        let nuevo = files.file("Himnos/nuevo.mp3");
        relocate_track(&conn, id, &nuevo).unwrap();

        let t = &list_tracks(&conn).unwrap()[0];
        assert_eq!(t.path, nuevo.to_string_lossy());
        assert!(!t.missing, "deja de estar marcada como faltante");
        // Lo que costó trabajo poner sigue ahí.
        assert_eq!(t.tono, "Sol");
        assert_eq!(t.bpm, 72);
        assert_eq!(t.ocasion, "Adoración");
        assert!(t.fav);
        assert_eq!(t.tags, vec!["lento".to_string()]);
        assert_eq!(t.titulo, "Sublime Gracia");
    }

    #[test]
    fn relocating_refuses_a_path_that_is_not_a_file_or_is_already_taken() {
        let files = Files::new("track-bad");
        let conn = mem();
        let fid = add_folder(&conn, &files.s("m"), "m", true).unwrap();
        let a = add_track(&conn, fid, &files.s("m/a.mp3"), "A");
        let ocupado = files.file("m/b.mp3");
        add_track(&conn, fid, &ocupado.to_string_lossy(), "B");

        assert!(relocate_track(&conn, a, &files.0.join("no-existe.mp3")).is_err());
        assert!(relocate_track(&conn, a, &files.dir("m")).is_err(), "una carpeta no es un archivo");
        assert!(relocate_track(&conn, a, &ocupado).is_err(), "ya es otra pista");
    }

    #[test]
    fn a_relocated_track_joins_the_indexed_folder_that_now_contains_it() {
        let files = Files::new("track-folder");
        let conn = mem();
        let himnos = add_folder(&conn, &files.s("Himnos"), "Himnos", true).unwrap();
        add_folder(&conn, &files.s("Coros"), "Coros", true).unwrap();
        let id = add_track(&conn, himnos, &files.s("Himnos/a.mp3"), "A");

        relocate_track(&conn, id, &files.file("Coros/a.mp3")).unwrap();

        assert_eq!(list_tracks(&conn).unwrap()[0].carpeta, "Coros");
    }

    #[test]
    fn deleting_a_track_also_takes_it_out_of_every_list() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let a = add_track(&conn, fid, "/m/a.mp3", "A");
        let b = add_track(&conn, fid, "/m/b.mp3", "B");
        let pid = create_playlist(&conn, "Culto", "", "").unwrap();
        set_playlist_order(&conn, pid, &[a, b]).unwrap();
        set_track_tags(&conn, a, &["lento".into()]).unwrap();

        delete_track(&conn, a).unwrap();

        assert_eq!(list_tracks(&conn).unwrap().len(), 1);
        // La lista se acorta en vez de apuntar a la nada.
        assert_eq!(list_playlists(&conn).unwrap()[0].ids, vec![b.to_string()]);
    }

    #[test]
    fn relocating_a_folder_rewrites_every_track_under_it() {
        let files = Files::new("folder-ok");
        let conn = mem();
        let viejo = files.s("DiscoViejo/Himnos");
        let fid = add_folder(&conn, &viejo, "Himnos", true).unwrap();
        add_track(&conn, fid, &format!("{viejo}/a.mp3"), "A");
        add_track(&conn, fid, &format!("{viejo}/2025/b.mp3"), "B");
        files.file("DiscoNuevo/Himnos/a.mp3");
        files.file("DiscoNuevo/Himnos/2025/b.mp3");
        let nuevo = files.dir("DiscoNuevo/Himnos");

        let n = relocate_folder(&conn, fid, &nuevo).unwrap();

        assert_eq!(n, 2, "las dos pistas, incluida la anidada");
        let tracks = list_tracks(&conn).unwrap();
        assert!(tracks.iter().all(|t| t.path.starts_with(&nuevo.to_string_lossy().to_string())));
        assert!(tracks.iter().all(|t| !t.missing), "los archivos están donde ahora apuntan");
        assert_eq!(list_folders(&conn).unwrap()[0].ruta, nuevo.to_string_lossy());
    }

    #[test]
    fn relocating_a_folder_refuses_to_land_on_another_indexed_one() {
        let files = Files::new("folder-overlap");
        let conn = mem();
        let fid = add_folder(&conn, &files.s("A"), "A", true).unwrap();
        add_folder(&conn, &files.s("B"), "B", true).unwrap();

        assert!(relocate_folder(&conn, fid, &files.dir("B/dentro")).is_err());
        assert!(relocate_folder(&conn, fid, &files.0.join("no-existe")).is_err());
    }

    // ------------------------------------------------ etiquetas (#9)

    #[test]
    fn a_tag_with_a_comma_survives_the_round_trip() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let id = add_track(&conn, fid, "/m/a.mp3", "A");

        set_track_tags(&conn, id, &["lento, meditativo".into()]).unwrap();

        // Con group_concat volvían dos: "lento" y " meditativo".
        assert_eq!(
            list_tracks(&conn).unwrap()[0].tags,
            vec!["lento, meditativo".to_string()]
        );
    }

    #[test]
    fn tags_come_back_in_a_stable_order() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let id = add_track(&conn, fid, "/m/a.mp3", "A");

        set_track_tags(&conn, id, &["zeta".into(), "alfa".into(), "media".into()]).unwrap();

        assert_eq!(
            list_tracks(&conn).unwrap()[0].tags,
            vec!["alfa".to_string(), "media".to_string(), "zeta".to_string()]
        );
    }

    #[test]
    fn a_tag_is_tidied_so_spacing_does_not_create_duplicates() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let a = add_track(&conn, fid, "/m/a.mp3", "A");
        let b = add_track(&conn, fid, "/m/b.mp3", "B");

        set_track_tags(&conn, a, &["  lento   suave ".into()]).unwrap();
        set_track_tags(&conn, b, &["lento suave".into()]).unwrap();

        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM tags", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 1, "es la misma etiqueta, no dos");
    }

    #[test]
    fn correcting_a_typo_does_not_leave_the_old_tag_behind() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let id = add_track(&conn, fid, "/m/a.mp3", "A");

        set_track_tags(&conn, id, &["lemto".into()]).unwrap();
        set_track_tags(&conn, id, &["lento".into()]).unwrap();

        let names: Vec<String> = conn
            .prepare("SELECT name FROM tags")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<std::result::Result<_, _>>()
            .unwrap();
        assert_eq!(names, vec!["lento".to_string()], "la mal escrita se va");
    }

    #[test]
    fn deleting_the_last_track_that_used_a_tag_takes_the_tag_with_it() {
        let conn = mem();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let a = add_track(&conn, fid, "/m/a.mp3", "A");
        let b = add_track(&conn, fid, "/m/b.mp3", "B");
        set_track_tags(&conn, a, &["solo-de-a".into(), "compartida".into()]).unwrap();
        set_track_tags(&conn, b, &["compartida".into()]).unwrap();

        delete_track(&conn, a).unwrap();

        let names: Vec<String> = conn
            .prepare("SELECT name FROM tags")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<std::result::Result<_, _>>()
            .unwrap();
        assert_eq!(names, vec!["compartida".to_string()], "la compartida se queda");
    }

    // ------------------------------------------------ escrituras atómicas (#8)

    /// Lo que este issue existe para arreglar: media escritura aplicada dejaba
    /// el repertorio del culto cortado por donde hubiera llegado.
    #[test]
    fn a_playlist_order_that_cannot_be_saved_leaves_the_previous_one_intact() {
        let conn = mem();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let a = add_track(&conn, fid, "/m/a.mp3", "A");
        let b = add_track(&conn, fid, "/m/b.mp3", "B");
        let c = add_track(&conn, fid, "/m/c.mp3", "C");
        let pid = create_playlist(&conn, "Culto", "", "").unwrap();
        set_playlist_order(&conn, pid, &[a, b, c]).unwrap();

        // 9999 no existe: la clave foránea hace fallar el tercer INSERT.
        let err = set_playlist_order(&conn, pid, &[c, b, 9999]);

        assert!(err.is_err());
        assert_eq!(
            list_playlists(&conn).unwrap()[0].ids,
            vec![a.to_string(), b.to_string(), c.to_string()],
            "el orden anterior sigue completo"
        );
    }

    #[test]
    fn reconcile_only_writes_the_rows_that_actually_changed() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        add_track(&conn, fid, "/m/no-existe.mp3", "A");

        reconcile_missing(&conn, fid).unwrap();
        let after_first = conn.total_changes();
        // Nada se movió entre una pasada y la siguiente.
        reconcile_missing(&conn, fid).unwrap();

        assert_eq!(
            conn.total_changes(),
            after_first,
            "una segunda pasada sin cambios no escribe nada"
        );
        assert!(list_tracks(&conn).unwrap()[0].missing);
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
