//! Las carátulas incrustadas, reducidas y compartidas.
//!
//! El arte que viene dentro de un MP3 suele medir 1500 o 3000 px y pesar
//! varios megas ya decodificado, y la biblioteca lo enseña a 24, 40 o 74 px.
//! Guardado tal cual, la webview decodificaba la imagen entera por cada fila
//! que montaba al desplazarse: en Windows, tirones y memoria de sobra. Y como
//! se escribía un archivo por pista, un disco de doce canciones dejaba doce
//! copias del mismo arte.
//!
//! Ahora se guarda una sola vez por imagen —el nombre sale de una huella de
//! los bytes originales, así que todas las pistas del disco apuntan al mismo
//! archivo— y en dos tamaños: uno pequeño para la interfaz, y uno mediano solo
//! para el fondo «Portada» de la proyección, que la enseña a pantalla
//! completa. Borrar una pista solo borra el archivo si ya no lo usa ninguna
//! otra (ver `db::soltar_caratulas`).
//!
//! Decodificar una imagen que llega de un archivo bajado de internet es
//! terreno de sorpresas: aquí nada hace *panic* hacia fuera ni se come la
//! memoria. Una imagen que no se deja leer es una pista sin carátula, y queda
//! en el log.

use std::io::Cursor;
use std::path::{Path, PathBuf};

use anyhow::Result;
use image::codecs::jpeg::JpegEncoder;
use image::{DynamicImage, ImageReader, Limits};
use rusqlite::{params, Connection};

use crate::db;

/// El lado largo de la carátula de la interfaz. Lo más grande que se pinta es
/// el panel de detalle, a 74 px: con 160 sobra para una pantalla de densidad
/// doble.
pub const LADO: u32 = 160;
/// El lado largo de la que usa la proyección de fondo. Va apagada y
/// desenfocada, así que no hace falta la original; con la pequeña estirada a
/// 1920 px se verían los bloques.
pub const LADO_GRANDE: u32 = 640;
/// Calidad del JPEG. Por debajo de 75 se notan los bloques en los degradados.
const CALIDAD: u8 = 80;
/// Lo más que se deja reservar para decodificar una imagen. Una carátula de
/// 3000 px en RGBA son 36 MB; esto deja margen y para una bomba de
/// descompresión antes de que llene la memoria.
const MAX_MEMORIA: u64 = 256 * 1024 * 1024;
/// El prefijo de las carátulas ya reducidas. Lo que no lo lleva en la carpeta
/// es de antes —`{id}.{ext}`, a tamaño completo— o la miniatura de un video.
const PREFIJO: &str = "a-";
/// El sufijo de la versión para la proyección.
const SUFIJO_GRANDE: &str = "-g";

/// FNV-1a de 64 bits: estable entre versiones de Rust (el `DefaultHasher` no
/// lo promete) y de sobra para distinguir las carátulas de una biblioteca.
pub fn huella(bytes: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in bytes {
        h ^= *b as u64;
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    // La longitud también entra, para que dos imágenes que solo difieren en
    // ceros al final no coincidan.
    h ^ (bytes.len() as u64).rotate_left(32)
}

/// El nombre del archivo pequeño de la carátula con esta huella.
fn nombre(h: u64) -> String {
    format!("{PREFIJO}{h:016x}.jpg")
}

/// La ruta de la versión para la proyección de una carátula reducida, o
/// `None` si la ruta no es de una (una miniatura de video, una de antes).
pub fn grande_de(ruta: &str) -> Option<String> {
    let nombre = Path::new(ruta).file_name()?.to_str()?;
    let base = nombre.strip_prefix(PREFIJO)?.strip_suffix(".jpg")?;
    if base.len() != 16 || !base.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }
    Some(ruta[..ruta.len() - ".jpg".len()].to_string() + SUFIJO_GRANDE + ".jpg")
}

/// Si `ruta` es ya una carátula reducida.
pub fn es_reducida(ruta: &str) -> bool {
    grande_de(ruta).is_some()
}

