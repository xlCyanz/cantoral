// Cantoral — Tauri backend entry point.

mod commands;
mod compartir;
mod db;
mod models;
mod proyeccion;
mod scanner;
#[cfg(desktop)]
mod updates;

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
            // El actualizador se registra aquí y no con `.plugin(...)` porque
            // solo existe en escritorio: en móvil la app se actualiza por la
            // tienda y el plugin ni siquiera compila.
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;

            let dir = app.path().app_data_dir().expect("resolve app data dir");
            std::fs::create_dir_all(&dir).ok();
            let db_path = dir.join("cantoral.db");
            let conn = db::open_and_migrate(&db_path).expect("open cantoral.db");
            // `asset://` starts with nothing allowed (see tauri.conf.json) and is
            // opened here to exactly what the app reads: the covers it extracts
            // into its own data directory, and the folders the user indexed.
            // Anything else on the disk stays out of the webview's reach.
            let scope = app.asset_protocol_scope();
            if let Err(err) = scope.allow_directory(&dir, true) {
                log::error!("could not grant asset access to the app data directory: {err}");
            }
            for carpeta in db::list_folders(&conn).unwrap_or_default() {
                if let Err(err) = scope.allow_directory(&carpeta.ruta, true) {
                    log::error!("could not grant asset access to «{}»: {err}", carpeta.ruta);
                }
            }

            app.manage(db::Db(Mutex::new(conn)));
            app.manage(commands::DbPath(db_path));
            app.manage(scanner::ScanSlot::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_library,
            commands::add_and_scan_folder,
            commands::rescan_folder,
            commands::cancel_scan,
            commands::add_tracks_to_playlist,
            commands::set_tracks_fav,
            commands::delete_tracks,
            commands::open_exported_sheet,
            commands::get_track_sheet,
            commands::get_sheets,
            commands::update_track_sheet,
            commands::find_duplicates,
            commands::merge_duplicates,
            commands::dismiss_duplicates,
            commands::restore_dismissed_duplicates,
            commands::reconcile_library,
            commands::remove_folder,
            commands::relocate_track,
            commands::delete_track,
            commands::relocate_folder,
            commands::set_track_fav,
            commands::update_track,
            commands::check_for_update,
            commands::projection_monitors,
            commands::open_projection,
            commands::close_projection,
            commands::set_projection,
            commands::install_update,
            commands::create_playlist,
            commands::duplicate_playlist,
            commands::set_playlist_template,
            commands::set_playlist_order,
            commands::add_to_playlist,
            commands::update_playlist,
            commands::delete_playlist,
            commands::export_playlist,
            commands::export_playlist_json,
            commands::read_playlist_file,
            commands::get_setting,
            commands::set_setting,
            commands::get_db_info,
            commands::backup_database,
            commands::inspect_backup,
            commands::restore_database,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
