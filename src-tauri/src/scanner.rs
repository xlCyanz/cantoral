use anyhow::Result;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::PictureType;
use lofty::probe::Probe;
use lofty::tag::Accessor;
use rusqlite::Connection;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
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

/// (title, artist, album, dur_sec, cover as (bytes, extension)).
type Meta = (Option<String>, Option<String>, Option<String>, i64, Option<(Vec<u8>, String)>);

/// Best-effort metadata + embedded cover read via lofty.
fn read_meta(path: &Path) -> Meta {
    match Probe::open(path).and_then(|p| p.read()) {
        Ok(tagged) => {
            let dur = tagged.properties().duration().as_secs() as i64;
            let tag = tagged.primary_tag().or_else(|| tagged.first_tag());
            let title = tag.and_then(|t| t.title()).map(|c| c.to_string());
            let artist = tag.and_then(|t| t.artist()).map(|c| c.to_string());
            let album = tag.and_then(|t| t.album()).map(|c| c.to_string());
            let cover = tag.and_then(|t| {
                let pics = t.pictures();
                pics.iter()
                    .find(|p| p.pic_type() == PictureType::CoverFront)
                    .or_else(|| pics.first())
                    .map(|p| {
                        let ext = match p.mime_type().map(|m| m.to_string().to_lowercase()) {
                            Some(s) if s.contains("png") => "png",
                            Some(s) if s.contains("gif") => "gif",
                            _ => "jpg",
                        };
                        (p.data().to_vec(), ext.to_string())
                    })
            });
            (title, artist, album, dur, cover)
        }
        Err(_) => (None, None, None, 0, None),
    }
}

/// How many files are indexed per transaction. Committing in batches keeps the
/// write lock short enough that the UI's own queries get a turn.
const BATCH: usize = 200;

/// File stamp used to decide whether a track needs re-reading.
fn stamp(path: &Path) -> (i64, i64) {
    match std::fs::metadata(path) {
        Ok(m) => {
            let size = m.len() as i64;
            let mtime = m
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);
            (mtime, size)
        }
        Err(_) => (0, 0),
    }
}

/// Index a folder, upserting every media file and emitting `scan-progress`
/// events. With `recursive` off only the folder's own files are read, never its
/// subfolders. Files whose size and mtime are unchanged since the last scan skip
/// the expensive metadata read. Returns the number of files seen.
///
/// `conn` should be a scan-only connection (see `db::open_secondary`) so the
/// main one stays free for the UI, and `cancel` is polled between files.
/// Progress is reported through `on_progress` rather than emitted directly, so
/// the walk can be exercised without a running Tauri app.
pub fn scan_folder(
    conn: &Connection,
    folder_id: i64,
    root: &str,
    cover_dir: &Path,
    recursive: bool,
    cancel: &AtomicBool,
    on_progress: &dyn Fn(ScanProgress),
) -> Result<i64> {
    let _ = std::fs::create_dir_all(cover_dir);

    // Collect media paths first so progress has a denominator.
    let files: Vec<_> = WalkDir::new(root)
        .max_depth(if recursive { usize::MAX } else { 1 })
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| ext_lower(e.path()).map(|x| is_media(&x)).unwrap_or(false))
        .collect();

    let total = files.len().max(1);
    let mut count: i64 = 0;
    let mut last_pct = -1i64;
    let mut cancelled = false;

    conn.execute_batch("BEGIN")?;
    for (i, entry) in files.iter().enumerate() {
        if cancel.load(Ordering::Relaxed) {
            cancelled = true;
            break;
        }

        let path = entry.path();
        let path_str = path.to_string_lossy().to_string();
        let (mtime, fsize) = stamp(path);

        // Unchanged since the last scan: just re-attach it to the folder.
        let known = db::track_stamp(conn, &path_str)?;
        let unchanged = matches!(known, Some((_, m, s)) if m == mtime && s == fsize && mtime != 0);
        if let (true, Some((id, _, _))) = (unchanged, known) {
            db::touch_existing_track(conn, id, folder_id)?;
        } else {
            let ext = ext_lower(path).unwrap_or_default();
            let video = VIDEO_EXTS.contains(&ext.as_str());
            let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Sin título");

            let (title, artist, album, dur, cover) = read_meta(path);
            let titulo = title.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| stem.to_string());

            let id = db::upsert_track(
                conn,
                folder_id,
                &path_str,
                &titulo,
                artist.as_deref().unwrap_or(""),
                album.as_deref().unwrap_or(""),
                dur,
                &ext.to_uppercase(),
                video,
                mtime,
                fsize,
            )?;
            if let Some((bytes, cover_ext)) = cover {
                let cover_path = cover_dir.join(format!("{}.{}", id, cover_ext));
                if std::fs::write(&cover_path, &bytes).is_ok() {
                    let _ = db::set_cover_path(conn, id, &cover_path.to_string_lossy());
                }
            }
        }
        count += 1;

        if (i + 1) % BATCH == 0 {
            conn.execute_batch("COMMIT; BEGIN;")?;
        }

        // One event per whole percent instead of one per file — a large library
        // would otherwise flood the IPC channel with thousands of messages.
        let pct = ((i + 1) as f64 / total as f64) * 100.0;
        if pct as i64 > last_pct {
            last_pct = pct as i64;
            on_progress(ScanProgress {
                folder_id: folder_id.to_string(),
                pct,
                file: entry.file_name().to_string_lossy().to_string(),
                done: false,
                added: count,
            });
        }
    }
    conn.execute_batch("COMMIT")?;

    if !cancelled {
        db::reconcile_missing(conn, folder_id)?;
        db::touch_folder_scan(conn, folder_id)?;
    }
    on_progress(ScanProgress {
        folder_id: folder_id.to_string(),
        pct: 100.0,
        file: String::new(),
        done: true,
        added: count,
    });
    Ok(count)
}

