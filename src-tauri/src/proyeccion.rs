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
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

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
            Monitor {
                indice,
                principal: actual.is_some() && actual == m.name().cloned(),
                nombre: format!("Pantalla {}", indice + 1),
                ancho: tam.width,
                alto: tam.height,
            }
        })
        .collect())
}

/// Abre —o mueve— la salida en la pantalla pedida.
///
/// Se posiciona antes de ponerla a pantalla completa: en X11 y en Windows,
/// «pantalla completa» se aplica al monitor donde la ventana ya está, así que
/// crearla en el centro y luego pedir pantalla completa la dejaría tapando el
/// portátil del operador en vez del proyector.
pub fn abrir(app: &AppHandle, indice: usize) -> Result<(), String> {
    let pantallas = app.available_monitors().map_err(|e| e.to_string())?;
    let destino =
        pantallas.get(indice).ok_or_else(|| format!("no hay ninguna pantalla {}", indice + 1))?;
    let posicion = *destino.position();

    if let Some(ventana) = app.get_webview_window(ETIQUETA) {
        // Ya existía: cambiar de pantalla pide salir de pantalla completa
        // primero, porque mover una ventana que ya lo está no hace nada.
        ventana.set_fullscreen(false).map_err(|e| e.to_string())?;
        ventana.set_position(posicion).map_err(|e| e.to_string())?;
        ventana.set_fullscreen(true).map_err(|e| e.to_string())?;
        ventana.show().map_err(|e| e.to_string())?;
        return Ok(());
    }

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
            .position(posicion.x as f64, posicion.y as f64)
            .build()
            .map_err(|e| e.to_string())?;

    ventana.set_fullscreen(true).map_err(|e| e.to_string())?;
    ventana.show().map_err(|e| e.to_string())?;
    log::info!("projection window opened on monitor {indice}");
    Ok(())
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
