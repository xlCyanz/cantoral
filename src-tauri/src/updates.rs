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

/// Cuándo vale la pena contarle a la interfaz cómo va la descarga.
///
/// La descarga llega a trozos de unos pocos KB: decenas de megas son miles de
/// eventos, cada uno una escritura en el store que repinta la barra. La barra
/// enseña porcentajes enteros, así que se avisa cuando cambia el porcentaje;
/// sin total, como mucho cada `CADA`. El último trozo se avisa siempre.
#[derive(Default)]
struct Aviso {
    porcentaje: Option<u64>,
    ultimo: Option<std::time::Instant>,
}

impl Aviso {
    const CADA: std::time::Duration = std::time::Duration::from_millis(100);

    fn toca(&mut self, descargado: u64, total: Option<u64>, ahora: std::time::Instant) -> bool {
        let toca = match total.filter(|t| *t > 0) {
            Some(t) => {
                let porcentaje = descargado.saturating_mul(100) / t;
                descargado >= t || self.porcentaje != Some(porcentaje)
            }
            None => self.ultimo.is_none_or(|u| ahora.duration_since(u) >= Self::CADA),
        };
        if toca {
            self.porcentaje = total.filter(|t| *t > 0).map(|t| descargado.saturating_mul(100) / t);
            self.ultimo = Some(ahora);
        }
        toca
    }
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
    let mut aviso = Aviso::default();
    let app_progreso = app.clone();
    let app_fin = app.clone();
    update
        .download_and_install(
            move |trozo, total| {
                descargado += trozo as u64;
                if aviso.toca(descargado, total, std::time::Instant::now()) {
                    let _ =
                        app_progreso.emit("update-progress", UpdateProgress { descargado, total });
                }
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    #[test]
    fn con_total_avisa_una_vez_por_porcentaje_y_al_final() {
        let mut aviso = Aviso::default();
        let ahora = Instant::now();
        let total = 50 * 1024 * 1024;
        // Trozos de 4 KB, como los entrega la descarga: 12 800 trozos.
        let mut descargado = 0;
        let mut avisos = 0;
        while descargado < total {
            descargado = (descargado + 4096).min(total);
            if aviso.toca(descargado, Some(total), ahora) {
                avisos += 1;
            }
        }
        // Del 0 % al 100 %: 101 avisos como mucho, no 12 800.
        assert!(avisos <= 101, "{avisos}");
        assert!(avisos >= 100, "{avisos}");
    }

    #[test]
    fn sin_total_avisa_como_mucho_cada_cien_ms() {
        let mut aviso = Aviso::default();
        let inicio = Instant::now();
        let avisos = (0..1000u64)
            .filter(|i| aviso.toca(i * 4096, None, inicio + Duration::from_millis(*i)))
            .count();
        // Un segundo de trozos, uno por milisegundo.
        assert_eq!(avisos, 10);
    }
}
