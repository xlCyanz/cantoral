// Thin seam over the Tauri backend. Every call is guarded so the UI also
// runs in a plain browser (`pnpm dev`) against the in-store seed data.

import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openPath, openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { open, save } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import type { Folder, Playlist, Track } from "./types";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** True when the webview runs on macOS (native traffic lights available). */
export function isMacOS(): boolean {
  return typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);
}

/** What this system calls its file manager, for the «mostrar en…» button. */
export function gestorDeArchivos(): string {
  if (typeof navigator === "undefined") return "la carpeta";
  const ua = navigator.userAgent;
  if (/Mac/i.test(ua)) return "el Finder";
  if (/Win/i.test(ua)) return "el Explorador";
  return "la carpeta";
}

/** Short OS label for the "open in system player" affordance. */
export function osShortName(): string {
  if (typeof navigator === "undefined") return "Sistema";
  const ua = navigator.userAgent;
  if (/Mac/i.test(ua)) return "macOS";
  if (/Win/i.test(ua)) return "Windows";
  return "Sistema";
}

async function inv<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(cmd, args);
}

// ---------------------------------------------------------------- window

export async function winMinimize(): Promise<void> {
  if (!isTauri()) return;
  await getCurrentWindow().minimize();
}
export async function winToggleMaximize(): Promise<void> {
  if (!isTauri()) return;
  await getCurrentWindow().toggleMaximize();
}
export async function winClose(): Promise<void> {
  if (!isTauri()) return;
  await getCurrentWindow().close();
}

/** Subscribe to the window's maximized state (for the restore/maximize icon). */
export async function watchMaximized(cb: (maximized: boolean) => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  const w = getCurrentWindow();
  cb(await w.isMaximized());
  return w.onResized(async () => cb(await w.isMaximized()));
}

// ---------------------------------------------------------------- os / files

/** Open a file/URL in the OS default application (e.g. Windows media player). */
export async function openExternalPath(target: string): Promise<void> {
  if (!isTauri() || !target) return;
  if (/^https?:\/\//.test(target)) await openUrl(target);
  else await openPath(target);
}

/** Native picker for a single media file, used when relocating a track. */
export async function pickMediaFile(): Promise<string | null> {
  if (!isTauri()) return null;
  const res = await open({
    multiple: false,
    filters: [
      {
        name: "Audio y video",
        extensions: [
          "mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "wma", "aiff", "aif",
          "mp4", "mov", "mkv", "avi", "webm", "m4v", "wmv",
        ],
      },
    ],
  });
  return typeof res === "string" ? res : null;
}

/** Show a file in the system file manager, selected. */
export async function revealFile(path: string): Promise<void> {
  if (!isTauri() || !path) return;
  await revealItemInDir(path);
}

/** Native folder picker. Returns the chosen absolute path, or null. */
export async function pickFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  const res = await open({ directory: true, multiple: false });
  return typeof res === "string" ? res : null;
}

/** Native save dialog for an exported playlist sheet. */
export async function pickExportPath(defaultPath: string): Promise<string | null> {
  if (!isTauri()) return null;
  const res = await save({ defaultPath, filters: [{ name: "Página web", extensions: ["html"] }] });
  return res ?? null;
}

/** Write the rendered playlist sheet to disk. */
export async function exportPlaylistCmd(dest: string, html: string): Promise<void> {
  await inv("export_playlist", { dest, html });
}

/** Native save dialog for the database backup. */
export async function pickSavePath(): Promise<string | null> {
  if (!isTauri()) return null;
  const res = await save({ defaultPath: "cantoral-backup.db", filters: [{ name: "SQLite", extensions: ["db"] }] });
  return res ?? null;
}

/** Convert an absolute path into an asset:// URL playable by <audio>/<video>. */
export async function toAssetUrl(path: string): Promise<string> {
  if (!isTauri()) return path;
  return convertFileSrc(path);
}

