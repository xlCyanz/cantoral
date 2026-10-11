//! La ventana que sale por el proyector.
//!
//! Es una ventana aparte, no una capa de la principal: en un culto la pantalla
//! grande tiene que mostrar *solo* lo que se está proyectando —sin controles,
//! sin barra de título, sin el cursor— mientras quien opera sigue viendo la
//! lista, la cola y los botones en el portátil. Una sola ventana no puede
//! hacer las dos cosas a la vez.
//!
//! Se crea desde Rust y no desde la interfaz a propósito. Crearla desde el
//! webview obligaría a darle a la ventana principal permiso de crear ventanas,
//! y con él la capacidad de fabricar cualquier otra; así el permiso no existe y
//! la única ventana que se puede abrir es esta, con esta configuración.

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder};

/// La etiqueta de la ventana de salida. También la usa su archivo de
/// capacidades, que le da mucho menos permiso que a la principal.
pub const ETIQUETA: &str = "proyeccion";

/// Una pantalla del sistema, como se le ofrece a quien opera.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Monitor {
    /// Su sitio en la lista, que es lo que se manda para elegirla.
    pub indice: usize,
    /// «Pantalla 1», «Pantalla 2»… Ver `monitores` sobre por qué no es el
    /// nombre que da el sistema.
    pub nombre: String,
    pub ancho: u32,
    pub alto: u32,
    /// Si es la pantalla donde está la ventana principal.
    pub principal: bool,
    /// El nombre que da el sistema. No se enseña —ver `monitores`—, pero es
    /// lo más estable que hay para reconocer la pantalla otro día: el índice
    /// cambia en cuanto se enchufa o se desenchufa otra.
    pub sistema: String,
    /// Dónde empieza en el escritorio, en píxeles físicos. Junto con el nombre
    /// y la resolución distingue dos pantallas del mismo modelo, y sirve
    /// cuando Windows renumera `\\.\DISPLAYn` al reconectar.
    pub x: i32,
    pub y: i32,
}

/// Lo que se le ofrece a quien opera de una pantalla del sistema.
///
/// Aparte de `monitores` para poder probarlo sin pantallas de verdad: lo que
/// importa fijar es que el índice, la identidad y cuál es la principal salen
/// de los mismos datos.
fn describir(
    indice: usize,
    sistema: Option<&str>,
    (ancho, alto): (u32, u32),
    (x, y): (i32, i32),
    actual: Option<&str>,
) -> Monitor {
    Monitor {
        indice,
        principal: actual.is_some() && actual == sistema,
        nombre: format!("Pantalla {}", indice + 1),
        ancho,
        alto,
        sistema: sistema.unwrap_or_default().to_string(),
        x,
        y,
    }
}

/// Las pantallas conectadas.
///
/// El orden es el que da el sistema y se mantiene: el índice que se devuelve
/// aquí es el que luego se acepta en `abrir`.
///
/// Se numeran, no se nombran. El nombre que da el sistema no sirve para
/// elegir: en macOS sale «Monitor #41237» —un identificador, no el modelo— y
/// en Windows sale `\\.\DISPLAY1`. Lo que sí ayuda a acertar es el número, la
/// resolución y cuál de ellas tiene delante quien está mirando la pantalla.
pub fn monitores(app: &AppHandle) -> Result<Vec<Monitor>, String> {
    let actual = app
        .get_webview_window("main")
        .and_then(|w| w.current_monitor().ok().flatten())
        .and_then(|m| m.name().cloned());

    let lista = app.available_monitors().map_err(|e| e.to_string())?;
    Ok(lista
        .into_iter()
        .enumerate()
        .map(|(indice, m)| {
            let tam = m.size();
            let pos = m.position();
            describir(
                indice,
                m.name().map(String::as_str),
                (tam.width, tam.height),
                (pos.x, pos.y),
                actual.as_deref(),
            )
        })
        .collect())
}

