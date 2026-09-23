use anyhow::Result;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::PictureType;
use lofty::probe::Probe;
use lofty::tag::Accessor;
use rusqlite::Connection;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use walkdir::WalkDir;

use crate::db;
use crate::models::ScanProgress;

/// The cancel flag of the scan that is running, if there is one.
///
/// A flag per scan rather than one shared flag. A shared one let a starting
/// scan clear the flag of a scan that was cancelled but had not noticed yet —
/// it polls between files — bringing the cancelled one back to life and
/// letting it run to the end.
///
/// The slot being taken is also what keeps two scans from overlapping. Two at
/// once would write through two connections, interleave their `scan-progress`
/// events on the single channel the progress bar listens to, and each finish
/// by taking a snapshot over the other's half-done work.
#[derive(Default)]
pub struct ScanSlot(Mutex<Option<Arc<AtomicBool>>>);

/// A claim on the scan slot. Releasing it is what lets the next scan start, so
/// it happens when the claim goes out of scope — including on a panic.
pub struct ScanClaim<'a> {
    slot: &'a ScanSlot,
    cancel: Arc<AtomicBool>,
}

impl ScanSlot {
    pub fn new() -> Self {
        Self::default()
    }

    /// Take the slot for a new scan. `None` means one is already running.
    ///
    /// The new scan always starts with its own flag lowered, so a cancel aimed
    /// at an earlier scan cannot stop this one before it reads a single file.
    pub fn claim(&self) -> Option<ScanClaim<'_>> {
        let mut ocupado = self.lock();
        if ocupado.is_some() {
            return None;
        }
        let cancel = Arc::new(AtomicBool::new(false));
        *ocupado = Some(cancel.clone());
        Some(ScanClaim { slot: self, cancel })
    }

    /// Ask the running scan to stop after the file it is on. Does nothing when
    /// no scan is running, so a stray cancel cannot poison the next one.
    pub fn cancel(&self) {
        if let Some(bandera) = self.lock().as_ref() {
            bandera.store(true, Ordering::Relaxed);
        }
    }

    /// Nothing but the few instructions above ever runs under this lock, so a
    /// panic cannot realistically poison it — and recovering beats leaving the
    /// app unable to scan for the rest of the session.
    fn lock(&self) -> std::sync::MutexGuard<'_, Option<Arc<AtomicBool>>> {
        self.0.lock().unwrap_or_else(|envenenado| envenenado.into_inner())
    }
}

impl ScanClaim<'_> {
    /// The flag this scan polls between files.
    pub fn cancel_flag(&self) -> &AtomicBool {
        &self.cancel
    }
}

impl Drop for ScanClaim<'_> {
    fn drop(&mut self) {
        *self.slot.lock() = None;
    }
}

// Lo que se indexa es lo que Cantoral puede reproducir.
//
// Antes se indexaba más de lo que la app sabe abrir, y funcionaba porque había
// una salida de emergencia: la pista que no sonaba se le pasaba al reproductor
// del sistema. Quitada esa salida (#81), indexar un `.wma` sería meter en la
// biblioteca una pista muda, con aspecto de pista normal, que en mitad de un
// culto no suena y no dice por qué.
//
// El recorte es solo de lo que **no decodifica ningún motor**, en ninguna
// plataforma. `ogg`, `opus`, `aiff` y `mov` dependen del motor —WKWebView en
// macOS y WebView2 en Windows no coinciden— y se siguen indexando: el
// catálogo viaja entre máquinas (hay copia y restauración), y una lista de
// formatos distinta en cada una haría que la misma biblioteca cambiara al
// pasarla del Mac al PC. Lo que dependa del motor falla al abrirlo, con el
// motivo que dé el reproductor.
const AUDIO_EXTS: &[&str] = &["mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "aiff", "aif"];
const VIDEO_EXTS: &[&str] = &["mp4", "mov", "webm", "m4v"];

/// Medios que se reconocen como tales para poder contarlos, pero no se indexan.
///
/// Se cuentan y se dicen al terminar el escaneo. Saltárselos en silencio sería
/// peor que no tenerlos: quien ve que faltan tres canciones no tiene forma de
/// saber si es por el formato o porque el escaneo se rompió.
const SIN_SOPORTE: &[&str] = &["wma", "mkv", "avi", "wmv"];

fn ext_lower(p: &Path) -> Option<String> {
    p.extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase())
}

fn is_media(ext: &str) -> bool {
    AUDIO_EXTS.contains(&ext) || VIDEO_EXTS.contains(&ext)
}

