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
    pub tono: String,
    pub bpm: i64,
    pub ocasion: String,
    pub formato: String,
    /// Friendly name of the owning folder.
    pub carpeta: String,
    pub tags: Vec<String>,
    pub fav: bool,
    pub missing: bool,
    /// Recency ordinal (row id) — higher means added more recently.
    pub added: i64,
    pub video: bool,
    pub path: String,
    /// Absolute path to the extracted embedded cover art, if any.
    pub cover: Option<String>,
    /// Whether this track has lyrics or chords written down.
    ///
    /// A flag rather than the sheet itself: the catalogue travels whole on
    /// every refresh, and a few thousand sheets would turn every snapshot into
    /// megabytes of text nothing on that screen is going to read.
    pub tiene_hoja: bool,
}

/// The lyrics and chords of one track, fetched only when something shows them.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sheet {
    pub track_id: String,
    pub letra: String,
    /// ChordPro, e.g. `[Sol]Sublime [Do]gracia`.
    pub acordes: String,
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
    pub fecha: String,
    pub ocasion: String,
    pub ids: Vec<String>,
    /// A list kept as a starting point rather than as a service of its own.
    pub plantilla: bool,
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
    pub tags: Vec<String>,
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
}

/// Format seconds as m:ss.
pub fn fmt_dur(sec: i64) -> String {
    let s = sec.max(0);
    format!("{}:{:02}", s / 60, s % 60)
}