/// Decodificar, sin dejar escapar un *panic* ni reservar sin límite.
fn decodificar(bytes: &[u8]) -> Option<DynamicImage> {
    let leer = || -> image::ImageResult<DynamicImage> {
        let mut lector = ImageReader::new(Cursor::new(bytes)).with_guessed_format()?;
        let mut limites = Limits::default();
        limites.max_alloc = Some(MAX_MEMORIA);
        limites.max_image_width = Some(16_384);
        limites.max_image_height = Some(16_384);
        lector.limits(limites);
        lector.decode()
    };
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(leer)) {
        Ok(Ok(img)) => Some(img),
        Ok(Err(err)) => {
            log::warn!("cover art could not be decoded: {err}");
            None
        }
        Err(_) => {
            log::error!("cover art decoder panicked; the track is left without a cover");
            None
        }
    }
}

/// `img` con su lado largo en `lado` como mucho. Nunca se agranda.
fn achicar(img: &DynamicImage, lado: u32) -> DynamicImage {
    if img.width() <= lado && img.height() <= lado {
        return img.clone();
    }
    // Un filtro de verdad y no solo `thumbnail`, que a 160 px deja dientes.
    // Pero filtrar 3000 px enteros es lento: primero un salto rápido hasta el
    // doble, y el filtro sobre eso.
    let previa = if img.width().max(img.height()) > lado * 4 {
        img.thumbnail(lado * 2, lado * 2)
    } else {
        img.clone()
    };
    previa.resize(lado, lado, image::imageops::FilterType::Triangle)
}

/// `img` en JPEG. JPEG no lleva transparencia: un PNG con alfa se queda con
/// su color.
fn codificar(img: &DynamicImage) -> Option<Vec<u8>> {
    let rgb = DynamicImage::ImageRgb8(img.to_rgb8());
    let mut salida = Vec::new();
    let escribir = || rgb.write_with_encoder(JpegEncoder::new_with_quality(&mut salida, CALIDAD));
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(escribir)) {
        Ok(Ok(())) => Some(salida),
        Ok(Err(err)) => {
            log::warn!("cover art could not be encoded: {err}");
            None
        }
        Err(_) => {
            log::error!("cover art encoder panicked");
            None
        }
    }
}

/// `bytes` reducida a `lado` en JPEG, o `None` si no es una imagen que se
/// deje leer. Para las pruebas.
#[cfg(test)]
fn reducir(bytes: &[u8], lado: u32) -> Option<Vec<u8>> {
    codificar(&achicar(&decodificar(bytes)?, lado))
}

/// Escribir sin dejar nunca un archivo a medias con el nombre bueno: si la app
/// se cierra a mitad, lo que queda es un `.tmp` que nadie usa, y la próxima
/// vez se vuelve a escribir.
fn escribir(destino: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let tmp = destino.with_extension("tmp");
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(&tmp, destino).inspect_err(|_| {
        let _ = std::fs::remove_file(&tmp);
    })
}

/// Guardar la carátula `bytes` en `dir`, reducida, y devolver la ruta de la
/// pequeña, que es la que va a la pista.
///
/// Si otra pista ya trajo la misma imagen, no se decodifica nada: se devuelve
/// el archivo que ya está. `None` si la imagen no se deja leer.
pub fn guardar(dir: &Path, bytes: &[u8]) -> Option<PathBuf> {
    if bytes.is_empty() {
        return None;
    }
    let h = huella(bytes);
    let pequena = dir.join(nombre(h));
    // La grande se escribe antes que la pequeña: si la pequeña está, las dos
    // lo están.
    if pequena.is_file() {
        return Some(pequena);
    }
    let img = decodificar(bytes)?;
    let grande = PathBuf::from(grande_de(&pequena.to_string_lossy())?);
    // La pequeña sale de la grande: menos que filtrar, y se ven iguales.
    let img_grande = achicar(&img, LADO_GRANDE);
    let (Some(g), Some(p)) = (codificar(&img_grande), codificar(&achicar(&img_grande, LADO)))
    else {
        return None;
    };
    if let Err(err) = std::fs::create_dir_all(dir)
        .and_then(|_| escribir(&grande, &g))
        .and_then(|_| escribir(&pequena, &p))
    {
        log::warn!("could not write cover {}: {err}", pequena.display());
        return None;
    }
    Some(pequena)
}

/// Lo que cambió una pasada de [`reducir_existentes`]: cada pista con su
/// carátula nueva.
pub type Cambios = Vec<(i64, String)>;

/// Cuántas carátulas viejas se convierten por vuelta antes de avisar.
const LOTE: usize = 25;

