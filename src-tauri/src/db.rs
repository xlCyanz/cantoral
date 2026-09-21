use anyhow::{bail, Context, Result};
use rusqlite::{params, Connection, OpenFlags};
use std::path::Path;
use std::sync::Mutex;

use crate::models::{fmt_dur, DuplicateGroup, DuplicateTrack, Folder, Playlist, Sheet, Track};

/// Tauri-managed database handle.
pub struct Db(pub Mutex<Connection>);

/// SQL that is true when a track has something written on its sheet.
///
/// The blanks are spelled out because SQLite's one-argument `TRIM` only strips
/// spaces: a sheet holding nothing but newlines — what the editor leaves behind
/// when it is opened and closed again — counted as written on.
const CON_HOJA: &str = "(TRIM(letra, ' ' || char(9) || char(10) || char(13)) <> '' \
     OR TRIM(acordes, ' ' || char(9) || char(10) || char(13)) <> '')";

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
  fsize     INTEGER NOT NULL DEFAULT 0,
  letra     TEXT NOT NULL DEFAULT '',
  acordes   TEXT NOT NULL DEFAULT ''
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

CREATE TABLE IF NOT EXISTS duplicate_dismissals (
  signature    TEXT PRIMARY KEY,
  dismissed_at TEXT NOT NULL
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
    let _ = conn.execute("ALTER TABLE tracks ADD COLUMN letra TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE tracks ADD COLUMN acordes TEXT NOT NULL DEFAULT ''", []);
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
    let mut stmt = conn.prepare(&format!(
        "SELECT t.id, t.path, t.titulo, t.artista, t.album, t.dur_sec, t.formato,
                t.tono, t.bpm, t.ocasion, t.fav, t.missing, t.video,
                COALESCE(f.nombre,''),
                t.cover_path,
                {CON_HOJA}
         FROM tracks t LEFT JOIN folders f ON f.id = t.folder_id
         ORDER BY t.id"
    ))?;
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
            tiene_hoja: r.get::<_, i64>(15)? != 0,
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

/// Point a track at its extracted cover, deleting the file it replaces.
///
/// Covers are named `{id}.{ext}`, so re-scanning a track whose embedded art
/// changed format — jpg to png — writes a new file and leaves the old one on
/// disk with nothing referring to it. Only `remove_folder` ever cleaned covers,
/// and only the ones still referenced.
pub fn set_cover_path(conn: &Connection, id: i64, cover_path: &str) -> Result<()> {
    let anterior: Option<String> = conn
        .query_row("SELECT cover_path FROM tracks WHERE id=?1", params![id], |r| r.get(0))
        .ok()
        .flatten();
    conn.execute(
        "UPDATE tracks SET cover_path=?1 WHERE id=?2",
        params![cover_path, id],
    )?;
    if let Some(viejo) = anterior {
        if viejo != cover_path {
            let _ = std::fs::remove_file(viejo);
        }
    }
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

// ---------------------------------------------------------------- tags

/// Rename a tag, folding it into an existing one when the new name is taken.
///
/// Renaming «Lento» to «lento» when both exist is not an error, it is the fix:
/// `tags.name` is case-sensitive, so the two were separate tags nobody could
/// see were separate. Both cases end with one tag carrying every track that had
/// either, which is what the user asked for by typing the other name.
///
/// Returns how many tracks ended up on the surviving tag.
pub fn rename_tag(conn: &Connection, from: &str, to: &str) -> Result<i64> {
    let nuevo = normalise_tag(to);
    if nuevo.is_empty() {
        bail!("una etiqueta no puede quedarse sin nombre");
    }
    let viejo_id: i64 = conn
        .query_row("SELECT id FROM tags WHERE name=?1", params![from], |r| r.get(0))
        .with_context(|| format!("la etiqueta «{from}» ya no existe"))?;

    let tx = conn.unchecked_transaction()?;
    let destino: Option<i64> = tx
        .query_row("SELECT id FROM tags WHERE name=?1", params![nuevo], |r| r.get(0))
        .ok();
    let id_final = match destino {
        Some(otro) if otro != viejo_id => {
            // `OR IGNORE` for the tracks that already carried both: they end up
            // with the tag once, not with a duplicate row.
            tx.execute(
                "UPDATE OR IGNORE track_tags SET tag_id=?1 WHERE tag_id=?2",
                params![otro, viejo_id],
            )?;
            tx.execute("DELETE FROM tags WHERE id=?1", params![viejo_id])?;
            otro
        }
        _ => {
            tx.execute("UPDATE tags SET name=?1 WHERE id=?2", params![nuevo, viejo_id])?;
            viejo_id
        }
    };
    let total: i64 = tx.query_row(
        "SELECT COUNT(*) FROM track_tags WHERE tag_id=?1",
        params![id_final],
        |r| r.get(0),
    )?;
    tx.commit()?;
    Ok(total)
}

/// Remove a tag from every track that carried it.
///
/// The tracks themselves are untouched; only the label goes.
pub fn delete_tag(conn: &Connection, name: &str) -> Result<()> {
    let filas = conn.execute("DELETE FROM tags WHERE name=?1", params![name])?;
    if filas == 0 {
        bail!("la etiqueta «{name}» ya no existe");
    }
    Ok(())
}

// ---------------------------------------------------------------- sheets

/// The lyrics and chords of one track.
pub fn track_sheet(conn: &Connection, id: i64) -> Result<Sheet> {
    let (letra, acordes): (String, String) = conn.query_row(
        "SELECT letra, acordes FROM tracks WHERE id=?1",
        params![id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    Ok(Sheet { track_id: id.to_string(), letra, acordes })
}

/// The sheets of several tracks at once, for a whole service list.
///
/// Only the tracks that actually have something written come back, so an
/// eleven-song list with two sheets costs two rows rather than eleven.
pub fn sheets_for(conn: &Connection, ids: &[i64]) -> Result<Vec<Sheet>> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let lista = lista_de_ids(ids);
    let mut stmt = conn.prepare(&format!(
        "SELECT id, letra, acordes FROM tracks
         WHERE id IN ({lista}) AND {CON_HOJA}
         ORDER BY id"
    ))?;
    let rows = stmt.query_map([], |r| {
        Ok(Sheet {
            track_id: r.get::<_, i64>(0)?.to_string(),
            letra: r.get(1)?,
            acordes: r.get(2)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<_, _>>()?)
}

/// Write a track's lyrics and chords.
pub fn set_track_sheet(conn: &Connection, id: i64, letra: &str, acordes: &str) -> Result<()> {
    let filas = conn.execute(
        "UPDATE tracks SET letra=?1, acordes=?2 WHERE id=?3",
        params![letra, acordes, id],
    )?;
    if filas == 0 {
        bail!("la pista ya no está en la biblioteca");
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

/// Id of an already indexed folder with this exact path, if there is one.
pub fn folder_id_by_path(conn: &Connection, path: &str) -> Result<Option<i64>> {
    Ok(conn
        .query_row("SELECT id FROM folders WHERE path=?1", params![path], |r| r.get(0))
        .ok())
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

// ---------------------------------------------------------------- duplicates

/// Seconds two copies of the same song may differ by and still be grouped.
/// Re-encoding the same recording shifts its length by a moment, not a verse.
const TOLERANCIA_SEG: i64 = 3;

/// Tails a copied file grows that say nothing about which song it is.
///
/// Deliberately short and Spanish-first. Every word added here is a chance to
/// fuse two songs that only looked alike, and missing a duplicate costs the
/// user a scroll — fusing the wrong pair costs them a song.
const RUIDO: &[&str] = &[
    "final", "finales", "copia", "copy", "nuevo", "nueva", "new", "master", "mix", "remix",
    "vivo", "live", "demo", "editado", "edit", "version",
];

/// Fold a title or artist down to what two copies of the same song share.
///
/// Anything inside brackets goes — `(en vivo)`, `[remix]` — along with accents,
/// case and punctuation. Accents are mapped by hand rather than pulled in
/// through a Unicode crate: the catalogue is Spanish, and these are the letters
/// that actually turn up in it.
fn normalise_song(raw: &str) -> String {
    let mut plano = String::with_capacity(raw.len());
    let mut dentro = 0usize;
    for c in raw.chars() {
        match c {
            '(' | '[' | '{' => {
                dentro += 1;
                plano.push(' ');
                continue;
            }
            ')' | ']' | '}' => {
                dentro = dentro.saturating_sub(1);
                plano.push(' ');
                continue;
            }
            _ => {}
        }
        if dentro > 0 {
            continue;
        }
        let bajo = c.to_lowercase().next().unwrap_or(c);
        let sin_tilde = match bajo {
            'á' | 'à' | 'ä' | 'â' => 'a',
            'é' | 'è' | 'ë' | 'ê' => 'e',
            'í' | 'ì' | 'ï' | 'î' => 'i',
            'ó' | 'ò' | 'ö' | 'ô' => 'o',
            'ú' | 'ù' | 'ü' | 'û' => 'u',
            'ñ' => 'n',
            otro => otro,
        };
        plano.push(if sin_tilde.is_alphanumeric() { sin_tilde } else { ' ' });
    }

    // Trim the tail from the end inwards: «coro final 2» is «coro», but
    // «salmo 23» keeps its number, because nothing noisy precedes it.
    let mut palabras: Vec<&str> = plano.split_whitespace().collect();
    while let Some(ultima) = palabras.last() {
        let es_ruido = RUIDO.contains(ultima);
        // A bare number only goes when it trails a noise word — otherwise it
        // is part of the name.
        let es_numero_de_copia = ultima.chars().all(|c| c.is_ascii_digit())
            && palabras.len() >= 2
            && RUIDO.contains(&palabras[palabras.len() - 2]);
        if es_ruido || es_numero_de_copia {
            palabras.pop();
        } else {
            break;
        }
    }
    palabras.join(" ")
}

/// How much a copy is worth keeping. Higher wins.
///
/// Lossless over lossy over video, and a file that is not on disk never wins:
/// suggesting the copy the user cannot play would be a strange default.
fn calidad(formato: &str, missing: bool) -> i64 {
    if missing {
        return -1;
    }
    match formato.to_uppercase().as_str() {
        "WAV" | "FLAC" | "AIFF" | "AIF" => 3,
        "MP4" | "MOV" | "MKV" | "AVI" | "WEBM" | "M4V" | "WMV" => 1,
        _ => 2,
    }
}

/// Every track, with the file facts the duplicate view needs.
fn duplicate_candidates(conn: &Connection) -> Result<Vec<DuplicateTrack>> {
    let mut tags_of = tags_by_track(conn)?;
    let mut stmt = conn.prepare(
        "SELECT t.id, t.titulo, t.artista, t.path, t.formato, COALESCE(f.nombre,''),
                t.dur_sec, t.fsize, t.fav, t.missing
         FROM tracks t LEFT JOIN folders f ON f.id = t.folder_id
         ORDER BY t.id",
    )?;
    let rows = stmt.query_map([], |r| {
        let id: i64 = r.get(0)?;
        let dur_sec: i64 = r.get(6)?;
        Ok(DuplicateTrack {
            id: id.to_string(),
            titulo: r.get(1)?,
            artista: r.get(2)?,
            path: r.get(3)?,
            formato: r.get(4)?,
            carpeta: r.get(5)?,
            dur: fmt_dur(dur_sec),
            dur_sec,
            fsize: r.get(7)?,
            fav: r.get::<_, i64>(8)? != 0,
            missing: r.get::<_, i64>(9)? != 0,
            tags: tags_of.remove(&id).unwrap_or_default(),
        })
    })?;
    Ok(rows.collect::<std::result::Result<_, _>>()?)
}

/// Turn a set of candidates into a group, picking the copy worth keeping.
fn armar_grupo(mut tracks: Vec<DuplicateTrack>, motivo: &str) -> DuplicateGroup {
    tracks.sort_by_key(|t| t.id.parse::<i64>().unwrap_or(0));
    let sugerido = tracks
        .iter()
        // Best format first, then the bigger file, then the one indexed
        // earliest — a stable answer rather than whatever order rows came in.
        .max_by_key(|t| (calidad(&t.formato, t.missing), t.fsize, -t.id.parse::<i64>().unwrap_or(0)))
        .map(|t| t.id.clone())
        .unwrap_or_default();
    let signature = tracks.iter().map(|t| t.id.as_str()).collect::<Vec<_>>().join("-");
    DuplicateGroup { signature, motivo: motivo.to_string(), sugerido, tracks }
}

/// Groups of tracks that look like the same song.
///
/// Two passes, and a track only ever lands in one group. First the copies that
/// are the same file — same byte size *and* same length, which one alone is too
/// weak for — then, over what is left, the same song in a different file:
/// title and artist that fold to the same thing, within `TOLERANCIA_SEG`.
///
/// Groups the user has already waved off are left out.
pub fn duplicate_groups(conn: &Connection) -> Result<Vec<DuplicateGroup>> {
    let candidatos = duplicate_candidates(conn)?;
    let descartados = dismissed_signatures(conn)?;
    let mut grupos: Vec<DuplicateGroup> = Vec::new();
    let mut ya_agrupado: std::collections::HashSet<String> = std::collections::HashSet::new();

    // ---- same file, in two places ----
    let mut por_archivo: std::collections::HashMap<(i64, i64), Vec<DuplicateTrack>> =
        std::collections::HashMap::new();
    for t in &candidatos {
        if t.fsize > 0 {
            por_archivo.entry((t.fsize, t.dur_sec)).or_default().push(t.clone());
        }
    }
    for (_, miembros) in por_archivo {
        if miembros.len() < 2 {
            continue;
        }
        for m in &miembros {
            ya_agrupado.insert(m.id.clone());
        }
        grupos.push(armar_grupo(miembros, "archivo"));
    }

    // ---- same song, different file ----
    let mut por_nombre: std::collections::HashMap<(String, String), Vec<DuplicateTrack>> =
        std::collections::HashMap::new();
    for t in &candidatos {
        if ya_agrupado.contains(&t.id) {
            continue;
        }
        let titulo = normalise_song(&t.titulo);
        let artista = normalise_song(&t.artista);
        // A track with nothing to match on would otherwise drag every other
        // untitled track into one enormous group.
        if titulo.is_empty() {
            continue;
        }
        por_nombre.entry((titulo, artista)).or_default().push(t.clone());
    }
    for (_, mut miembros) in por_nombre {
        if miembros.len() < 2 {
            continue;
        }
        miembros.sort_by_key(|t| t.dur_sec);
        // Sweep by length, anchored on the first of each run: a chain would let
        // a group drift far past the tolerance one second at a time.
        let mut i = 0;
        while i < miembros.len() {
            let ancla = miembros[i].dur_sec;
            let mut j = i + 1;
            while j < miembros.len() && miembros[j].dur_sec - ancla <= TOLERANCIA_SEG {
                j += 1;
            }
            if j - i >= 2 {
                grupos.push(armar_grupo(miembros[i..j].to_vec(), "titulo"));
            }
            i = j;
        }
    }

    grupos.retain(|g| !descartados.contains(&g.signature));
    // Biggest groups first — that is where the clutter is.
    grupos.sort_by(|a, b| b.tracks.len().cmp(&a.tracks.len()).then(a.signature.cmp(&b.signature)));
    Ok(grupos)
}

fn dismissed_signatures(conn: &Connection) -> Result<std::collections::HashSet<String>> {
    let mut stmt = conn.prepare("SELECT signature FROM duplicate_dismissals")?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    Ok(rows.collect::<std::result::Result<_, _>>()?)
}

/// Remember that a group is not duplicates, so it stops being offered.
pub fn dismiss_duplicates(conn: &Connection, signature: &str) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO duplicate_dismissals(signature, dismissed_at) VALUES(?1,?2)",
        params![signature, now()],
    )?;
    Ok(())
}

/// Forget every dismissal, so the groups are offered again.
pub fn clear_duplicate_dismissals(conn: &Connection) -> Result<usize> {
    Ok(conn.execute("DELETE FROM duplicate_dismissals", [])?)
}

/// How many groups the user has waved off.
pub fn dismissed_count(conn: &Connection) -> Result<i64> {
    Ok(conn.query_row("SELECT COUNT(*) FROM duplicate_dismissals", [], |r| r.get(0))?)
}

/// Fold the other copies of a song into the one the user chose to keep.
///
/// Everything the copies carried that the survivor does not moves across before
/// they go: their tags, their favourite, the church fields they had filled in,
/// and their place in every service list. Deleting the copy outright — which is
/// all the user could do until now — would have thrown all of that away.
///
/// One transaction: a merge that applied halfway is a track that lost its tags
/// and kept its duplicates.
pub fn merge_tracks(conn: &Connection, keep_id: i64, drop_ids: &[i64]) -> Result<()> {
    if drop_ids.is_empty() {
        bail!("no hay copias que fusionar");
    }
    if drop_ids.contains(&keep_id) {
        bail!("la pista que se conserva no puede estar entre las que se fusionan");
    }
    let existe: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tracks WHERE id=?1",
        params![keep_id],
        |r| r.get(0),
    )?;
    if existe == 0 {
        bail!("la pista que se conserva ya no está en la biblioteca");
    }

    // Read the covers before the rows go, so the files can be cleared up after
    // the database has actually committed.
    let marcador = lista_de_ids(drop_ids);
    let mut stmt = conn.prepare(&format!(
        "SELECT cover_path FROM tracks WHERE id IN ({marcador}) AND cover_path IS NOT NULL"
    ))?;
    let portadas: Vec<String> = stmt
        .query_map([], |r| r.get::<_, String>(0))?
        .collect::<std::result::Result<_, _>>()?;
    drop(stmt);

    let tx = conn.unchecked_transaction()?;
    // Tags: the union of every copy's.
    tx.execute(
        &format!(
            "INSERT OR IGNORE INTO track_tags(track_id, tag_id)
             SELECT ?1, tag_id FROM track_tags WHERE track_id IN ({marcador})"
        ),
        params![keep_id],
    )?;
    // A favourite on any copy is a favourite on the one that stays.
    tx.execute(
        &format!(
            "UPDATE tracks SET fav=1 WHERE id=?1
             AND EXISTS (SELECT 1 FROM tracks WHERE id IN ({marcador}) AND fav=1)"
        ),
        params![keep_id],
    )?;
    // Church fields the survivor never got, taken from whichever copy has them.
    // Never an overwrite: what the user typed on the copy they are keeping wins.
    for campo in ["tono", "ocasion"] {
        tx.execute(
            &format!(
                "UPDATE tracks SET {campo} = COALESCE(
                     (SELECT {campo} FROM tracks
                      WHERE id IN ({marcador}) AND TRIM({campo}) <> '' ORDER BY id LIMIT 1), {campo})
                 WHERE id=?1 AND TRIM({campo}) = ''"
            ),
            params![keep_id],
        )?;
    }
    tx.execute(
        &format!(
            "UPDATE tracks SET bpm = COALESCE(
                 (SELECT bpm FROM tracks WHERE id IN ({marcador}) AND bpm > 0 ORDER BY id LIMIT 1), bpm)
             WHERE id=?1 AND bpm = 0"
        ),
        params![keep_id],
    )?;
    // Service lists follow the survivor. `OR IGNORE` covers the list that
    // already held it: that row stays where it was and the copy's is dropped
    // with the copy, instead of the list gaining the same song twice.
    tx.execute(
        &format!("UPDATE OR IGNORE playlist_tracks SET track_id=?1 WHERE track_id IN ({marcador})"),
        params![keep_id],
    )?;
    tx.execute(&format!("DELETE FROM tracks WHERE id IN ({marcador})"), [])?;
    drop_orphan_tags(&tx)?;
    tx.commit()?;

    for c in portadas {
        let _ = std::fs::remove_file(c);
    }
    Ok(())
}

/// Render ids as a SQL list. They are `i64` read from our own tables, never
/// text from outside, so there is nothing here for a quote to escape.
fn lista_de_ids(ids: &[i64]) -> String {
    ids.iter().map(|i| i.to_string()).collect::<Vec<_>>().join(",")
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

    // ---- tags ----

    fn etiquetas_de(conn: &Connection, id: i64) -> Vec<String> {
        list_tracks(conn).unwrap().into_iter().find(|t| t.id == id.to_string()).unwrap().tags
    }

    fn cuantas_etiquetas(conn: &Connection) -> i64 {
        conn.query_row("SELECT COUNT(*) FROM tags", [], |r| r.get(0)).unwrap()
    }

    #[test]
    fn renaming_a_tag_moves_every_track_that_carried_it() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let a = add_track(&conn, fid, "/m/a.mp3", "A");
        let b = add_track(&conn, fid, "/m/b.mp3", "B");
        set_track_tags(&conn, a, &["lemto".into()]).unwrap();
        set_track_tags(&conn, b, &["lemto".into(), "clásico".into()]).unwrap();

        let total = rename_tag(&conn, "lemto", "lento").unwrap();

        assert_eq!(total, 2);
        assert!(etiquetas_de(&conn, a).contains(&"lento".to_string()));
        assert!(etiquetas_de(&conn, b).contains(&"lento".to_string()));
        assert!(!etiquetas_de(&conn, b).contains(&"lemto".to_string()));
    }

    #[test]
    fn renaming_onto_a_name_that_exists_folds_the_two_together() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let a = add_track(&conn, fid, "/m/a.mp3", "A");
        let b = add_track(&conn, fid, "/m/b.mp3", "B");
        // `tags.name` is case-sensitive, so these were two tags nobody could
        // see were two.
        set_track_tags(&conn, a, &["Lento".into()]).unwrap();
        set_track_tags(&conn, b, &["lento".into()]).unwrap();
        assert_eq!(cuantas_etiquetas(&conn), 2);

        let total = rename_tag(&conn, "Lento", "lento").unwrap();

        assert_eq!(total, 2, "both tracks end up on the surviving tag");
        assert_eq!(cuantas_etiquetas(&conn), 1);
        assert_eq!(etiquetas_de(&conn, a), vec!["lento"]);
    }

    #[test]
    fn a_track_that_had_both_ends_up_with_the_tag_once() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let a = add_track(&conn, fid, "/m/a.mp3", "A");
        set_track_tags(&conn, a, &["Lento".into(), "lento".into()]).unwrap();

        rename_tag(&conn, "Lento", "lento").unwrap();

        assert_eq!(etiquetas_de(&conn, a), vec!["lento"]);
    }

    #[test]
    fn renaming_tidies_the_new_name_like_any_other_tag() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let a = add_track(&conn, fid, "/m/a.mp3", "A");
        set_track_tags(&conn, a, &["x".into()]).unwrap();

        rename_tag(&conn, "x", "  muy   lento  ").unwrap();

        assert_eq!(etiquetas_de(&conn, a), vec!["muy lento"]);
    }

    #[test]
    fn a_rename_that_makes_no_sense_is_refused() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let a = add_track(&conn, fid, "/m/a.mp3", "A");
        set_track_tags(&conn, a, &["lento".into()]).unwrap();

        assert!(rename_tag(&conn, "lento", "   ").is_err(), "a tag needs a name");
        assert!(rename_tag(&conn, "no-existe", "otra").is_err());
        assert_eq!(etiquetas_de(&conn, a), vec!["lento"], "and nothing moved");
    }

    #[test]
    fn deleting_a_tag_takes_it_off_every_track_and_leaves_the_tracks() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let a = add_track(&conn, fid, "/m/a.mp3", "A");
        set_track_tags(&conn, a, &["lento".into(), "clásico".into()]).unwrap();

        delete_tag(&conn, "lento").unwrap();

        assert_eq!(etiquetas_de(&conn, a), vec!["clásico"]);
        assert_eq!(list_tracks(&conn).unwrap().len(), 1, "the track itself stays");
    }

    #[test]
    fn deleting_a_tag_that_is_gone_is_refused() {
        let conn = mem();
        assert!(delete_tag(&conn, "no-existe").is_err());
    }

    // ---- lyrics and chords ----

    #[test]
    fn a_sheet_goes_in_and_comes_back_out() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let id = add_track(&conn, fid, "/m/a.mp3", "Sublime Gracia");

        set_track_sheet(&conn, id, "Sublime gracia del Señor", "[Sol]Sublime [Do]gracia").unwrap();

        let hoja = track_sheet(&conn, id).unwrap();
        assert_eq!(hoja.track_id, id.to_string());
        assert_eq!(hoja.letra, "Sublime gracia del Señor");
        assert_eq!(hoja.acordes, "[Sol]Sublime [Do]gracia");
    }

    #[test]
    fn a_track_starts_with_no_sheet_at_all() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let id = add_track(&conn, fid, "/m/a.mp3", "A");

        let hoja = track_sheet(&conn, id).unwrap();
        assert_eq!((hoja.letra.as_str(), hoja.acordes.as_str()), ("", ""));
        assert!(!list_tracks(&conn).unwrap()[0].tiene_hoja);
    }

    #[test]
    fn the_catalogue_carries_whether_there_is_a_sheet_but_not_the_sheet() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let con = add_track(&conn, fid, "/m/a.mp3", "Con letra");
        add_track(&conn, fid, "/m/b.mp3", "Sin nada");
        set_track_sheet(&conn, con, "Aleluya", "").unwrap();

        let tracks = list_tracks(&conn).unwrap();

        assert!(tracks[0].tiene_hoja, "chords alone would do too");
        assert!(!tracks[1].tiene_hoja);
    }

    #[test]
    fn whitespace_is_not_a_sheet() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let id = add_track(&conn, fid, "/m/a.mp3", "A");

        // Opening the editor and closing it must not light the indicator.
        set_track_sheet(&conn, id, "   \n\n  ", "  ").unwrap();

        assert!(!list_tracks(&conn).unwrap()[0].tiene_hoja);
    }

    #[test]
    fn a_service_list_only_pays_for_the_sheets_that_exist() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let uno = add_track(&conn, fid, "/m/a.mp3", "Uno");
        let dos = add_track(&conn, fid, "/m/b.mp3", "Dos");
        let tres = add_track(&conn, fid, "/m/c.mp3", "Tres");
        set_track_sheet(&conn, uno, "letra de uno", "").unwrap();
        set_track_sheet(&conn, tres, "", "[Sol]tres").unwrap();

        let hojas = sheets_for(&conn, &[uno, dos, tres]).unwrap();

        assert_eq!(
            hojas.iter().map(|h| h.track_id.clone()).collect::<Vec<_>>(),
            vec![uno.to_string(), tres.to_string()],
            "the one with nothing written is not a row"
        );
    }

    #[test]
    fn asking_for_no_sheets_asks_the_database_nothing() {
        let conn = mem();
        assert!(sheets_for(&conn, &[]).unwrap().is_empty());
    }

    #[test]
    fn writing_a_sheet_onto_a_track_that_is_gone_is_refused() {
        let conn = mem();
        assert!(set_track_sheet(&conn, 9_999, "letra", "").is_err());
    }

    #[test]
    fn a_database_from_before_sheets_existed_gains_the_columns() {
        // The path a restored backup takes: `restore_from_backup` reopens
        // through `open_and_migrate`, and every query after that expects the
        // columns to be there.
        let dir = Dir::new("sheet-migration");
        let path = dir.path("vieja.db");
        {
            let vieja = Connection::open(&path).unwrap();
            vieja
                .execute_batch(
                    "CREATE TABLE folders (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL UNIQUE,
                        nombre TEXT NOT NULL, added_at TEXT NOT NULL, last_scan TEXT);
                     CREATE TABLE tracks (id INTEGER PRIMARY KEY AUTOINCREMENT, folder_id INTEGER,
                        path TEXT NOT NULL UNIQUE, titulo TEXT NOT NULL DEFAULT '',
                        artista TEXT NOT NULL DEFAULT '', album TEXT NOT NULL DEFAULT '',
                        dur_sec INTEGER NOT NULL DEFAULT 0, formato TEXT NOT NULL DEFAULT '',
                        tono TEXT NOT NULL DEFAULT '', bpm INTEGER NOT NULL DEFAULT 0,
                        ocasion TEXT NOT NULL DEFAULT '', fav INTEGER NOT NULL DEFAULT 0,
                        missing INTEGER NOT NULL DEFAULT 0, video INTEGER NOT NULL DEFAULT 0,
                        added_at TEXT NOT NULL);
                     INSERT INTO tracks(path, titulo, added_at) VALUES('/m/a.mp3','Vieja','2020-01-01');",
                )
                .unwrap();
        }

        let conn = open_and_migrate(&path).unwrap();

        let tracks = list_tracks(&conn).unwrap();
        assert_eq!(tracks.len(), 1);
        assert!(!tracks[0].tiene_hoja);
        let id: i64 = tracks[0].id.parse().unwrap();
        set_track_sheet(&conn, id, "letra nueva", "").unwrap();
        assert_eq!(track_sheet(&conn, id).unwrap().letra, "letra nueva");
    }

    // ---- duplicates ----

    /// A track with the file facts the duplicate hunt actually reads.
    #[allow(clippy::too_many_arguments)]
    fn pista(
        conn: &Connection,
        fid: i64,
        path: &str,
        titulo: &str,
        artista: &str,
        dur: i64,
        formato: &str,
        fsize: i64,
    ) -> i64 {
        upsert_track(conn, fid, path, titulo, artista, "Album", dur, formato, false, 10, fsize)
            .unwrap()
    }

    fn ids(g: &DuplicateGroup) -> Vec<i64> {
        g.tracks.iter().map(|t| t.id.parse().unwrap()).collect()
    }

    #[test]
    fn normalising_folds_case_accents_and_punctuation() {
        assert_eq!(normalise_song("¡Cuán Grande Es Él!"), "cuan grande es el");
        assert_eq!(normalise_song("Niño  Señor"), "nino senor");
    }

    #[test]
    fn normalising_drops_what_is_in_brackets() {
        assert_eq!(normalise_song("Al Mundo Paz (En Vivo)"), "al mundo paz");
        assert_eq!(normalise_song("Castillo Fuerte [Remix 2024]"), "castillo fuerte");
    }

    #[test]
    fn normalising_trims_the_tail_a_copied_file_grows() {
        assert_eq!(normalise_song("Coro de Entrada_final_2"), "coro de entrada");
        assert_eq!(normalise_song("Alabare copia"), "alabare");
    }

    #[test]
    fn normalising_keeps_a_number_that_is_part_of_the_name() {
        // «Salmo 23» is a song, not the 23rd copy of «Salmo».
        assert_eq!(normalise_song("Salmo 23"), "salmo 23");
        assert_eq!(normalise_song("Himno 512"), "himno 512");
    }

    #[test]
    fn two_copies_of_the_same_file_are_grouped() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let a = pista(&conn, fid, "/m/coros/x.mp3", "Alabaré", "Coro", 200, "MP3", 5_000);
        let b = pista(&conn, fid, "/m/respaldo/x.mp3", "Alabaré", "Coro", 200, "MP3", 5_000);

        let grupos = duplicate_groups(&conn).unwrap();

        assert_eq!(grupos.len(), 1);
        assert_eq!(grupos[0].motivo, "archivo");
        assert_eq!(ids(&grupos[0]), vec![a, b]);
    }

    #[test]
    fn the_same_byte_size_alone_is_not_enough() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        // Two different songs can easily weigh the same; the length is what
        // makes the pair believable.
        pista(&conn, fid, "/m/a.mp3", "Uno", "A", 200, "MP3", 5_000);
        pista(&conn, fid, "/m/b.mp3", "Dos", "B", 245, "MP3", 5_000);

        assert!(duplicate_groups(&conn).unwrap().is_empty());
    }

    #[test]
    fn files_with_no_recorded_size_are_left_alone() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        // fsize 0 means the scan could not stat the file, not that two files
        // are both empty.
        pista(&conn, fid, "/m/a.mp3", "Uno", "A", 200, "MP3", 0);
        pista(&conn, fid, "/m/b.mp3", "Dos", "B", 200, "MP3", 0);

        assert!(duplicate_groups(&conn).unwrap().is_empty());
    }

    #[test]
    fn the_same_song_in_two_formats_is_grouped() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let a = pista(&conn, fid, "/m/a.mp3", "Cuán Grande Es Él", "Voces", 302, "MP3", 4_000);
        let b = pista(&conn, fid, "/m/a.wav", "cuan grande es el", "voces", 304, "WAV", 40_000);

        let grupos = duplicate_groups(&conn).unwrap();

        assert_eq!(grupos.len(), 1);
        assert_eq!(grupos[0].motivo, "titulo");
        assert_eq!(ids(&grupos[0]), vec![a, b]);
    }

    #[test]
    fn a_length_that_is_too_far_off_is_a_different_song() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        // The short intro and the full song share a name and an artist.
        pista(&conn, fid, "/m/a.mp3", "Santo", "Coro", 40, "MP3", 1_000);
        pista(&conn, fid, "/m/b.mp3", "Santo", "Coro", 300, "MP3", 4_000);

        assert!(duplicate_groups(&conn).unwrap().is_empty());
    }

    #[test]
    fn a_group_never_drifts_past_the_tolerance_one_second_at_a_time() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let a = pista(&conn, fid, "/m/a.mp3", "Santo", "Coro", 300, "MP3", 1_000);
        let b = pista(&conn, fid, "/m/b.mp3", "Santo", "Coro", 302, "MP3", 2_000);
        // 4s from the first: a chain would swallow it, an anchor does not.
        let c = pista(&conn, fid, "/m/c.mp3", "Santo", "Coro", 304, "MP3", 3_000);

        let grupos = duplicate_groups(&conn).unwrap();

        assert_eq!(grupos.len(), 1);
        assert_eq!(ids(&grupos[0]), vec![a, b], "only the two within tolerance");
        assert!(!ids(&grupos[0]).contains(&c));
    }

    #[test]
    fn a_track_belongs_to_one_group_only() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        // Same file twice, and a third that shares the title.
        pista(&conn, fid, "/m/a.mp3", "Santo", "Coro", 300, "MP3", 5_000);
        pista(&conn, fid, "/m/b.mp3", "Santo", "Coro", 300, "MP3", 5_000);
        pista(&conn, fid, "/m/c.wav", "Santo", "Coro", 301, "WAV", 9_000);

        let grupos = duplicate_groups(&conn).unwrap();

        let apariciones: usize = grupos.iter().map(|g| g.tracks.len()).sum();
        assert_eq!(apariciones, 2, "the file pair wins; the third is not listed twice");
        assert_eq!(grupos[0].motivo, "archivo");
    }

    #[test]
    fn tracks_with_no_title_are_not_all_one_giant_group() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        pista(&conn, fid, "/m/a.mp3", "", "", 300, "MP3", 1_000);
        pista(&conn, fid, "/m/b.mp3", "  ", "", 301, "MP3", 2_000);

        assert!(duplicate_groups(&conn).unwrap().is_empty());
    }

    #[test]
    fn the_suggested_copy_is_the_better_file() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        pista(&conn, fid, "/m/a.mp3", "Santo", "Coro", 300, "MP3", 9_000);
        let wav = pista(&conn, fid, "/m/a.wav", "Santo", "Coro", 301, "WAV", 8_000);

        let grupos = duplicate_groups(&conn).unwrap();

        assert_eq!(grupos[0].sugerido, wav.to_string(), "lossless beats the bigger lossy file");
    }

    #[test]
    fn a_copy_that_is_not_on_disk_is_never_the_suggestion() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let perdida = pista(&conn, fid, "/m/a.wav", "Santo", "Coro", 300, "WAV", 90_000);
        let presente = pista(&conn, fid, "/m/a.mp3", "Santo", "Coro", 301, "MP3", 4_000);
        conn.execute("UPDATE tracks SET missing=1 WHERE id=?1", params![perdida]).unwrap();

        let grupos = duplicate_groups(&conn).unwrap();

        assert_eq!(grupos[0].sugerido, presente.to_string());
    }

    #[test]
    fn a_dismissed_group_stops_being_offered_and_can_be_brought_back() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        pista(&conn, fid, "/m/a.mp3", "Santo", "Coro", 300, "MP3", 5_000);
        pista(&conn, fid, "/m/b.mp3", "Santo", "Coro", 300, "MP3", 5_000);
        let firma = duplicate_groups(&conn).unwrap()[0].signature.clone();

        dismiss_duplicates(&conn, &firma).unwrap();
        assert!(duplicate_groups(&conn).unwrap().is_empty());
        assert_eq!(dismissed_count(&conn).unwrap(), 1);

        clear_duplicate_dismissals(&conn).unwrap();
        assert_eq!(duplicate_groups(&conn).unwrap().len(), 1);
        assert_eq!(dismissed_count(&conn).unwrap(), 0);
    }

    // ---- merging ----

    #[test]
    fn merging_unions_the_tags_of_every_copy() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let queda = pista(&conn, fid, "/m/a.wav", "Santo", "Coro", 300, "WAV", 9_000);
        let copia = pista(&conn, fid, "/m/a.mp3", "Santo", "Coro", 300, "MP3", 4_000);
        set_track_tags(&conn, queda, &["lento".into()]).unwrap();
        set_track_tags(&conn, copia, &["ensayo".into(), "lento".into()]).unwrap();

        merge_tracks(&conn, queda, &[copia]).unwrap();

        let t = list_tracks(&conn).unwrap();
        assert_eq!(t.len(), 1);
        let mut tags = t[0].tags.clone();
        tags.sort();
        assert_eq!(tags, vec!["ensayo", "lento"]);
    }

    #[test]
    fn a_favourite_on_any_copy_survives_the_merge() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let queda = pista(&conn, fid, "/m/a.wav", "Santo", "Coro", 300, "WAV", 9_000);
        let copia = pista(&conn, fid, "/m/a.mp3", "Santo", "Coro", 300, "MP3", 4_000);
        set_fav(&conn, copia, true).unwrap();

        merge_tracks(&conn, queda, &[copia]).unwrap();

        assert!(list_tracks(&conn).unwrap()[0].fav);
    }

    #[test]
    fn merging_fills_church_fields_the_survivor_never_got() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let queda = pista(&conn, fid, "/m/a.wav", "Santo", "Coro", 300, "WAV", 9_000);
        let copia = pista(&conn, fid, "/m/a.mp3", "Santo", "Coro", 300, "MP3", 4_000);
        update_track_meta(&conn, queda, "Sol", 0, "").unwrap();
        update_track_meta(&conn, copia, "Re", 96, "Adoración").unwrap();

        merge_tracks(&conn, queda, &[copia]).unwrap();

        let t = &list_tracks(&conn).unwrap()[0];
        assert_eq!(t.tono, "Sol", "what the user typed on the copy they keep wins");
        assert_eq!(t.bpm, 96, "and the empty ones are filled from the copy");
        assert_eq!(t.ocasion, "Adoración");
    }

    #[test]
    fn a_service_list_follows_the_copy_it_had() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let queda = pista(&conn, fid, "/m/a.wav", "Santo", "Coro", 300, "WAV", 9_000);
        let copia = pista(&conn, fid, "/m/a.mp3", "Santo", "Coro", 300, "MP3", 4_000);
        let otra = pista(&conn, fid, "/m/z.mp3", "Otra", "Coro", 100, "MP3", 1_000);
        let pl = create_playlist(&conn, "Culto", "2026-01-04", "").unwrap();
        add_to_playlist(&conn, pl, otra).unwrap();
        add_to_playlist(&conn, pl, copia).unwrap();

        merge_tracks(&conn, queda, &[copia]).unwrap();

        let listas = list_playlists(&conn).unwrap();
        assert_eq!(
            listas[0].ids,
            vec![otra.to_string(), queda.to_string()],
            "the list keeps its length and its order, pointing at the survivor"
        );
    }

    #[test]
    fn a_list_that_held_both_copies_does_not_end_up_with_the_song_twice() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let queda = pista(&conn, fid, "/m/a.wav", "Santo", "Coro", 300, "WAV", 9_000);
        let copia = pista(&conn, fid, "/m/a.mp3", "Santo", "Coro", 300, "MP3", 4_000);
        let pl = create_playlist(&conn, "Culto", "2026-01-04", "").unwrap();
        add_to_playlist(&conn, pl, queda).unwrap();
        add_to_playlist(&conn, pl, copia).unwrap();

        merge_tracks(&conn, queda, &[copia]).unwrap();

        assert_eq!(list_playlists(&conn).unwrap()[0].ids, vec![queda.to_string()]);
    }

    #[test]
    fn merging_removes_the_copies_and_keeps_the_chosen_one() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let queda = pista(&conn, fid, "/m/a.wav", "Santo", "Coro", 300, "WAV", 9_000);
        let uno = pista(&conn, fid, "/m/a.mp3", "Santo", "Coro", 300, "MP3", 4_000);
        let dos = pista(&conn, fid, "/m/a.ogg", "Santo", "Coro", 301, "OGG", 3_000);

        merge_tracks(&conn, queda, &[uno, dos]).unwrap();

        let quedan: Vec<String> = list_tracks(&conn).unwrap().into_iter().map(|t| t.id).collect();
        assert_eq!(quedan, vec![queda.to_string()]);
    }

    #[test]
    fn a_merge_that_makes_no_sense_is_refused() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let queda = pista(&conn, fid, "/m/a.wav", "Santo", "Coro", 300, "WAV", 9_000);

        assert!(merge_tracks(&conn, queda, &[]).is_err(), "nothing to merge");
        assert!(merge_tracks(&conn, queda, &[queda]).is_err(), "cannot fold a track into itself");
        assert!(merge_tracks(&conn, 9_999, &[queda]).is_err(), "the survivor must exist");
        assert_eq!(list_tracks(&conn).unwrap().len(), 1, "and nothing was touched");
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
    fn replacing_a_cover_deletes_the_file_it_replaces() {
        let files = Files::new("caratulas");
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let id = add_track(&conn, fid, "/m/a.mp3", "A");
        let jpg = files.file("1.jpg");
        let png = files.file("1.png");

        set_cover_path(&conn, id, &jpg.to_string_lossy()).unwrap();
        // El arte incrustado cambió de formato, así que el nombre cambia con él.
        set_cover_path(&conn, id, &png.to_string_lossy()).unwrap();

        assert!(!jpg.exists(), "la carátula anterior no se queda huérfana");
        assert!(png.exists(), "la nueva sigue ahí");
    }

    #[test]
    fn rewriting_the_same_cover_path_keeps_the_file() {
        let files = Files::new("caratulas-misma");
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let id = add_track(&conn, fid, "/m/a.mp3", "A");
        let jpg = files.file("1.jpg");

        set_cover_path(&conn, id, &jpg.to_string_lossy()).unwrap();
        set_cover_path(&conn, id, &jpg.to_string_lossy()).unwrap();

        assert!(jpg.exists(), "re-escanear sin cambios no borra la carátula");
    }

    #[test]
    fn folder_id_by_path_tells_a_new_folder_from_one_already_indexed() {
        let conn = mem();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();

        assert_eq!(folder_id_by_path(&conn, "/m").unwrap(), Some(fid));
        assert_eq!(folder_id_by_path(&conn, "/otra").unwrap(), None);
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