// ---------------------------------------------------------------- tests

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use rusqlite::Connection;

    /// Temp directory holding a small tree of real (silent) WAV files.
    struct Tree(std::path::PathBuf);

    impl Tree {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!("cantoral-scan-{name}"));
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(dir.join("Coros/Anidada")).unwrap();
            let t = Tree(dir);
            for f in ["raiz-uno.wav", "raiz-dos.wav"] {
                t.write(f);
            }
            for f in ["Coros/sub-uno.wav", "Coros/sub-dos.wav"] {
                t.write(f);
            }
            t.write("Coros/Anidada/profunda.wav");
            t.write("notas.txt"); // ignored: not media
            t
        }

        fn write(&self, rel: &str) {
            // Minimal 16-bit mono WAV with a handful of silent frames.
            let frames = vec![0u8; 800];
            let mut b = Vec::new();
            b.extend(b"RIFF");
            b.extend(((36 + frames.len()) as u32).to_le_bytes());
            b.extend(b"WAVEfmt ");
            b.extend(16u32.to_le_bytes());
            b.extend(1u16.to_le_bytes());
            b.extend(1u16.to_le_bytes());
            b.extend(8000u32.to_le_bytes());
            b.extend(16000u32.to_le_bytes());
            b.extend(2u16.to_le_bytes());
            b.extend(16u16.to_le_bytes());
            b.extend(b"data");
            b.extend((frames.len() as u32).to_le_bytes());
            b.extend(&frames);
            std::fs::write(self.0.join(rel), b).unwrap();
        }

        fn path(&self) -> String {
            self.0.to_string_lossy().to_string()
        }
    }

    impl Drop for Tree {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn setup(tree: &Tree) -> (Connection, i64, std::path::PathBuf) {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(db::SCHEMA).unwrap();
        let fid = db::add_folder(&conn, &tree.path(), "test", true).unwrap();
        let covers = tree.0.join("__covers");
        (conn, fid, covers)
    }

    fn scan(
        conn: &Connection,
        fid: i64,
        tree: &Tree,
        covers: &std::path::Path,
        recursive: bool,
        cancel: &AtomicBool,
    ) -> i64 {
        scan_folder(conn, fid, &tree.path(), covers, recursive, cancel, &|_| {}).unwrap()
    }

    #[test]
    fn non_recursive_scan_stops_at_the_folder_itself() {
        let tree = Tree::new("shallow");
        let (conn, fid, covers) = setup(&tree);
        let go = AtomicBool::new(false);

        let n = scan(&conn, fid, &tree, &covers, false, &go);

        assert_eq!(n, 2, "only the two files at the root");
        let titles: Vec<String> =
            db::list_tracks(&conn).unwrap().into_iter().map(|t| t.titulo).collect();
        assert!(titles.contains(&"raiz-uno".to_string()));
        assert!(!titles.iter().any(|t| t.starts_with("sub-")));
    }

    #[test]
    fn recursive_scan_descends_into_every_subfolder() {
        let tree = Tree::new("deep");
        let (conn, fid, covers) = setup(&tree);
        let go = AtomicBool::new(false);

        let n = scan(&conn, fid, &tree, &covers, true, &go);

        assert_eq!(n, 5, "two at the root, two in Coros, one nested — the .txt is skipped");
    }

    #[test]
    fn rescan_skips_files_whose_stamp_is_unchanged() {
        let tree = Tree::new("incremental");
        let (conn, fid, covers) = setup(&tree);
        let go = AtomicBool::new(false);
        scan(&conn, fid, &tree, &covers, true, &go);

        // Mark every title so a re-read is observable.
        conn.execute("UPDATE tracks SET titulo='SIN RELEER'", []).unwrap();
        scan(&conn, fid, &tree, &covers, true, &go);
        assert!(
            db::list_tracks(&conn).unwrap().iter().all(|t| t.titulo == "SIN RELEER"),
            "unchanged files must not be re-read"
        );

        // Rewriting one file changes its stamp, so only that one is re-read.
        std::thread::sleep(std::time::Duration::from_millis(1100));
        tree.write("raiz-uno.wav");
        scan(&conn, fid, &tree, &covers, true, &go);

        let tracks = db::list_tracks(&conn).unwrap();
        let reread: Vec<&String> =
            tracks.iter().filter(|t| t.titulo != "SIN RELEER").map(|t| &t.titulo).collect();
        assert_eq!(reread, vec!["raiz-uno"], "only the touched file is re-read");
    }

    #[test]
    fn a_raised_cancel_flag_stops_the_scan_before_any_file() {
        let tree = Tree::new("cancel");
        let (conn, fid, covers) = setup(&tree);
        let stop = AtomicBool::new(true);

        let n = scan(&conn, fid, &tree, &covers, true, &stop);

        assert_eq!(n, 0);
        assert!(db::list_tracks(&conn).unwrap().is_empty());
    }

    #[test]
    fn a_cancelled_scan_does_not_stamp_the_folder_as_scanned() {
        let tree = Tree::new("cancel-nostamp");
        let (conn, fid, covers) = setup(&tree);

        scan(&conn, fid, &tree, &covers, true, &AtomicBool::new(true));
        assert_eq!(db::list_folders(&conn).unwrap()[0].last_scan, None);

        scan(&conn, fid, &tree, &covers, true, &AtomicBool::new(false));
        assert!(db::list_folders(&conn).unwrap()[0].last_scan.is_some());
    }

    #[test]
    fn progress_ends_at_a_single_done_event_at_one_hundred_percent() {
        let tree = Tree::new("progress");
        let (conn, fid, covers) = setup(&tree);
        let seen = std::cell::RefCell::new(Vec::new());

        scan_folder(&conn, fid, &tree.path(), &covers, true, &AtomicBool::new(false), &|p| {
            seen.borrow_mut().push((p.pct, p.done, p.added));
        })
        .unwrap();

        let events = seen.borrow();
        let done: Vec<_> = events.iter().filter(|(_, d, _)| *d).collect();
        assert_eq!(done.len(), 1, "exactly one terminal event");
        assert_eq!(done[0].0, 100.0);
        assert_eq!(events.last().unwrap().2, 5, "final count matches the files indexed");
    }

    #[test]
    fn a_folder_that_no_longer_exists_scans_to_zero_instead_of_erroring() {
        let tree = Tree::new("gone");
        let (conn, fid, covers) = setup(&tree);
        scan(&conn, fid, &tree, &covers, true, &AtomicBool::new(false));
        std::fs::remove_dir_all(&tree.0).unwrap();

        let n = scan(&conn, fid, &tree, &covers, true, &AtomicBool::new(false));

        assert_eq!(n, 0);
        assert!(
            db::list_tracks(&conn).unwrap().iter().all(|t| t.missing),
            "every track is flagged missing"
        );
    }
}
