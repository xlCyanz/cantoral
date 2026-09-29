//! El archivo `.cantoral.json` con el que una lista viaja a otra instalación.
//!
//! Lleva lo justo para volver a encontrar cada pista en otro catálogo —nunca
//! el audio, que es precisamente lo que la app promete no mover— y nunca la
//! ruta absoluta de donde estaba: el nombre del archivo basta para emparejar,
//! y una ruta completa diría a quien reciba el archivo cómo tiene organizado
//! el disco quien lo mandó.

use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Version of the file format, written into every export.
///
/// A reader that meets a number it does not know says so instead of guessing:
/// a list quietly imported with half its fields missing is worse than one that
/// refused to be imported at all.
///
/// El 2 añade `momentos` (#145). Un culto sin momentos se sigue escribiendo
/// como 1, para que una instalación de antes lo pueda abrir; uno con momentos
/// sale como 2 y la de antes pide que la actualicen en vez de perder la
/// oración por el camino sin decirlo.
pub const VERSION: u32 = 2;

/// What a shared playlist file holds.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistFile {
    /// Format version. Not `version`, so the key itself identifies the file.
    pub cantoral: u32,
    pub lista: SharedPlaylist,
    pub pistas: Vec<SharedTrack>,
    /// Los momentos sin música del culto (#145). Ausentes en un archivo de
    /// antes, que es lo mismo que no tener ninguno.
    #[serde(default)]
    pub momentos: Vec<SharedMomento>,
    /// When it was exported, RFC3339. Only ever shown, never acted on.
    #[serde(default)]
    pub exportado: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedPlaylist {
    pub nombre: String,
    #[serde(default)]
    pub ocasion: String,
    #[serde(default)]
    pub plantilla: bool,
}

/// One track, as much of it as is needed to find it again somewhere else.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedTrack {
    pub titulo: String,
    #[serde(default)]
    pub artista: String,
    #[serde(default)]
    pub album: String,
    #[serde(default)]
    pub dur_sec: i64,
    #[serde(default)]
    pub ocasion: String,
    /// File name only — never the path it sat at on the other machine.
    #[serde(default)]
    pub archivo: String,
}

/// Un momento sin música, con su sitio contado en pistas.
///
/// `tras_pistas` es cuántas pistas del archivo van antes que él. Se cuenta en
/// pistas y no en posiciones porque del otro lado pueden faltar algunas, y el
/// momento tiene que quedar junto a las canciones que lo rodeaban.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedMomento {
    #[serde(default)]
    pub tras_pistas: usize,
    #[serde(default)]
    pub tipo: String,
    #[serde(default)]
    pub titulo: String,
    #[serde(default)]
    pub texto: String,
}

/// Whether a destination ends in `.json`.
///
/// Same guard as the sheet export, and for the same reason: neither command
/// may become a way to write arbitrary bytes to an arbitrary path.
pub fn es_json(dest: &str) -> bool {
    Path::new(dest)
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.eq_ignore_ascii_case("json"))
        .unwrap_or(false)
}

