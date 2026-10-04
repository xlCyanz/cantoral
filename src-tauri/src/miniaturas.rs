//! Las miniaturas de los videos.
//!
//! El núcleo no decodifica video —meter ffmpeg sería triplicar lo que pesa la
//! app y complicar la firma—, así que el fotograma lo saca la webview, que ya
//! sabe reproducirlos, y aquí solo se guarda. Lo que llega de la webview no se
//! da por bueno: el nombre del archivo sale del id de la pista y nunca de una
//! ruta que mande ella, va siempre a la carpeta de carátulas, y tiene que ser
//! una imagen JPEG o PNG de un tamaño razonable.

use std::path::Path;

use anyhow::{bail, Result};
use rusqlite::Connection;

use crate::db;

/// Lo más que puede pesar una miniatura. Un fotograma de 320 px en JPEG ronda
/// los 20 KB; esto deja margen de sobra y cierra la puerta a llenar el disco.
pub const MAX_BYTES: usize = 512 * 1024;

/// La extensión que corresponde a `bytes`, si son un JPEG o un PNG.
///
/// Se mira la firma del principio y no lo que diga quien lo manda.
pub fn formato(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("jpg")
    } else if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        Some("png")
    } else {
        None
    }
}

/// Guardar la miniatura del video `id` y apuntarla en su pista.
///
/// Devuelve la ruta escrita, o `None` si la pista ya no es ese video en ese
/// archivo —se reubicó o se quitó mientras la webview sacaba el fotograma—, y
/// entonces no se escribe nada. Quien llama tiene la base tomada, así que
/// entre la comprobación y la escritura nadie la cambia.
pub fn guardar(
    conn: &Connection,
    cover_dir: &Path,
    id: i64,
    path: &str,
    bytes: &[u8],
) -> Result<Option<String>> {
    if bytes.len() > MAX_BYTES {
        bail!("La miniatura pesa demasiado ({} KB).", bytes.len() / 1024);
    }
    let Some(ext) = formato(bytes) else {
        bail!("La miniatura no es una imagen JPEG ni PNG.");
    };
    if !db::sigue_siendo_video(conn, id, path)? {
        return Ok(None);
    }
    std::fs::create_dir_all(cover_dir)?;
    let destino = cover_dir.join(format!("{id}.{ext}"));
    std::fs::write(&destino, bytes)?;
    let destino = destino.to_string_lossy().to_string();
    db::set_video_thumbnail(conn, id, &destino)?;
    Ok(Some(destino))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::*;

    const JPEG: &[u8] = &[0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, b'J', b'F', b'I', b'F'];
    const PNG: &[u8] = &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0];

    struct Dir(std::path::PathBuf);
    impl Dir {
        fn new(nombre: &str) -> Self {
            let p = std::env::temp_dir()
                .join(format!("cantoral-miniaturas-{nombre}-{}", std::process::id()));
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

    fn base(dir: &Dir) -> (Connection, i64, i64) {
        let conn = open_and_migrate(&dir.0.join("cantoral.db")).unwrap();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let video = upsert_track(&conn, fid, "/m/v.mp4", "Video", "", "", 30, "MP4", true, 10, 100)
            .unwrap();
        let audio =
            upsert_track(&conn, fid, "/m/a.mp3", "Audio", "", "", 30, "MP3", false, 10, 100)
                .unwrap();
        (conn, video, audio)
    }

    fn pista(conn: &Connection, id: i64) -> crate::models::Track {
        list_tracks(conn).unwrap().into_iter().find(|t| t.id == id.to_string()).unwrap()
    }

    fn archivos(dir: &Path) -> Vec<String> {
        let mut v: Vec<String> = std::fs::read_dir(dir)
            .map(|r| r.flatten().map(|e| e.file_name().to_string_lossy().to_string()).collect())
            .unwrap_or_default();
        v.sort();
        v
    }

    #[test]
    fn a_thumbnail_lands_in_the_covers_dir_named_after_the_track() {
        let dir = Dir::new("guarda");
        let (conn, video, _) = base(&dir);
        let covers = dir.0.join("covers");
        let ruta = guardar(&conn, &covers, video, "/m/v.mp4", JPEG).unwrap().unwrap();
        assert_eq!(Path::new(&ruta), covers.join(format!("{video}.jpg")));
        assert_eq!(std::fs::read(&ruta).unwrap(), JPEG);
        let t = pista(&conn, video);
        assert_eq!(t.cover.as_deref(), Some(ruta.as_str()));
        assert!(!t.miniatura_fallida);
    }

    #[test]
    fn a_png_keeps_its_extension() {
        let dir = Dir::new("png");
        let (conn, video, _) = base(&dir);
        let covers = dir.0.join("covers");
        let ruta = guardar(&conn, &covers, video, "/m/v.mp4", PNG).unwrap().unwrap();
        assert!(ruta.ends_with(&format!("{video}.png")));
    }

    #[test]
    fn what_is_not_an_image_or_is_too_big_is_refused() {
        let dir = Dir::new("rechaza");
        let (conn, video, _) = base(&dir);
        let covers = dir.0.join("covers");
        assert!(guardar(&conn, &covers, video, "/m/v.mp4", b"<svg onload=x>").is_err());
        assert!(guardar(&conn, &covers, video, "/m/v.mp4", &[]).is_err());
        let mut grande = JPEG.to_vec();
        grande.resize(MAX_BYTES + 1, 0);
        assert!(guardar(&conn, &covers, video, "/m/v.mp4", &grande).is_err());
        assert!(archivos(&covers).is_empty());
        assert_eq!(pista(&conn, video).cover, None);
    }

    #[test]
    fn a_track_that_moved_or_is_not_a_video_gets_nothing() {
        let dir = Dir::new("ajena");
        let (conn, video, audio) = base(&dir);
        let covers = dir.0.join("covers");
        // La pista ya apunta a otro archivo: el fotograma era del de antes.
        assert_eq!(guardar(&conn, &covers, video, "/m/viejo.mp4", JPEG).unwrap(), None);
        // Una pista de audio tiene su carátula, y no la pisa la webview.
        assert_eq!(guardar(&conn, &covers, audio, "/m/a.mp3", JPEG).unwrap(), None);
        // Ni una que no existe.
        assert_eq!(guardar(&conn, &covers, 9999, "/m/v.mp4", JPEG).unwrap(), None);
        assert!(archivos(&covers).is_empty());
    }

    #[test]
    fn the_file_name_comes_from_the_id_never_from_the_path() {
        // Una ruta con `..` no lleva el archivo a ningún sitio: solo sirve
        // para comprobar que la pista sigue en ella.
        let dir = Dir::new("confinada");
        let conn = open_and_migrate(&dir.0.join("cantoral.db")).unwrap();
        let fid = add_folder(&conn, "/m", "m", true).unwrap();
        let raro = "/m/../../etc/passwd.mp4";
        let id = upsert_track(&conn, fid, raro, "Raro", "", "", 1, "MP4", true, 1, 1).unwrap();
        let covers = dir.0.join("covers");
        guardar(&conn, &covers, id, raro, JPEG).unwrap().unwrap();
        assert_eq!(archivos(&covers), vec![format!("{id}.jpg")]);
        let fuera: Vec<String> =
            archivos(&dir.0).into_iter().filter(|n| !n.starts_with("cantoral.db")).collect();
        assert_eq!(fuera, vec!["covers".to_string()]);
    }

    #[test]
    fn a_failure_is_recorded_and_cleared_when_the_file_changes() {
        let dir = Dir::new("fallo");
        let (conn, video, audio) = base(&dir);
        mark_thumbnail_failed(&conn, video, "/m/v.mp4").unwrap();
        mark_thumbnail_failed(&conn, audio, "/m/a.mp3").unwrap();
        assert!(pista(&conn, video).miniatura_fallida);
        assert!(!pista(&conn, audio).miniatura_fallida);
        // Sigue marcada al recargar: no se vuelve a intentar en el arranque.
        drop(conn);
        let conn = open_and_migrate(&dir.0.join("cantoral.db")).unwrap();
        assert!(pista(&conn, video).miniatura_fallida);
        // El archivo cambió (otra fecha, otro tamaño): vale la pena otra vez.
        let fid = add_folder(&conn, "/n", "n", true).unwrap();
        upsert_track(&conn, fid, "/m/v.mp4", "Video", "", "", 30, "MP4", true, 11, 200).unwrap();
        assert!(!pista(&conn, video).miniatura_fallida);
    }

    #[test]
    fn a_stale_failure_does_not_mark_a_relocated_video() {
        let dir = Dir::new("fallo-viejo");
        let (conn, video, _) = base(&dir);
        mark_thumbnail_failed(&conn, video, "/m/otro.mp4").unwrap();
        assert!(!pista(&conn, video).miniatura_fallida);
    }

    #[test]
    fn deleting_the_track_or_its_folder_deletes_the_thumbnail() {
        let dir = Dir::new("borra");
        let (conn, video, _) = base(&dir);
        let covers = dir.0.join("covers");
        let ruta = guardar(&conn, &covers, video, "/m/v.mp4", JPEG).unwrap().unwrap();
        delete_track(&conn, video).unwrap();
        assert!(!Path::new(&ruta).exists());

        let fid = add_folder(&conn, "/k", "k", true).unwrap();
        let otro = upsert_track(&conn, fid, "/k/v.mp4", "V", "", "", 1, "MP4", true, 1, 1).unwrap();
        let ruta = guardar(&conn, &covers, otro, "/k/v.mp4", JPEG).unwrap().unwrap();
        remove_folder(&conn, fid).unwrap();
        assert!(!Path::new(&ruta).exists());
    }

    #[test]
    fn a_rescan_keeps_the_thumbnail() {
        let dir = Dir::new("reescaneo");
        let (conn, video, _) = base(&dir);
        let covers = dir.0.join("covers");
        let ruta = guardar(&conn, &covers, video, "/m/v.mp4", JPEG).unwrap().unwrap();
        // Lo que hace el escaneo con un archivo que cambió y con uno que no.
        let fid = add_folder(&conn, "/n", "n", true).unwrap();
        upsert_track(&conn, fid, "/m/v.mp4", "Video", "", "", 30, "MP4", true, 12, 300).unwrap();
        touch_existing_track(&conn, video, fid).unwrap();
        assert_eq!(pista(&conn, video).cover.as_deref(), Some(ruta.as_str()));
        assert!(Path::new(&ruta).exists());
    }

    #[test]
    fn a_new_thumbnail_in_another_format_removes_the_old_file() {
        let dir = Dir::new("reemplaza");
        let (conn, video, _) = base(&dir);
        let covers = dir.0.join("covers");
        let jpg = guardar(&conn, &covers, video, "/m/v.mp4", JPEG).unwrap().unwrap();
        let png = guardar(&conn, &covers, video, "/m/v.mp4", PNG).unwrap().unwrap();
        assert!(!Path::new(&jpg).exists());
        assert!(Path::new(&png).exists());
    }
}
