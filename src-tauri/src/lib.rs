// Cantoral — Tauri backend entry point.

mod commands;
mod db;
mod models;
mod scanner;

use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app.path().app_data_dir().expect("resolve app data dir");
            std::fs::create_dir_all(&dir).ok();
            let conn = db::open_and_migrate(&dir.join("cantoral.db")).expect("open cantoral.db");
            app.manage(db::Db(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_library,
            commands::add_and_scan_folder,
            commands::rescan_folder,
            commands::remove_folder,
            commands::set_track_fav,
            commands::update_track,
            commands::create_playlist,
            commands::set_playlist_order,
            commands::add_to_playlist,
            commands::delete_playlist,
            commands::get_setting,
            commands::set_setting,
            commands::get_db_info,
            commands::backup_database,
            commands::restore_database,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
