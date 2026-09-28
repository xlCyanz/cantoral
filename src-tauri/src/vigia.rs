// Vigía del hilo principal.
//
// En Windows ese hilo lo es todo: pinta la ventana, atiende los comandos
// síncronos y entrega cada archivo que el webview pide por `asset://`. Si se
// queda atascado la ventana sigue ahí, con el cursor de «cargando» encima, y
// el log no dice nada porque nadie escribe mientras tanto.
//
// Este hilo aparte le pide un «¿sigues ahí?» cada segundo. Si la respuesta
// tarda más de lo razonable lo deja escrito, y vuelve a escribir cuando el
// hilo se recupera, con cuánto tiempo estuvo perdido. Así un log mandado desde
// otra PC dice si hubo bloqueo, cuándo empezó y qué se estaba haciendo justo
// antes.

use std::sync::mpsc::{self, RecvTimeoutError};
use std::time::{Duration, Instant};
use tauri::AppHandle;

/// Cada cuánto se pregunta.
const INTERVALO: Duration = Duration::from_secs(1);
/// A partir de cuánto sin respuesta se considera un bloqueo.
const UMBRAL: Duration = Duration::from_secs(5);
/// Cada cuánto se recuerda en el log que el bloqueo sigue.
const RECORDATORIO: Duration = Duration::from_secs(10);

pub fn vigilar(app: AppHandle) {
    let lanzado =
        std::thread::Builder::new().name("vigia-hilo-principal".into()).spawn(move || loop {
            std::thread::sleep(INTERVALO);
            let (tx, rx) = mpsc::channel();
            let desde = Instant::now();
            // Falla cuando el bucle de eventos ya no existe: la app se cierra.
            if app
                .run_on_main_thread(move || {
                    let _ = tx.send(());
                })
                .is_err()
            {
                return;
            }
            match rx.recv_timeout(UMBRAL) {
                Ok(()) => continue,
                // El cierre soltó la tarea sin correrla.
                Err(RecvTimeoutError::Disconnected) => return,
                Err(RecvTimeoutError::Timeout) => {
                    log::warn!("main thread unresponsive for {}s", UMBRAL.as_secs());
                }
            }
            loop {
                match rx.recv_timeout(RECORDATORIO) {
                    Ok(()) => {
                        log::warn!(
                            "main thread responsive again after {:.1}s",
                            desde.elapsed().as_secs_f64()
                        );
                        break;
                    }
                    Err(RecvTimeoutError::Disconnected) => return,
                    Err(RecvTimeoutError::Timeout) => {
                        log::warn!(
                            "main thread still unresponsive after {}s",
                            desde.elapsed().as_secs()
                        );
                    }
                }
            }
        });
    if let Err(err) = lanzado {
        log::error!("could not start the main thread watchdog: {err}");
    }
}