/// La pasada única que reduce las carátulas de una biblioteca de antes.
///
/// Las bibliotecas escaneadas antes de esto tienen un archivo a tamaño
/// completo por pista. Se convierten de `LOTE` en `LOTE` —cada carátula vieja
/// se lee, se guarda reducida y compartida, se apuntan a ella las pistas que
/// la usaban y se borra la vieja—, y tras cada lote se llama a `avisar` con lo
/// que cambió, para que la interfaz apunte las rutas nuevas antes de que
/// desaparezcan los archivos viejos.
///
/// Se puede cortar en cualquier momento: lo hecho ya está en la base, y la
/// próxima vez solo quedan las que faltaban. Las miniaturas de los videos ya
/// son pequeñas (320 px) y no se tocan. Una carátula vieja que no se deja leer
/// se queda como está. Devuelve cuántas pistas cambiaron.
pub fn reducir_existentes(
    conn: &Connection,
    dir: &Path,
    avisar: &mut dyn FnMut(Cambios),
) -> Result<usize> {
    let mut stmt = conn.prepare(
        "SELECT DISTINCT cover_path FROM tracks WHERE video=0 AND cover_path IS NOT NULL",
    )?;
    let viejas: Vec<String> = stmt
        .query_map([], |r| r.get::<_, String>(0))?
        .collect::<std::result::Result<Vec<_>, _>>()?
        .into_iter()
        .filter(|c| !es_reducida(c))
        .collect();
    drop(stmt);
    if viejas.is_empty() {
        return Ok(0);
    }
    log::info!("covers: shrinking {} full-size cover files", viejas.len());

    let mut total = 0usize;
    for lote in viejas.chunks(LOTE) {
        let mut cambios: Cambios = Vec::new();
        let mut sueltas: Vec<String> = Vec::new();
        for vieja in lote {
            let Ok(bytes) = std::fs::read(vieja) else {
                // Ya no está: nada que reducir, y la pista se queda como estaba.
                continue;
            };
            let Some(nueva) = guardar(dir, &bytes) else {
                continue;
            };
            let nueva = nueva.to_string_lossy().to_string();
            let tx = conn.unchecked_transaction()?;
            let ids: Vec<i64> = {
                let mut q = tx.prepare("SELECT id FROM tracks WHERE cover_path=?1")?;
                let ids = q
                    .query_map(params![vieja], |r| r.get(0))?
                    .collect::<std::result::Result<_, _>>()?;
                ids
            };
            tx.execute(
                "UPDATE tracks SET cover_path=?1 WHERE cover_path=?2",
                params![nueva, vieja],
            )?;
            tx.commit()?;
            cambios.extend(ids.into_iter().map(|id| (id, nueva.clone())));
            sueltas.push(vieja.clone());
        }
        total += cambios.len();
        if !cambios.is_empty() {
            avisar(cambios);
        }
        // Solo lo que está dentro de la carpeta de carátulas: una ruta de la
        // base que apuntara a otro sitio no es nuestra para borrarla.
        let propias = sueltas.into_iter().filter(|c| Path::new(c).starts_with(dir)).collect();
        db::soltar_caratulas(conn, propias);
    }
    log::info!("covers: {total} tracks now use a shrunk cover");
    Ok(total)
}

/// La clave de ajustes que dice que la pasada ya se hizo en esta base. Con un
/// número, por si algún día hace falta otra.
pub const AJUSTE_REDUCIDAS: &str = "caratulas_reducidas";
const VERSION_REDUCIDAS: &str = "1";

/// Hacer la pasada si esta base no la tiene hecha, y apuntarlo al acabar.
pub fn reducir_si_falta(
    conn: &Connection,
    dir: &Path,
    avisar: &mut dyn FnMut(Cambios),
) -> Result<usize> {
    if db::get_setting(conn, AJUSTE_REDUCIDAS)?.as_deref() == Some(VERSION_REDUCIDAS) {
        return Ok(0);
    }
    let n = reducir_existentes(conn, dir, avisar)?;
    db::set_setting(conn, AJUSTE_REDUCIDAS, VERSION_REDUCIDAS)?;
    Ok(n)
}

/// Una pista cuya carátula cambió de archivo, para la interfaz.
#[derive(serde::Serialize, Clone)]
pub struct CaratulaNueva {
    pub id: String,
    pub cover: String,
}

