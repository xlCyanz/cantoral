// Thin seam over the Tauri backend. Every call is guarded so the UI also
// runs in a plain browser (`pnpm dev`) against the in-store seed data.

import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
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

/** Native folder picker. Returns the chosen absolute path, or null. */
export async function pickFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  const res = await open({ directory: true, multiple: false });
  return typeof res === "string" ? res : null;
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

export async function getLibrary(): Promise<Snapshot | null> {
  if (!isTauri()) return null;
  return inv<Snapshot>("get_library");
}
export async function addAndScanFolder(path: string): Promise<Snapshot> {
  return inv<Snapshot>("add_and_scan_folder", { path });
}
export async function rescanFolderCmd(id: string): Promise<Snapshot> {
  return inv<Snapshot>("rescan_folder", { id });
}
export async function removeFolderCmd(id: string): Promise<Snapshot> {
  return inv<Snapshot>("remove_folder", { id });
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
export async function deletePlaylistCmd(playlist: string): Promise<Snapshot> {
  return inv<Snapshot>("delete_playlist", { playlist });
}
export async function restoreDatabaseCmd(src: string): Promise<Snapshot> {
  return inv<Snapshot>("restore_database", { src });
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
