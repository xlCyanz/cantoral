use anyhow::Result;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::Probe;
use lofty::tag::Accessor;
use rusqlite::Connection;
use std::path::Path;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

use crate::db;
use crate::models::ScanProgress;

const AUDIO_EXTS: &[&str] = &["mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "wma", "aiff", "aif"];
const VIDEO_EXTS: &[&str] = &["mp4", "mov", "mkv", "avi", "webm", "m4v", "wmv"];

fn ext_lower(p: &Path) -> Option<String> {
    p.extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase())
}

fn is_media(ext: &str) -> bool {
    AUDIO_EXTS.contains(&ext) || VIDEO_EXTS.contains(&ext)
}

/// Best-effort metadata read via lofty. Returns (title, artist, album, dur_sec).
fn read_meta(path: &Path) -> (Option<String>, Option<String>, Option<String>, i64) {
    match Probe::open(path).and_then(|p| p.read()) {
        Ok(tagged) => {
            let dur = tagged.properties().duration().as_secs() as i64;
            let tag = tagged.primary_tag().or_else(|| tagged.first_tag());
            let title = tag.and_then(|t| t.title()).map(|c| c.to_string());
            let artist = tag.and_then(|t| t.artist()).map(|c| c.to_string());
            let album = tag.and_then(|t| t.album()).map(|c| c.to_string());
            (title, artist, album, dur)
        }
        Err(_) => (None, None, None, 0),
    }
}

/// Recursively index a folder, upserting every media file and emitting
/// `scan-progress` events. Returns the number of files indexed.
pub fn scan_folder(
    app: &AppHandle,
    conn: &Connection,
    folder_id: i64,
    root: &str,
) -> Result<i64> {
    // Collect media paths first so progress has a denominator.
    let files: Vec<_> = WalkDir::new(root)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| ext_lower(e.path()).map(|x| is_media(&x)).unwrap_or(false))
        .collect();

    let total = files.len().max(1);
    let mut count: i64 = 0;

    for (i, entry) in files.iter().enumerate() {
        let path = entry.path();
        let ext = ext_lower(path).unwrap_or_default();
        let video = VIDEO_EXTS.contains(&ext.as_str());
        let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Sin título");

        let (title, artist, album, dur) = read_meta(path);
        let titulo = title.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| stem.to_string());

        db::upsert_track(
            conn,
            folder_id,
            &path.to_string_lossy(),
            &titulo,
            artist.as_deref().unwrap_or(""),
            album.as_deref().unwrap_or(""),
            dur,
            &ext.to_uppercase(),
            video,
        )?;
        count += 1;

        let pct = ((i + 1) as f64 / total as f64) * 100.0;
        let _ = app.emit(
            "scan-progress",
            ScanProgress {
                folder_id: folder_id.to_string(),
                pct,
                file: entry.file_name().to_string_lossy().to_string(),
                done: false,
                added: count,
            },
        );
    }

    db::touch_folder_scan(conn, folder_id)?;
    let _ = app.emit(
        "scan-progress",
        ScanProgress {
            folder_id: folder_id.to_string(),
            pct: 100.0,
            file: String::new(),
            done: true,
            added: count,
        },
    );
    Ok(count)
}