/// Read a shared playlist file, confirming it is one before returning it.
///
/// Every refusal names what is wrong, because the alternative is a user
/// staring at a file dialog wondering why nothing happened.
pub fn leer(path: &Path) -> Result<PlaylistFile> {
    if !path.exists() {
        bail!("El archivo «{}» no existe.", path.display());
    }
    let crudo = std::fs::read_to_string(path)
        .with_context(|| format!("«{}» no se pudo leer.", path.display()))?;
    // Untyped first, so «this is not a Cantoral list» and «this is not even
    // JSON» are different messages.
    let valor: serde_json::Value = serde_json::from_str(&crudo)
        .context("El archivo no es JSON válido, así que no salió de Cantoral.")?;
    let Some(v) = valor.get("cantoral").and_then(serde_json::Value::as_u64) else {
        bail!("El archivo no es una lista exportada de Cantoral.");
    };
    if v > VERSION as u64 {
        bail!(
            "Esta lista se exportó con una versión más nueva de Cantoral (formato {v}). \
             Actualiza la app para abrirla."
        );
    }
    let mut archivo: PlaylistFile =
        serde_json::from_value(valor).context("La lista exportada está incompleta.")?;
    // Un momento sin título no tendría nada que enseñar: se deja fuera en vez
    // de tirar el archivo entero por él.
    archivo.momentos.retain(|m| !m.titulo.trim().is_empty());
    if archivo.lista.nombre.trim().is_empty() {
        bail!("La lista exportada no tiene nombre.");
    }
    Ok(archivo)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A temp directory of this test's own, cleared when it goes out of scope.
    struct Dir(std::path::PathBuf);

    impl Dir {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!("cantoral-compartir-{name}"));
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).unwrap();
            Dir(dir)
        }
        fn escribir(&self, name: &str, contenido: &str) -> std::path::PathBuf {
            let p = self.0.join(name);
            std::fs::write(&p, contenido).unwrap();
            p
        }
    }

    impl Drop for Dir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    const MINIMO: &str = r#"{"cantoral":1,"lista":{"nombre":"Culto"},"pistas":[]}"#;

    #[test]
    fn a_file_this_app_wrote_reads_back_whole() {
        let dir = Dir::new("round-trip");
        let original = PlaylistFile {
            cantoral: VERSION,
            lista: SharedPlaylist {
                nombre: "Culto 4 Ene".into(),
                ocasion: "Servicio dominical".into(),
                plantilla: false,
            },
            pistas: vec![SharedTrack {
                titulo: "Sublime Gracia".into(),
                artista: "Coro Congregacional".into(),
                album: "Himnos".into(),
                dur_sec: 252,
                ocasion: "Adoración".into(),
                archivo: "sublime.mp3".into(),
            }],
            momentos: vec![SharedMomento {
                tras_pistas: 1,
                tipo: "oracion".into(),
                titulo: "Oración".into(),
                texto: "Pastor Luis".into(),
            }],
            exportado: "2026-01-01T00:00:00Z".into(),
        };
        let p = dir.escribir("lista.json", &serde_json::to_string(&original).unwrap());

        let leido = leer(&p).unwrap();

        assert_eq!(leido.lista.nombre, "Culto 4 Ene");
        assert_eq!(leido.lista.ocasion, "Servicio dominical");
        assert_eq!(leido.pistas.len(), 1);
        assert_eq!(leido.pistas[0].titulo, "Sublime Gracia");
        assert_eq!(leido.pistas[0].dur_sec, 252);
        assert_eq!(leido.pistas[0].archivo, "sublime.mp3");
        assert_eq!(leido.momentos.len(), 1);
        assert_eq!(leido.momentos[0].tras_pistas, 1);
        assert_eq!(leido.momentos[0].titulo, "Oración");
        assert_eq!(leido.momentos[0].texto, "Pastor Luis");
    }

    #[test]
    fn a_file_from_before_moments_existed_opens_with_none() {
        // Formato 1, escrito antes de #145: no trae la clave `momentos`.
        let dir = Dir::new("sin-momentos");
        let p = dir.escribir(
            "lista.json",
            r#"{"cantoral":1,"lista":{"nombre":"Culto"},"pistas":[{"titulo":"Santo"}]}"#,
        );

        let leido = leer(&p).unwrap();

        assert_eq!(leido.pistas.len(), 1);
        assert!(leido.momentos.is_empty());
    }

    #[test]
    fn a_version_2_file_with_moments_is_read() {
        let dir = Dir::new("con-momentos");
        let p = dir.escribir(
            "lista.json",
            r#"{"cantoral":2,"lista":{"nombre":"Culto"},"pistas":[],
                "momentos":[{"trasPistas":0,"tipo":"anuncios","titulo":"Anuncios"}]}"#,
        );

        let leido = leer(&p).unwrap();

        assert_eq!(leido.momentos[0].tipo, "anuncios");
        assert_eq!(leido.momentos[0].texto, "");
    }

    #[test]
    fn a_moment_without_a_title_is_dropped_not_the_whole_file() {
        let dir = Dir::new("momento-sin-titulo");
        let p = dir.escribir(
            "lista.json",
            r#"{"cantoral":2,"lista":{"nombre":"Culto"},"pistas":[],
                "momentos":[{"trasPistas":0,"titulo":"  "},{"trasPistas":0,"titulo":"Oración"}]}"#,
        );

        let leido = leer(&p).unwrap();

        assert_eq!(leido.momentos.len(), 1);
        assert_eq!(leido.momentos[0].titulo, "Oración");
    }

    #[test]
    fn the_optional_fields_may_simply_be_absent() {
        let dir = Dir::new("minimal");
        let p = dir.escribir("lista.json", MINIMO);

        let leido = leer(&p).unwrap();

        assert_eq!(leido.lista.nombre, "Culto");
        assert!(!leido.lista.plantilla);
        assert!(leido.pistas.is_empty());
    }

    #[test]
    fn a_file_from_before_services_lost_their_date_still_opens() {
        // Una versión anterior mandaba `fecha`, y las etiquetas y el tono de
        // cada pista. Nada de eso se lee ya, pero el archivo tiene que abrir:
        // quien lo recibe no eligió con qué versión se exportó.
        let dir = Dir::new("con-fecha");
        let viejo = r#"{"cantoral":1,
            "lista":{"nombre":"Culto","fecha":"2026-01-04","ocasion":"Santa Cena"},
            "pistas":[{"titulo":"Santo","tono":"Re","etiquetas":["lenta"]}]}"#;
        let p = dir.escribir("lista.json", viejo);

        let leido = leer(&p).unwrap();

        assert_eq!(leido.lista.ocasion, "Santa Cena");
        assert_eq!(leido.pistas[0].titulo, "Santo");
    }

    #[test]
    fn something_that_is_not_json_says_so() {
        let dir = Dir::new("not-json");
        let p = dir.escribir("lista.json", "esto no es json");

        let err = leer(&p).unwrap_err().to_string();

        assert!(err.contains("JSON"), "{err}");
    }

    #[test]
    fn json_that_is_not_a_cantoral_list_is_refused() {
        // A `package.json` picked by mistake parses perfectly well.
        let dir = Dir::new("other-json");
        let p = dir.escribir("lista.json", r#"{"name":"algo","version":"1.0.0"}"#);

        let err = leer(&p).unwrap_err().to_string();

        assert!(err.contains("no es una lista exportada"), "{err}");
    }

    #[test]
    fn a_newer_format_is_refused_instead_of_half_read() {
        let dir = Dir::new("newer");
        let p = dir.escribir("lista.json", r#"{"cantoral":99,"lista":{"nombre":"X"},"pistas":[]}"#);

        let err = leer(&p).unwrap_err().to_string();

        assert!(err.contains("versión más nueva"), "{err}");
    }

    #[test]
    fn a_list_without_a_name_is_refused() {
        let dir = Dir::new("nameless");
        let p = dir.escribir("lista.json", r#"{"cantoral":1,"lista":{"nombre":"  "},"pistas":[]}"#);

        assert!(leer(&p).unwrap_err().to_string().contains("no tiene nombre"));
    }

    #[test]
    fn a_file_that_is_not_there_says_that_and_not_something_else() {
        let dir = Dir::new("missing");
        let p = dir.0.join("no-existe.json");

        assert!(leer(&p).unwrap_err().to_string().contains("no existe"));
    }

    #[test]
    fn only_json_may_be_written() {
        assert!(es_json("/tmp/culto.json"));
        // Windows is full of capitals.
        assert!(es_json("/tmp/CULTO.JSON"));
        for malo in ["/tmp/culto.db", "/tmp/culto.sh", "/tmp/culto.html", "/tmp/culto", ""] {
            assert!(!es_json(malo), "{malo} must be refused");
        }
    }
}