/// Abre —o mueve— la salida en la pantalla pedida.
///
/// La pantalla completa se pide *para ese monitor* (`set_fullscreen_on_monitor`)
/// y no «donde esté la ventana». Antes se colocaba la ventana en la posición
/// del monitor y luego se pedía pantalla completa a secas, que en Tauri es
/// pantalla completa en el monitor actual de la ventana. Pero la posición del
/// monitor viene en píxeles físicos y el constructor la toma como lógicos: con
/// la pantalla escalada (Retina, o el 125–150 % de casi todo portátil con
/// Windows) la ventana nacía fuera del monitor elegido, el sistema la devolvía
/// a la principal, y la salida acababa en el portátil fuera cual fuera la
/// pantalla elegida.
///
/// Corre fuera del hilo principal (el comando es `async`): para mover la
/// salida de pantalla espera a que la ventana anterior se cierre.
pub fn abrir(app: &AppHandle, indice: usize) -> Result<(), String> {
    let pantallas = app.available_monitors().map_err(|e| e.to_string())?;
    let destino =
        pantallas.get(indice).ok_or_else(|| format!("no hay ninguna pantalla {}", indice + 1))?;
    let fisica = *destino.position();
    let objetivo = PhysicalPosition::new(fisica.x as f64, fisica.y as f64);

    if let Some(ventana) = app.get_webview_window(ETIQUETA) {
        // Ya está en esa pantalla: no hay nada que mover.
        let donde = ventana.current_monitor().ok().flatten().map(|m| *m.position());
        if donde == Some(fisica) {
            ventana.show().map_err(|e| e.to_string())?;
            return Ok(());
        }
        // En otra: se cierra y se abre de nuevo allí. Mover una ventana a
        // pantalla completa de un monitor a otro no es fiable en macOS: salir
        // de pantalla completa es una animación asíncrona, la petición de
        // entrar en el otro monitor llega antes de que empiece, y las dos
        // chocan —la salida se quedaba en 0×0, y alguna vez la app se cerró—.
        // Recrearla deja el proyector un instante en negro, y la ventana
        // nueva pide lo que hay que mostrar en cuanto está lista.
        ventana.destroy().map_err(|e| e.to_string())?;
        esperar_cierre(app)?;
        log::info!("projection window closed to move it to monitor {indice}");
    }

    // El constructor quiere píxeles lógicos: se convierten con la escala del
    // monitor de destino para que la ventana nazca ya dentro de él. La
    // pantalla completa de abajo no depende de esto, pero así no aparece un
    // instante en otro sitio.
    let logica = fisica.to_logical::<f64>(destino.scale_factor());
    let ventana =
        WebviewWindowBuilder::new(app, ETIQUETA, WebviewUrl::App("index.html?salida".into()))
            .title("Cantoral — proyección")
            .decorations(false)
            .resizable(false)
            // Arranca invisible y en negro: lo que no se puede evitar es que la
            // ventana aparezca, pero sí que aparezca enseñando un fondo claro y
            // medio dibujada delante de la congregación.
            .visible(false)
            .background_color(tauri::window::Color(0, 0, 0, 255))
            .position(logica.x, logica.y)
            .build()
            .map_err(|e| e.to_string())?;

    ventana.set_fullscreen_on_monitor(objetivo).map_err(|e| e.to_string())?;
    ventana.show().map_err(|e| e.to_string())?;
    log::info!(
        "projection window opened on monitor {indice} at {fisica:?} (scale {})",
        destino.scale_factor()
    );
    Ok(())
}

/// Espera a que la ventana de salida termine de cerrarse, para poder abrir
/// otra con la misma etiqueta. La cierra el bucle de eventos, en el hilo
/// principal; este comando corre fuera de él, así que esperar aquí no lo
/// bloquea.
fn esperar_cierre(app: &AppHandle) -> Result<(), String> {
    for _ in 0..60 {
        if app.get_webview_window(ETIQUETA).is_none() {
            return Ok(());
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
    Err("la ventana de proyección no terminó de cerrarse".into())
}

/// Cierra la salida.
///
/// Cerrar y no esconder: una ventana escondida a pantalla completa sigue
/// existiendo para el sistema, y en macOS se queda con su espacio propio en
/// Mission Control.
pub fn cerrar(app: &AppHandle) -> Result<(), String> {
    if let Some(ventana) = app.get_webview_window(ETIQUETA) {
        ventana.close().map_err(|e| e.to_string())?;
        log::info!("projection window closed");
    }
    Ok(())
}

/// Manda a la salida lo que tiene que mostrar.
///
/// El contenido viaja sin mirarlo. Rust no tiene que entender qué se está
/// proyectando —un título, una letra, un video— para pasarlo de una ventana a
/// otra, y tipar aquí cada forma que adopte obligaría a tocar el núcleo cada
/// vez que la proyección aprende a mostrar algo nuevo.
///
/// Va por aquí y no directo desde el webview para no darle a la ventana
/// principal permiso de emitir a otras ventanas: el único destino posible es
/// este, y lo decide el núcleo.
pub fn emitir(app: &AppHandle, contenido: serde_json::Value) -> Result<(), String> {
    if app.get_webview_window(ETIQUETA).is_none() {
        // Sin salida abierta no hay nada que hacer, y tampoco es un error:
        // pasa cada vez que cambia la pista sin estar proyectando.
        return Ok(());
    }
    app.emit_to(ETIQUETA, "proyeccion", contenido).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numera_desde_uno_y_guarda_la_identidad_del_sistema() {
        let m = describir(1, Some("DELL P2219H"), (1920, 1080), (2560, -120), None);
        assert_eq!(m.nombre, "Pantalla 2");
        assert_eq!(m.sistema, "DELL P2219H");
        assert_eq!((m.ancho, m.alto, m.x, m.y), (1920, 1080, 2560, -120));
        assert!(!m.principal);
    }

    #[test]
    fn la_principal_es_la_que_tiene_la_ventana() {
        let m = describir(0, Some("Built-in"), (2880, 1800), (0, 0), Some("Built-in"));
        assert!(m.principal);
        let otra = describir(1, Some("DELL"), (1920, 1080), (2880, 0), Some("Built-in"));
        assert!(!otra.principal);
    }

    #[test]
    fn sin_nombre_no_es_principal_ni_inventa_uno() {
        // Sin saber dónde está la ventana no se marca ninguna: decir que la
        // del proyector es la del operador mandaría la salida al portátil.
        let m = describir(0, None, (1920, 1080), (0, 0), None);
        assert!(!m.principal);
        assert_eq!(m.sistema, "");
    }

    #[test]
    fn se_manda_en_camel_case_con_la_identidad() {
        let m = describir(0, Some("X"), (800, 600), (10, 20), None);
        let v = serde_json::to_value(&m).unwrap();
        for campo in ["indice", "nombre", "ancho", "alto", "principal", "sistema", "x", "y"] {
            assert!(v.get(campo).is_some(), "falta {campo}");
        }
    }
}
