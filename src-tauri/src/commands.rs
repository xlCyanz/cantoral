use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::db::{self, Db};
use crate::models::{Folder, Playlist, Track};
use crate::scanner;

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

type CmdResult<T> = Result<T, String>;

fn e<E: std::fmt::Display>(err: E) -> String {
    err.to_string()
}

#[tauri::command]
pub fn get_library(db: State<Db>) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(e)?;
    snapshot(&conn).map_err(e)
}

#[tauri::command]
pub fn add_and_scan_folder(app: AppHandle, db: State<Db>, path: String) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(e)?;
    let nombre = std::path::Path::new(&path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(path.as_str())
        .to_string();
    let fid = db::add_folder(&conn, &path, &nombre).map_err(e)?;
    scanner::scan_folder(&app, &conn, fid, &path).map_err(e)?;
    snapshot(&conn).map_err(e)
}

#[tauri::command]
pub fn rescan_folder(app: AppHandle, db: State<Db>, id: String) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(e)?;
    let fid = id.parse::<i64>().map_err(e)?;
    let path: String = conn
        .query_row("SELECT path FROM folders WHERE id=?1", params![fid], |r| r.get(0))
        .map_err(e)?;
    scanner::scan_folder(&app, &conn, fid, &path).map_err(e)?;
    snapshot(&conn).map_err(e)
}

#[tauri::command]
pub fn remove_folder(db: State<Db>, id: String) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(e)?;
    db::remove_folder(&conn, id.parse::<i64>().map_err(e)?).map_err(e)?;
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
pub fn get_setting(db: State<Db>, key: String) -> CmdResult<Option<String>> {
    let conn = db.0.lock().map_err(e)?;
    db::get_setting(&conn, &key).map_err(e)
}

#[tauri::command]
pub fn set_setting(db: State<Db>, key: String, value: String) -> CmdResult<()> {
    let conn = db.0.lock().map_err(e)?;
    db::set_setting(&conn, &key, &value).map_err(e)
}

/// Copy the SQLite database to `dest` (chosen via a save dialog on the JS side).
#[tauri::command]
pub fn backup_database(app: AppHandle, dest: String) -> CmdResult<()> {
    let src = app.path().app_data_dir().map_err(e)?.join("cantoral.db");
    std::fs::copy(&src, &dest).map_err(e)?;
    Ok(())
}
