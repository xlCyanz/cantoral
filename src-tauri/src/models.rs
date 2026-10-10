use serde::{Deserialize, Serialize};

/// A catalogued track. Field names serialize to the exact shape the
/// frontend `Track` type expects (camelCase).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub titulo: String,
    pub artista: String,
    pub album: String,
    /// Human-readable duration, e.g. "4:12".
    pub dur: String,
    pub dur_sec: i64,
    pub ocasion: String,
    pub formato: String,
    /// Friendly name of the owning folder.
    pub carpeta: String,
    pub fav: bool,
    pub missing: bool,
    /// Recency ordinal (row id) — higher means added more recently.
    pub added: i64,
    pub video: bool,
    pub path: String,
    /// Absolute path to the extracted embedded cover art, if any.
    pub cover: Option<String>,
    /// Whether it came in with the latest scan: what «Recién agregadas» shows
    /// (#139). A rescan that finds nothing new leaves no track marked.
    pub nueva: bool,
    /// Si es un video del que la webview no pudo sacar miniatura. No se vuelve
    /// a intentar hasta que el archivo cambie.
    pub miniatura_fallida: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub nombre: String,
    pub ruta: String,
    pub count: i64,
    /// RFC3339 timestamp of the last scan, if scanned.
    pub last_scan: Option<String>,
    /// Whether scans of this folder descend into subfolders.
    pub recursive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    pub id: String,
    pub nombre: String,
    pub ocasion: String,
    pub ids: Vec<String>,
    /// A list kept as a starting point rather than as a service of its own.
    pub plantilla: bool,
    /// RFC3339, UTC: la última vez que se abrió o se cambió. Lo que ordena.
    pub tocada: String,
    /// Los momentos sin música del culto (#145). Su sitio en el orden lo dice
    /// `ids`, donde aparecen por su `id` («m:12») entre los de las pistas.
    #[serde(default)]
    pub momentos: Vec<Momento>,
}

/// Un momento del culto que no es una pista: una oración, una lectura, los
/// anuncios (#145). En la proyección sale su título sobre negro y la cola se
/// detiene ahí hasta que quien opera pulsa «Siguiente».
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Momento {
    /// `m:` y el id de la fila, para que no se confunda con el de una pista
    /// dentro del orden del culto.
    pub id: String,
    /// «oracion», «lectura», «anuncios», «ofrenda», «mensaje» u «otro».
    pub tipo: String,
    pub titulo: String,
    /// Opcional: la cita de la lectura, quién predica.
    pub texto: String,
}

/// One track inside a group of suspected duplicates.
///
/// Its own shape rather than a `Track`: what the user needs in order to choose
/// between two copies is the file — where it lives, what format it is, how big
/// it is — and that is not what the library table shows.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateTrack {
    pub id: String,
    pub titulo: String,
    pub artista: String,
    pub path: String,
    pub formato: String,
    /// Friendly name of the owning folder.
    pub carpeta: String,
    pub dur: String,
    pub dur_sec: i64,
    /// Size on disk in bytes, 0 when the file could not be stat'd.
    pub fsize: i64,
    pub fav: bool,
    pub missing: bool,
}

/// A set of tracks that look like the same song.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGroup {
    /// Stable identity of the group: its track ids, sorted, joined by `-`.
    /// What a dismissal is remembered by.
    pub signature: String,
    /// Why these ended up together: `archivo` or `titulo`.
    pub motivo: String,
    /// The copy worth keeping, as a starting point for the user's own choice.
    pub sugerido: String,
    pub tracks: Vec<DuplicateTrack>,
}

/// Progress payload emitted during a folder scan.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub folder_id: String,
    pub pct: f64,
    pub file: String,
    pub done: bool,
    pub added: i64,
    /// Archivos de medios que se reconocieron y no se indexaron porque ningún
    /// motor de webview los decodifica.
    pub omitidos: i64,
    /// Archivos que se indexaron sin metadatos porque leerlos hizo *panic* en
    /// `lofty` (#131). Entran con el nombre del archivo por título.
    pub ilegibles: i64,
    /// Media files the walk found: what `added` counts up to. «120 de 3 400»
    /// says more than «4 %» to someone deciding whether to wait (#139).
    pub total: i64,
}

/// Format seconds as m:ss.
pub fn fmt_dur(sec: i64) -> String {
    let s = sec.max(0);
    format!("{}:{:02}", s / 60, s % 60)
}
