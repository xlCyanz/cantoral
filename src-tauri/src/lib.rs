// Cantoral — Tauri backend entry point.

mod commands;
mod db;
mod models;
mod scanner;

use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // Errors reaching the frontend are also written to a rotating log file
        // in the app's log directory, so a problem reported from a church PC
        // can be diagnosed without reproducing it.
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("cantoral".into()),
                    }),
                ])
                .build(),
        )
        .setup(|app| {
            let dir = app.path().app_data_dir().expect("resolve app data dir");
            std::fs::create_dir_all(&dir).ok();
            let db_path = dir.join("cantoral.db");
            let conn = db::open_and_migrate(&db_path).expect("open cantoral.db");
            app.manage(db::Db(Mutex::new(conn)));
            app.manage(commands::DbPath(db_path));
            app.manage(commands::ScanCancel(AtomicBool::new(false)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_library,
            commands::add_and_scan_folder,
            commands::rescan_folder,
            commands::cancel_scan,
            commands::reconcile_library,
            commands::remove_folder,
            commands::set_track_fav,
            commands::update_track,
            commands::create_playlist,
            commands::set_playlist_order,
            commands::add_to_playlist,
            commands::update_playlist,
            commands::delete_playlist,
            commands::export_playlist,
            commands::get_setting,
            commands::set_setting,
            commands::get_db_info,
            commands::backup_database,
            commands::restore_database,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
