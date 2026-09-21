//! Buscar e instalar actualizaciones de Cantoral.
//!
//! El público de esta app son PCs de iglesia, a menudo compartidos y casi
//! nunca con alguien técnico cerca. Sin esto, una instalación se queda
//! congelada en la versión con la que nació y los arreglos no llegan nunca.
//!
//! Todo pasa por aquí y no por el plugin desde JavaScript: así la ventana no
//! necesita ningún permiso de `updater` en las capacidades, y la única
//! superficie que la interfaz puede tocar son estos dos comandos.

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

/// En qué quedó la búsqueda.
///
/// «Sin configurar» es un estado de primera clase y no un error: una
/// compilación hecha sin la clave de firma es perfectamente válida —así se
/// compila hoy desde un fork— y decirlo es más útil que un mensaje rojo sobre
/// algo que el usuario no puede arreglar.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "estado")]
pub enum UpdateCheck {
    SinConfigurar,
    AlDia,
    #[serde(rename_all = "camelCase")]
    Disponible {
        version: String,
        /// Notas del release, tal como las publica `latest.json`.
        notas: String,
        /// Fecha de publicación, RFC3339, si el manifiesto la trae.
        fecha: Option<String>,
    },
}

/// Cuánto lleva descargado, para que una descarga de decenas de megas no
/// parezca que se colgó.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgress {
    pub descargado: u64,
    /// El servidor puede no decir el total; entonces no hay porcentaje.
    pub total: Option<u64>,
}

/// Whether this build was given a public key to verify updates with.
///
/// Read from the config rather than inferred from an error, so «nobody
/// configured this» and «the check failed» stay apart.
fn configurado(app: &AppHandle) -> bool {
    app.config()
        .plugins
        .0
        .get("updater")
        .and_then(|v| v.get("pubkey"))
        .and_then(|v| v.as_str())
        .map(|k| !k.trim().is_empty())
        .unwrap_or(false)
}

/// Is there a newer version published?
///
/// Never bothers the user on its own: what it returns is shown where they
/// asked for it, and the check at startup is silent unless there is something
/// to say.
pub async fn buscar(app: &AppHandle) -> Result<UpdateCheck, String> {
    if !configurado(app) {
        return Ok(UpdateCheck::SinConfigurar);
    }
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(update)) => Ok(UpdateCheck::Disponible {
            version: update.version.clone(),
            notas: update.body.clone().unwrap_or_default(),
            fecha: update.date.map(|d| d.to_string()),
        }),
        Ok(None) => Ok(UpdateCheck::AlDia),
        Err(err) => Err(err.to_string()),
    }
}

/// Download the update, install it, and restart into it.
///
/// Checks again instead of trusting an id from the frontend: between the
/// button appearing and being pressed a release can be pulled, and installing
/// something that is no longer published is worse than saying it is gone.
pub async fn instalar(app: &AppHandle) -> Result<(), String> {
    if !configurado(app) {
        return Err("Esta compilación de Cantoral no trae actualizaciones automáticas.".into());
    }
    let updater = app.updater().map_err(|e| e.to_string())?;
    let Some(update) = updater.check().await.map_err(|e| e.to_string())? else {
        return Err("Ya no hay una versión más nueva que instalar.".into());
    };

    let mut descargado: u64 = 0;
    let app_progreso = app.clone();
    let app_fin = app.clone();
    update
        .download_and_install(
            move |trozo, total| {
                descargado += trozo as u64;
                let _ = app_progreso.emit("update-progress", UpdateProgress { descargado, total });
            },
            move || {
                let _ = app_fin.emit("update-downloaded", ());
            },
        )
        .await
        .map_err(|e| e.to_string())?;

    log::info!("update installed; restarting into it");
    // No vuelve: `restart` reemplaza el proceso.
    app.restart();
}