/// Lanzar la pasada única en un hilo suyo, si a esta base le falta.
///
/// Nunca en el arranque: espera a que la ventana tenga su biblioteca en
/// pantalla, trabaja en una conexión propia —la principal sigue libre para la
/// interfaz— y avisa con `caratulas-reducidas` de cada lote, para que la
/// interfaz cambie las rutas antes de que se borren las viejas.
pub fn reducir_en_segundo_plano(app: tauri::AppHandle, base: PathBuf, dir: PathBuf) {
    use tauri::Emitter;
    let lanzado = std::thread::Builder::new().name("caratulas".into()).spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(15));
        let inicio = std::time::Instant::now();
        let conn = match db::open_secondary(&base) {
            Ok(c) => c,
            Err(err) => return log::error!("covers: could not open the database: {err}"),
        };
        let mut avisar = |cambios: Cambios| {
            let lote: Vec<CaratulaNueva> = cambios
                .into_iter()
                .map(|(id, cover)| CaratulaNueva { id: id.to_string(), cover })
                .collect();
            if let Err(err) = app.emit("caratulas-reducidas", lote) {
                log::warn!("covers: could not tell the window: {err}");
            }
        };
        match reducir_si_falta(&conn, &dir, &mut avisar) {
            Ok(0) => {}
            Ok(n) => {
                log::info!("covers: one-time shrink done in {:?} ({n} tracks)", inicio.elapsed())
            }
            // Se queda sin apuntar como hecha: la próxima vez sigue donde quedó.
            Err(err) => log::error!("covers: one-time shrink stopped: {err}"),
        }
    });
    if let Err(err) = lanzado {
        log::error!("covers: could not start the one-time shrink: {err}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::*;
    use image::{GenericImageView, ImageFormat, RgbImage};

    struct Dir(PathBuf);
    impl Dir {
        fn new(nombre: &str) -> Self {
            let p = std::env::temp_dir()
                .join(format!("cantoral-caratulas-{nombre}-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&p);
            std::fs::create_dir_all(&p).unwrap();
            Dir(p)
        }
    }
    impl Drop for Dir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    /// Una imagen de `w`×`h` en el formato pedido, con un degradado para que
    /// dos tamaños distintos no den los mismos bytes.
    fn imagen(w: u32, h: u32, formato: ImageFormat) -> Vec<u8> {
        let img =
            RgbImage::from_fn(w, h, |x, y| image::Rgb([(x % 256) as u8, (y % 256) as u8, 90]));
        let mut out = Cursor::new(Vec::new());
        DynamicImage::ImageRgb8(img).write_to(&mut out, formato).unwrap();
        out.into_inner()
    }

    fn medidas(ruta: &Path) -> (u32, u32) {
        let bytes = std::fs::read(ruta).unwrap();
        assert_eq!(image::guess_format(&bytes).unwrap(), ImageFormat::Jpeg);
        image::load_from_memory(&bytes).unwrap().dimensions()
    }

    fn archivos(dir: &Path) -> Vec<String> {
        let mut v: Vec<String> = std::fs::read_dir(dir)
            .map(|r| r.flatten().map(|e| e.file_name().to_string_lossy().to_string()).collect())
            .unwrap_or_default();
        v.sort();
        v
    }

    #[test]
    fn a_big_cover_is_shrunk_to_a_small_jpeg_and_a_projection_one() {
        let dir = Dir::new("reduce");
        let png = imagen(1500, 1000, ImageFormat::Png);
        let ruta = guardar(&dir.0, &png).unwrap();
        assert_eq!(medidas(&ruta), (LADO, 107), "el lado largo a {LADO}, sin deformar");
        let grande = PathBuf::from(grande_de(&ruta.to_string_lossy()).unwrap());
        assert_eq!(medidas(&grande), (LADO_GRANDE, 427));
        assert!(std::fs::metadata(&ruta).unwrap().len() < 20_000);
    }

    #[test]
    fn a_small_cover_is_not_enlarged() {
        let bytes = reducir(&imagen(100, 120, ImageFormat::Jpeg), LADO).unwrap();
        assert_eq!(image::load_from_memory(&bytes).unwrap().dimensions(), (100, 120));
    }

    #[test]
    fn the_same_art_is_written_once_for_every_track_that_carries_it() {
        let dir = Dir::new("comparte");
        let jpg = imagen(600, 600, ImageFormat::Jpeg);
        let a = guardar(&dir.0, &jpg).unwrap();
        let b = guardar(&dir.0, &jpg).unwrap();
        assert_eq!(a, b);
        let otra = guardar(&dir.0, &imagen(601, 600, ImageFormat::Jpeg)).unwrap();
        assert_ne!(a, otra);
        assert_eq!(archivos(&dir.0).len(), 4, "dos imágenes, dos tamaños cada una");
    }

    #[test]
    fn what_is_not_an_image_gives_no_cover_and_no_panic() {
        let dir = Dir::new("corrupta");
        assert_eq!(guardar(&dir.0, b"esto no es una imagen"), None);
        assert_eq!(guardar(&dir.0, &[]), None);
        // Un JPEG cortado a la mitad.
        let mut cortado = imagen(400, 400, ImageFormat::Jpeg);
        cortado.truncate(cortado.len() / 3);
        cortado[200..260].fill(0xFF);
        let _ = guardar(&dir.0, &cortado);
        // Una cabecera PNG que promete una imagen enorme.
        let mut bomba = imagen(4, 4, ImageFormat::Png);
        bomba[16..20].copy_from_slice(&100_000u32.to_be_bytes());
        bomba[20..24].copy_from_slice(&100_000u32.to_be_bytes());
        assert_eq!(guardar(&dir.0, &bomba), None);
        assert!(archivos(&dir.0).iter().all(|n| !n.ends_with(".tmp")));
    }

    #[test]
    fn only_shrunk_covers_have_a_projection_sibling() {
        assert_eq!(
            grande_de("/c/a-0123456789abcdef.jpg").as_deref(),
            Some("/c/a-0123456789abcdef-g.jpg")
        );
        assert_eq!(grande_de("/c/12.jpg"), None, "una de antes o una miniatura de video");
        assert_eq!(grande_de("/c/a-0123456789abcdef-g.jpg"), None);
        assert_eq!(grande_de("/c/a-xyz.jpg"), None);
    }

    fn pista(conn: &Connection, id: i64) -> crate::models::Track {
        list_tracks(conn).unwrap().into_iter().find(|t| t.id == id.to_string()).unwrap()
    }

    #[test]
    fn the_one_time_pass_shrinks_old_covers_and_runs_once() {
        let dir = Dir::new("pasada");
        let covers = dir.0.join("covers");
        std::fs::create_dir_all(&covers).unwrap();
        let conn = open_and_migrate(&dir.0.join("cantoral.db")).unwrap();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let mut ids = Vec::new();
        // Tres pistas del mismo disco, cada una con su copia del arte, como
        // las dejaba el escaneo de antes; y un video con su miniatura.
        let arte = imagen(1200, 1200, ImageFormat::Jpeg);
        for i in 0..3 {
            let id = upsert_track(
                &conn,
                fid,
                &format!("/m/{i}.mp3"),
                "T",
                "",
                "",
                1,
                "MP3",
                false,
                1,
                1,
            )
            .unwrap();
            let vieja = covers.join(format!("{id}.jpg"));
            std::fs::write(&vieja, &arte).unwrap();
            set_cover_path(&conn, id, &vieja.to_string_lossy()).unwrap();
            ids.push(id);
        }
        let video =
            upsert_track(&conn, fid, "/m/v.mp4", "V", "", "", 1, "MP4", true, 1, 1).unwrap();
        let mini = covers.join(format!("{video}.jpg"));
        std::fs::write(&mini, imagen(320, 180, ImageFormat::Jpeg)).unwrap();
        set_video_thumbnail(&conn, video, &mini.to_string_lossy()).unwrap();

        let mut avisos = Vec::new();
        let n = reducir_si_falta(&conn, &covers, &mut |c| avisos.extend(c)).unwrap();
        assert_eq!(n, 3);
        assert_eq!(avisos.len(), 3);
        let nueva = pista(&conn, ids[0]).cover.unwrap();
        assert!(es_reducida(&nueva));
        assert!(ids.iter().all(|id| pista(&conn, *id).cover.as_deref() == Some(nueva.as_str())));
        assert_eq!(medidas(Path::new(&nueva)), (LADO, LADO));
        assert_eq!(pista(&conn, video).cover.as_deref(), Some(mini.to_string_lossy().as_ref()));
        // Las viejas se fueron; quedan la compartida, su grande y la del video.
        assert_eq!(archivos(&covers).len(), 3, "{:?}", archivos(&covers));

        // Otra vez: no hace nada, ni aunque aparezca algo de antes.
        let vieja = covers.join("99.jpg");
        std::fs::write(&vieja, &arte).unwrap();
        set_cover_path(&conn, ids[1], &vieja.to_string_lossy()).unwrap();
        assert_eq!(reducir_si_falta(&conn, &covers, &mut |_| panic!("no toca")).unwrap(), 0);
        // Y la pasada en sí es idempotente: lo ya reducido no se vuelve a tocar.
        assert_eq!(reducir_existentes(&conn, &covers, &mut |_| {}).unwrap(), 1);
        assert_eq!(reducir_existentes(&conn, &covers, &mut |_| {}).unwrap(), 0);
    }

    #[test]
    fn a_shared_cover_stays_until_the_last_track_that_uses_it_goes() {
        let dir = Dir::new("compartida");
        let covers = dir.0.join("covers");
        let conn = open_and_migrate(&dir.0.join("cantoral.db")).unwrap();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let arte = imagen(800, 800, ImageFormat::Jpeg);
        let ruta = guardar(&covers, &arte).unwrap();
        let grande = PathBuf::from(grande_de(&ruta.to_string_lossy()).unwrap());
        let mut ids = Vec::new();
        for i in 0..5 {
            let id = upsert_track(
                &conn,
                fid,
                &format!("/m/{i}.mp3"),
                "T",
                "",
                "",
                1,
                "MP3",
                false,
                1,
                1,
            )
            .unwrap();
            set_cover_path(&conn, id, &ruta.to_string_lossy()).unwrap();
            ids.push(id);
        }

        delete_track(&conn, ids[0]).unwrap();
        assert!(
            ruta.exists() && grande.exists(),
            "quitar una del disco no deja sin carátula al resto"
        );
        delete_tracks(&conn, &ids[1..3]).unwrap();
        assert!(ruta.exists());
        // Un reescaneo que le pone otro arte a una tampoco la borra.
        let otra = guardar(&covers, &imagen(300, 300, ImageFormat::Png)).unwrap();
        set_cover_path(&conn, ids[3], &otra.to_string_lossy()).unwrap();
        assert!(ruta.exists());
        // Fusionar copias que traen el mismo arte que la que se queda.
        let copia =
            upsert_track(&conn, fid, "/m/copia.mp3", "T", "", "", 1, "MP3", false, 1, 1).unwrap();
        set_cover_path(&conn, copia, &ruta.to_string_lossy()).unwrap();
        merge_tracks(&conn, ids[4], &[copia]).unwrap();
        assert!(ruta.exists());

        // La última que la usaba se va con su carpeta: ahora sí, las dos.
        remove_folder(&conn, fid).unwrap();
        assert!(!ruta.exists() && !grande.exists());
        assert!(!otra.exists());
        assert!(archivos(&covers).is_empty(), "{:?}", archivos(&covers));
    }

    #[test]
    fn an_old_cover_that_cannot_be_read_is_left_as_it_was() {
        let dir = Dir::new("pasada-rota");
        let covers = dir.0.join("covers");
        std::fs::create_dir_all(&covers).unwrap();
        let conn = open_and_migrate(&dir.0.join("cantoral.db")).unwrap();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let id = upsert_track(&conn, fid, "/m/a.mp3", "A", "", "", 1, "MP3", false, 1, 1).unwrap();
        let rota = covers.join(format!("{id}.jpg"));
        std::fs::write(&rota, b"no soy un jpeg").unwrap();
        set_cover_path(&conn, id, &rota.to_string_lossy()).unwrap();
        let sin_archivo =
            upsert_track(&conn, fid, "/m/b.mp3", "B", "", "", 1, "MP3", false, 1, 1).unwrap();
        set_cover_path(&conn, sin_archivo, &covers.join("nada.jpg").to_string_lossy()).unwrap();

        assert_eq!(reducir_si_falta(&conn, &covers, &mut |_| {}).unwrap(), 0);
        assert_eq!(pista(&conn, id).cover.as_deref(), Some(rota.to_string_lossy().as_ref()));
        assert!(rota.exists());
        assert_eq!(get_setting(&conn, AJUSTE_REDUCIDAS).unwrap().as_deref(), Some("1"));
    }
}
