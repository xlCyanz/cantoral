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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    pub id: String,
    pub nombre: String,
    pub fecha: String,
    pub ocasion: String,
    pub ids: Vec<String>,
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
}

/// Format seconds as m:ss.
pub fn fmt_dur(sec: i64) -> String {
    let s = sec.max(0);
    format!("{}:{:02}", s / 60, s % 60)
}