/** Synchronous asset:// URL for local files (cover art). No-op in the browser. */
export function assetUrl(path: string): string {
  if (!isTauri() || !path) return path;
  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
}

// ---------------------------------------------------------------- library API

export interface Snapshot {
  tracks: Track[];
  folders: Folder[];
  playlists: Playlist[];
}

export interface ScanProgressEvent {
  folderId: string;
  pct: number;
  file: string;
  done: boolean;
  added: number;
}

/** The lyrics and chords of one track. */
export interface Sheet {
  trackId: string;
  letra: string;
  /** ChordPro, e.g. `[Sol]Sublime [Do]gracia`. */
  acordes: string;
}

/** One track's sheet. Null in the browser, where the seed stands in. */
export async function getTrackSheet(id: string): Promise<Sheet | null> {
  if (!isTauri()) return null;
  return inv<Sheet>("get_track_sheet", { id });
}

/** The sheets of a whole service list, in one round trip. */
export async function getSheets(ids: string[]): Promise<Sheet[] | null> {
  if (!isTauri()) return null;
  return inv<Sheet[]>("get_sheets", { ids });
}

/** Write a track's lyrics and chords. */
export async function updateTrackSheet(id: string, letra: string, acordes: string): Promise<void> {
  if (!isTauri()) return;
  await inv("update_track_sheet", { id, letra, acordes });
}

/** One candidate inside a group of suspected duplicates. */
export interface DuplicateTrack {
  id: string;
  titulo: string;
  artista: string;
  path: string;
  formato: string;
  carpeta: string;
  dur: string;
  durSec: number;
  /** Size on disk in bytes; 0 when the file could not be read. */
  fsize: number;
  fav: boolean;
  missing: boolean;
  tags: string[];
}

/** A set of tracks that look like the same song. */
export interface DuplicateGroup {
  /** Its track ids, sorted and joined by `-`. What a dismissal remembers. */
  signature: string;
  /** Why they ended up together: `archivo` or `titulo`. */
  motivo: string;
  /** The copy the backend suggests keeping. */
  sugerido: string;
  tracks: DuplicateTrack[];
}

export interface DuplicateReport {
  groups: DuplicateGroup[];
  /** Groups waved off, so the view can offer them back. */
  dismissed: number;
}

/** Look for tracks that are the same song. Null in the browser. */
export async function findDuplicatesCmd(): Promise<DuplicateReport | null> {
  if (!isTauri()) return null;
  return inv<DuplicateReport>("find_duplicates");
}

/** Fold `drop` into `keep`, moving tags, favourite and list places across. */
export async function mergeDuplicatesCmd(keep: string, drop: string[]): Promise<Snapshot | null> {
  if (!isTauri()) return null;
  return inv<Snapshot>("merge_duplicates", { keep, drop });
}

/** Remember that a group is not duplicates after all. */
export async function dismissDuplicatesCmd(signature: string): Promise<DuplicateReport | null> {
  if (!isTauri()) return null;
  return inv<DuplicateReport>("dismiss_duplicates", { signature });
}

/** Offer every dismissed group again. */
export async function restoreDismissedDuplicatesCmd(): Promise<DuplicateReport | null> {
  if (!isTauri()) return null;
  return inv<DuplicateReport>("restore_dismissed_duplicates");
}