/// Un archivo de medios que la app reconoce y no puede reproducir.
fn es_sin_soporte(ext: &str) -> bool {
    SIN_SOPORTE.contains(&ext)
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

    // Collect media paths first so progress has a denominator. En la misma
    // pasada se cuentan los que se reconocen y no se pueden reproducir, para
    // poder decirlos al terminar en vez de dejar un hueco sin explicar.
    let mut omitidos: i64 = 0;
    let mut files: Vec<walkdir::DirEntry> = Vec::new();
    for entrada in WalkDir::new(root)
        .max_depth(if recursive { usize::MAX } else { 1 })
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        match ext_lower(entrada.path()) {
            Some(ext) if is_media(&ext) => files.push(entrada),
            Some(ext) if es_sin_soporte(&ext) => omitidos += 1,
            _ => {}
        }
    }

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
                omitidos,
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
        omitidos,
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

    /// El último progreso de un escaneo, que es el que lleva las cuentas.
    fn escanear_con_resumen(
        conn: &Connection,
        fid: i64,
        tree: &Tree,
        covers: &std::path::Path,
    ) -> ScanProgress {
        let ultimo = std::sync::Mutex::new(None);
        scan_folder(conn, fid, &tree.path(), covers, true, &AtomicBool::new(false), &|p| {
            *ultimo.lock().unwrap() = Some(p);
        })
        .unwrap();
        ultimo.into_inner().unwrap().expect("el escaneo siempre informa del final")
    }

    #[test]
    fn a_format_no_engine_decodes_is_not_indexed_but_is_counted() {
        // Indexarlo metería en la biblioteca una pista muda con aspecto de
        // pista normal, que en mitad de un culto no suena y no dice por qué.
        // Saltárselo en silencio sería igual de malo: quien ve que faltan tres
        // canciones no sabría si es por el formato o porque algo se rompió.
        let tree = Tree::new("sin-soporte");
        for f in ["himno.wma", "testimonio.mkv", "boda.avi", "clip.wmv"] {
            tree.write(f);
        }
        let (conn, fid, covers) = setup(&tree);

        let resumen = escanear_con_resumen(&conn, fid, &tree, &covers);

        assert_eq!(resumen.added, 5, "los cinco wav del árbol, y nada más");
        assert_eq!(resumen.omitidos, 4);
        let titulos: Vec<String> =
            db::list_tracks(&conn).unwrap().into_iter().map(|t| t.titulo).collect();
        assert!(!titulos.iter().any(|t| t == "himno" || t == "testimonio"));
    }

    #[test]
    fn extensions_are_matched_without_case() {
        let tree = Tree::new("mayusculas");
        tree.write("HIMNO.WMA");
        let (conn, fid, covers) = setup(&tree);

        assert_eq!(escanear_con_resumen(&conn, fid, &tree, &covers).omitidos, 1);
    }

    #[test]
    fn what_is_not_media_is_not_counted_as_skipped() {
        // El árbol trae un `notas.txt`. Contarlo diría «1 archivo que Cantoral
        // no reproduce» de un archivo que nadie esperaba reproducir.
        let tree = Tree::new("no-medios");
        let (conn, fid, covers) = setup(&tree);

        assert_eq!(escanear_con_resumen(&conn, fid, &tree, &covers).omitidos, 0);
    }

    #[test]
    fn engine_dependent_formats_are_still_indexed() {
        // El catálogo viaja entre máquinas: `ogg` y `opus` suenan en Windows y
        // `aiff` en macOS, así que recortarlos aquí haría que la misma
        // biblioteca cambiara al pasarla de un sistema al otro. Lo que falle,
        // falla al abrirlo y lo dice.
        let tree = Tree::new("dependientes");
        for f in ["coro.ogg", "coro.opus", "coro.aiff", "coro.aif", "clip.mov"] {
            tree.write(f);
        }
        let (conn, fid, covers) = setup(&tree);

        let resumen = escanear_con_resumen(&conn, fid, &tree, &covers);

        assert_eq!(resumen.added, 10, "los cinco wav más estos cinco");
        assert_eq!(resumen.omitidos, 0);
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

    // ---- the slot that keeps scans from stepping on each other ----

    #[test]
    fn a_second_scan_is_turned_away_while_one_holds_the_slot() {
        let slot = ScanSlot::new();
        let _primero = slot.claim().expect("the slot starts free");

        assert!(slot.claim().is_none(), "two scans must not run at once");
    }

    #[test]
    fn the_slot_frees_up_when_the_scan_holding_it_ends() {
        let slot = ScanSlot::new();
        {
            let _primero = slot.claim().expect("the slot starts free");
        }

        assert!(slot.claim().is_some(), "the next scan gets its turn");
    }

    #[test]
    fn a_cancelled_scan_stays_cancelled_while_it_finishes() {
        let slot = ScanSlot::new();
        let primero = slot.claim().expect("the slot starts free");
        slot.cancel();

        // A scan polls the flag between files, so a cancelled one is still
        // alive for a moment. Starting another used to clear the single shared
        // flag and bring this one back to life; now the second cannot even
        // start until this one has let go.
        assert!(slot.claim().is_none());
        assert!(primero.cancel_flag().load(Ordering::Relaxed), "still cancelled");
    }

    #[test]
    fn a_new_scan_starts_with_its_own_flag_down() {
        let slot = ScanSlot::new();
        {
            let primero = slot.claim().expect("the slot starts free");
            slot.cancel();
            assert!(primero.cancel_flag().load(Ordering::Relaxed));
        }

        let segundo = slot.claim().expect("the slot is free again");
        assert!(
            !segundo.cancel_flag().load(Ordering::Relaxed),
            "a cancel aimed at the previous scan must not stop this one"
        );
    }

    #[test]
    fn cancelling_with_nothing_running_leaves_nothing_behind() {
        let slot = ScanSlot::new();
        slot.cancel();

        let scan = slot.claim().expect("the slot starts free");
        assert!(!scan.cancel_flag().load(Ordering::Relaxed));
    }

    #[test]
    fn a_scan_polls_the_flag_of_its_own_claim() {
        let tree = Tree::new("slot-cancel");
        let (conn, fid, covers) = setup(&tree);
        let slot = ScanSlot::new();
        let claim = slot.claim().unwrap();
        slot.cancel();

        let n = scan_folder(&conn, fid, &tree.path(), &covers, true, claim.cancel_flag(), &|_| {})
            .unwrap();

        assert_eq!(n, 0, "the scan stops on the flag its own claim handed it");
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
