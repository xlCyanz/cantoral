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
// antes. Los tirones más cortos, de un cuarto de segundo para arriba, también
// quedan, resumidos (ver `Tirones`).

use std::sync::mpsc::{self, RecvTimeoutError};
use std::time::{Duration, Instant};
use tauri::AppHandle;

/// Cada cuánto se pregunta.
const INTERVALO: Duration = Duration::from_secs(1);
/// A partir de cuánto sin respuesta se considera un bloqueo.
const UMBRAL: Duration = Duration::from_secs(5);
/// Cada cuánto se recuerda en el log que el bloqueo sigue.
const RECORDATORIO: Duration = Duration::from_secs(10);
/// A partir de cuánto una respuesta lenta es un tirón que se nota: la lista
/// que no baja al ratón, el botón que tarda en hundirse.
const TIRON: Duration = Duration::from_millis(250);
/// Como mucho una línea de tirones cada tanto, para no llenar el log.
const CADA_TIRONES: Duration = Duration::from_secs(10);

/// Los tirones pequeños, que no llegan a bloqueo, resumidos.
///
/// Un bloqueo de cinco segundos se ve y se cuenta; los de medio segundo no,
/// pero son los que hacen que la app «vaya pesada» en el PC de una iglesia.
/// Se apunta el primero en cuanto pasa, y los que vengan detrás se juntan en
/// una línea cada `CADA_TIRONES` con cuántos fueron y el peor.
#[derive(Default)]
struct Tirones {
    cuantos: u32,
    peor: Duration,
    ultimo_log: Option<Instant>,
}

impl Tirones {
    /// Apunta lo que tardó una respuesta. Devuelve la línea a escribir, si toca.
    fn apuntar(&mut self, latencia: Duration, ahora: Instant) -> Option<String> {
        if latencia > TIRON {
            self.cuantos += 1;
            self.peor = self.peor.max(latencia);
        }
        if self.cuantos == 0 {
            return None;
        }
        if self.ultimo_log.is_some_and(|u| ahora.duration_since(u) < CADA_TIRONES) {
            return None;
        }
        let linea = format!(
            "main thread hitch: {} over {}ms, worst {}ms",
            self.cuantos,
            TIRON.as_millis(),
            self.peor.as_millis()
        );
        self.cuantos = 0;
        self.peor = Duration::ZERO;
        self.ultimo_log = Some(ahora);
        Some(linea)
    }
}

pub fn vigilar(app: AppHandle) {
    let mut tirones = Tirones::default();
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
                Ok(()) => {
                    if let Some(linea) = tirones.apuntar(desde.elapsed(), Instant::now()) {
                        log::warn!("{linea}");
                    }
                    continue;
                }
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

#[cfg(test)]
mod tests {
    use super::*;

    const MS: fn(u64) -> Duration = Duration::from_millis;

    #[test]
    fn una_respuesta_rapida_no_se_apunta() {
        let mut t = Tirones::default();
        assert_eq!(t.apuntar(MS(3), Instant::now()), None);
        assert_eq!(t.apuntar(TIRON, Instant::now()), None);
    }

    #[test]
    fn el_primer_tiron_se_apunta_en_el_acto() {
        let mut t = Tirones::default();
        let linea = t.apuntar(MS(400), Instant::now()).unwrap();
        assert_eq!(linea, "main thread hitch: 1 over 250ms, worst 400ms");
    }

    #[test]
    fn los_siguientes_se_juntan_en_una_linea_cada_diez_segundos() {
        let mut t = Tirones::default();
        let inicio = Instant::now();
        assert!(t.apuntar(MS(300), inicio).is_some());
        // Un tirón por segundo durante nueve segundos: ninguna línea.
        for s in 1..10 {
            assert_eq!(t.apuntar(MS(260 + s * 10), inicio + Duration::from_secs(s)), None);
        }
        // Al cumplirse los diez, una línea con todos, aunque este no lo sea.
        let linea = t.apuntar(MS(5), inicio + Duration::from_secs(10)).unwrap();
        assert_eq!(linea, "main thread hitch: 9 over 250ms, worst 350ms");
        // Y sin tirones nuevos, nada más.
        assert_eq!(t.apuntar(MS(5), inicio + Duration::from_secs(30)), None);
    }
}