export async function getLibrary(): Promise<Snapshot | null> {
  if (!isTauri()) return null;
  return inv<Snapshot>("get_library");
}
export async function addAndScanFolder(path: string, recursive: boolean): Promise<Snapshot> {
  return inv<Snapshot>("add_and_scan_folder", { path, recursive });
}
export async function rescanFolderCmd(id: string): Promise<Snapshot> {
  return inv<Snapshot>("rescan_folder", { id });
}
/** Ask an in-flight backend scan to stop after the file it is on. */
export async function cancelScanCmd(): Promise<void> {
  if (!isTauri()) return;
  await inv("cancel_scan");
}
/** Re-check every indexed file on disk (tracks deleted while the app was closed). */
export async function reconcileLibraryCmd(): Promise<Snapshot | null> {
  if (!isTauri()) return null;
  return inv<Snapshot>("reconcile_library");
}
export async function removeFolderCmd(id: string): Promise<Snapshot> {
  return inv<Snapshot>("remove_folder", { id });
}
/** Point a track at its file's new location, keeping tags and favourite. */
export async function relocateTrackCmd(id: string, path: string): Promise<Snapshot> {
  return inv<Snapshot>("relocate_track", { id, path });
}
/** Drop one track from the catalogue. The audio file is never touched. */
export async function deleteTrackCmd(id: string): Promise<Snapshot> {
  return inv<Snapshot>("delete_track", { id });
}
/** Point a whole indexed folder at its new location, rewriting its tracks. */
export async function relocateFolderCmd(id: string, path: string): Promise<Snapshot> {
  return inv<Snapshot>("relocate_folder", { id, path });
}
export async function setTrackFav(id: string, fav: boolean): Promise<void> {
  if (!isTauri()) return;
  await inv("set_track_fav", { id, fav });
}
export async function updateTrackCmd(
  id: string,
  tono: string,
  bpm: number,
  ocasion: string,
  tags: string[],
): Promise<void> {
  if (!isTauri()) return;
  await inv("update_track", { id, tono, bpm, ocasion, tags });
}
export async function setPlaylistOrderCmd(playlist: string, ids: string[]): Promise<void> {
  if (!isTauri()) return;
  await inv("set_playlist_order", { playlist, ids });
}
export async function createPlaylistCmd(nombre: string, fecha: string, ocasion: string): Promise<string> {
  return inv<string>("create_playlist", { nombre, fecha, ocasion });
}
export async function addToPlaylistCmd(playlist: string, track: string): Promise<Snapshot> {
  return inv<Snapshot>("add_to_playlist", { playlist, track });
}
export async function updatePlaylistCmd(
  playlist: string,
  nombre: string,
  fecha: string,
  ocasion: string,
): Promise<Snapshot> {
  return inv<Snapshot>("update_playlist", { playlist, nombre, fecha, ocasion });
}
export async function deletePlaylistCmd(playlist: string): Promise<Snapshot> {
  return inv<Snapshot>("delete_playlist", { playlist });
}
export async function restoreDatabaseCmd(src: string): Promise<Snapshot> {
  return inv<Snapshot>("restore_database", { src });
}

/** What a backup file holds, read without modifying it. */
export interface BackupInfo {
  tracks: number;
  folders: number;
  playlists: number;
}

/** Read a backup so the user can be told what they are about to replace. */
export async function inspectBackup(src: string): Promise<BackupInfo> {
  return inv<BackupInfo>("inspect_backup", { src });
}
/** Native open dialog for a .db backup file. */
export async function pickDbFile(): Promise<string | null> {
  if (!isTauri()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const res = await open({ multiple: false, filters: [{ name: "Base de datos", extensions: ["db"] }] });
  return typeof res === "string" ? res : null;
}
export async function getSetting(key: string): Promise<string | null> {
  if (!isTauri()) return null;
  return (await inv<string | null>("get_setting", { key })) ?? null;
}
export async function setSetting(key: string, value: string): Promise<void> {
  if (!isTauri()) return;
  await inv("set_setting", { key, value });
}

export interface DbInfo {
  path: string;
  size: number;
}
export async function getDbInfo(): Promise<DbInfo | null> {
  if (!isTauri()) return null;
  return inv<DbInfo>("get_db_info");
}
export async function backupDatabase(dest: string): Promise<void> {
  if (!isTauri()) return;
  await inv("backup_database", { dest });
}

/** Subscribe to backend scan progress. Returns an unlisten function. */
export async function onScanProgress(cb: (p: ScanProgressEvent) => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  return listen<ScanProgressEvent>("scan-progress", (e) => cb(e.payload));
}
