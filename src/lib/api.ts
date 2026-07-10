// Thin seam over the Tauri backend. Every call is guarded so the UI also
// runs in a plain browser (`pnpm dev`) against the in-store seed data.

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
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

// ---------------------------------------------------------------- window

export async function winMinimize(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().minimize();
}
export async function winToggleMaximize(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().toggleMaximize();
}
export async function winClose(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}

/** Subscribe to the window's maximized state (for the restore/maximize icon). */
export async function watchMaximized(cb: (maximized: boolean) => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const w = getCurrentWindow();
  cb(await w.isMaximized());
  return w.onResized(async () => cb(await w.isMaximized()));
}

// ---------------------------------------------------------------- os / files

/** Open a file/URL in the OS default application (e.g. Windows media player). */
export async function openExternalPath(target: string): Promise<void> {
  if (!isTauri() || !target) return;
  const { openPath, openUrl } = await import("@tauri-apps/plugin-opener");
  if (/^https?:\/\//.test(target)) await openUrl(target);
  else await openPath(target);
}

/** Native folder picker. Returns the chosen absolute path, or null. */
export async function pickFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const res = await open({ directory: true, multiple: false });
  return typeof res === "string" ? res : null;
}

/** Native save dialog for the database backup. */
export async function pickSavePath(): Promise<string | null> {
  if (!isTauri()) return null;
  const { save } = await import("@tauri-apps/plugin-dialog");
  const res = await save({ defaultPath: "cantoral-backup.db", filters: [{ name: "SQLite", extensions: ["db"] }] });
  return res ?? null;
}

/** Convert an absolute path into an asset:// URL playable by <audio>/<video>. */
export async function toAssetUrl(path: string): Promise<string> {
  if (!isTauri()) return path;
  const { convertFileSrc } = await import("@tauri-apps/api/core");
  return convertFileSrc(path);
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
export async function getSetting(key: string): Promise<string | null> {
  if (!isTauri()) return null;
  return (await inv<string | null>("get_setting", { key })) ?? null;
}
export async function setSetting(key: string, value: string): Promise<void> {
  if (!isTauri()) return;
  await inv("set_setting", { key, value });
}
export async function backupDatabase(dest: string): Promise<void> {
  if (!isTauri()) return;
  await inv("backup_database", { dest });
}

/** Subscribe to backend scan progress. Returns an unlisten function. */
export async function onScanProgress(cb: (p: ScanProgressEvent) => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen<ScanProgressEvent>("scan-progress", (e) => cb(e.payload));
}
