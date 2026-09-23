// Thin seam over the Tauri backend. Every call is guarded so the UI also
// runs in a plain browser (`pnpm dev`) against the in-store seed data.

import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { open, save } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import type { Folder, Playlist, SalidaDeAudio, Theme, Track, TransicionProyeccion } from "./types";
import type { ArchivoDeLista } from "./compartir";

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

/**
 * Abre en el navegador la hoja que la app acaba de exportar, para imprimirla.
 *
 * Va por el núcleo y no por el plugin del abridor: el webview no puede pedirle
 * al sistema que abra una ruta cualquiera, y el núcleo solo deja pasar la hoja
 * —comprueba la extensión—. Antes esto también abría pistas, para el desvío al
 * reproductor del sistema; ese desvío ya no existe (#81) y la regla se
 * estrechó con él.
 */
export async function openExportedSheet(path: string): Promise<void> {
  if (!isTauri() || !path) return;
  await inv("open_exported_sheet", { path });
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

/**
 * El tema del sistema, preguntado a la ventana nativa.
 *
 * `prefers-color-scheme` no basta: en Windows, WebView2 lo resuelve contra el
 * tema de la ventana, no contra el del sistema, así que una app que no le diga
 * nada se queda en claro para siempre aunque Windows esté en oscuro. La
 * ventana sí sabe cuál es, y es la misma respuesta en macOS.
 *
 * `null` cuando no hay ventana nativa —el modo navegador— o cuando el sistema
 * no lo dice: macOS 10.13 y anteriores no tienen tema.
 */
export async function temaDelSistema(): Promise<Theme | null> {
  if (!isTauri()) return null;
  try {
    return (await getCurrentWindow().theme()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Avisa cuando el sistema cambia de tema. Devuelve cómo dejar de escuchar.
 *
 * Por el evento de la ventana y no por `matchMedia`: en Windows el webview no
 * se entera de que el sistema cambió, y en macOS llega antes por aquí.
 */
export async function onTemaDelSistema(cb: (t: Theme) => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  try {
    return await getCurrentWindow().onThemeChanged(({ payload }) => cb(payload));
  } catch {
    return () => {};
  }
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

/** Native save dialog for a playlist another installation can import. */
export async function pickShareExportPath(defaultPath: string): Promise<string | null> {
  if (!isTauri()) return null;
  const res = await save({ defaultPath, filters: [{ name: "Lista de Cantoral", extensions: ["json"] }] });
  return res ?? null;
}

/** Write a shared playlist file to disk. */
export async function exportPlaylistJsonCmd(dest: string, json: string): Promise<void> {
  await inv("export_playlist_json", { dest, json });
}

/** Native open dialog for a shared playlist file. */
export async function pickPlaylistFile(): Promise<string | null> {
  if (!isTauri()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const res = await open({ multiple: false, filters: [{ name: "Lista de Cantoral", extensions: ["json"] }] });
  return typeof res === "string" ? res : null;
}

/** Read a shared playlist file. Nothing is created; this only reports it. */
export async function readPlaylistFileCmd(src: string): Promise<ArchivoDeLista> {
  return inv<ArchivoDeLista>("read_playlist_file", { src });
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
  /** Archivos de medios que se reconocieron y no se indexaron porque ningún
   *  motor de webview los decodifica. */
  omitidos: number;
}

/** Append a whole selection to a list, in one transaction and one snapshot. */
export async function addTracksToPlaylistCmd(
  playlist: string,
  tracks: string[],
): Promise<Snapshot | null> {
  if (!isTauri()) return null;
  return inv<Snapshot>("add_tracks_to_playlist", { playlist, tracks });
}

/** Mark or unmark a whole selection as favourites. */
export async function setTracksFavCmd(ids: string[], fav: boolean): Promise<Snapshot | null> {
  if (!isTauri()) return null;
  return inv<Snapshot>("set_tracks_fav", { ids, fav });
}

/** Put a tag on a whole selection, or take it off it. */
export async function tagTracksCmd(
  ids: string[],
  tag: string,
  add: boolean,
): Promise<Snapshot | null> {
  if (!isTauri()) return null;
  return inv<Snapshot>("tag_tracks", { ids, tag, add });
}

/** Drop a whole selection from the catalogue. The audio files are untouched. */
export async function deleteTracksCmd(ids: string[]): Promise<Snapshot | null> {
  if (!isTauri()) return null;
  return inv<Snapshot>("delete_tracks", { ids });
}

/** Rename a tag everywhere, folding it into an existing one if the name is taken. */
export async function renameTagCmd(from: string, to: string): Promise<Snapshot | null> {
  if (!isTauri()) return null;
  return inv<Snapshot>("rename_tag", { from, to });
}

/** Take a tag off every track that carried it. The tracks are untouched. */
export async function deleteTagCmd(name: string): Promise<Snapshot | null> {
  if (!isTauri()) return null;
  return inv<Snapshot>("delete_tag", { name });
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
  artista: string,
  tono: string,
  bpm: number,
  ocasion: string,
  tags: string[],
): Promise<void> {
  if (!isTauri()) return;
  await inv("update_track", { id, artista, tono, bpm, ocasion, tags });
}
export async function setPlaylistOrderCmd(playlist: string, ids: string[]): Promise<void> {
  if (!isTauri()) return;
  await inv("set_playlist_order", { playlist, ids });
}
/** `desde` is the template to copy the order from, if the user picked one. */
export async function createPlaylistCmd(
  nombre: string,
  fecha: string,
  ocasion: string,
  desde?: string,
): Promise<string> {
  return inv<string>("create_playlist", { nombre, fecha, ocasion, desde: desde ?? null });
}
export async function duplicatePlaylistCmd(playlist: string): Promise<string> {
  return inv<string>("duplicate_playlist", { playlist });
}
export async function setPlaylistTemplateCmd(playlist: string, plantilla: boolean): Promise<Snapshot> {
  return inv<Snapshot>("set_playlist_template", { playlist, plantilla });
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

/**
 * Read a shared playlist file in a plain browser, with a file picker.
 *
 * The app goes through the native dialog and the Rust reader; this is the
 * browser's way in, so «exportar e importar» can be tried end to end with
 * `pnpm dev`. Resolves to null when the picker is dismissed.
 */
export async function leerArchivoDelNavegador(): Promise<ArchivoDeLista | null> {
  const { parsearArchivo } = await import("./compartir");
  const texto = await new Promise<string | null>((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      file.text().then(resolve, reject);
    };
    // No `oncancel` in every browser, so a dismissed picker simply never
    // resolves — and nothing was going to happen anyway.
    input.click();
  });
  return texto === null ? null : parsearArchivo(texto);
}

/** Lo que el núcleo responde al preguntar si hay una versión más nueva. */
export type UpdateCheck =
  | { estado: "sinConfigurar" }
  | { estado: "alDia" }
  | { estado: "disponible"; version: string; notas: string; fecha: string | null };

/** Cuánto lleva descargado el instalador. `total` falta si el servidor no lo dice. */
export interface UpdateProgress {
  descargado: number;
  total: number | null;
}

/**
 * Ask whether there is a newer Cantoral.
 *
 * In a plain browser there is nothing to update, and saying «sin configurar»
 * is truer than pretending the app is up to date.
 */
export async function checkForUpdateCmd(): Promise<UpdateCheck> {
  if (!isTauri()) return { estado: "sinConfigurar" };
  return inv<UpdateCheck>("check_for_update");
}

/** Download, install and restart. Does not resolve when it works. */
export async function installUpdateCmd(): Promise<void> {
  await inv("install_update");
}

/** Follow the download. Returns the unlisten function. */
export async function onUpdateProgress(cb: (p: UpdateProgress) => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  return listen<UpdateProgress>("update-progress", (e) => cb(e.payload));
}

// ---------- proyección ----------

/** Una pantalla del sistema, como se ofrece para elegir la salida. */
export interface MonitorInfo {
  indice: number;
  nombre: string;
  ancho: number;
  alto: number;
  principal: boolean;
}

/** Lo que la ventana de salida está mostrando. */
export type VistaProyeccion =
  | { modo: "negro" }
  | { modo: "titulo"; titulo: string; sub?: string }
  | {
      modo: "media";
      /** URL `asset://` del archivo. */
      src: string;
      /** Si trae imagen. Un audio no llena la pantalla por sí solo. */
      video: boolean;
      titulo: string;
      sub?: string;
      reproduciendo: boolean;
      /**
       * Qué dibujar mientras suena, cuando el archivo no trae imagen.
       *
       * Ausente en un video: ahí la pantalla ya está llena. Sin `lineas` —una
       * pista sin letra escrita— la salida cae al título, que es mejor que un
       * negro con el que nadie sabe si la app se colgó.
       */
      audio?: {
        tipo: SalidaDeAudio;
        /** «Coro», «Puente»… de la estrofa que está en pantalla. */
        etiqueta?: string;
        lineas?: string[];
        /** URL `asset://` de la carátula, para el fondo. */
        portada?: string;
      };
    };

/**
 * El mensaje completo que recibe la salida.
 *
 * `precarga` no se ve: es el archivo siguiente del culto, que la salida carga
 * en silencio y deja en pausa. Sin eso, pasar de un elemento a otro deja la
 * pantalla grande en negro el tiempo que tarde el disco — medio segundo en un
 * SSD, varios en un pendrive, que es de donde sale la música en muchas
 * iglesias.
 */
export interface SalidaProyeccion {
  vista: VistaProyeccion;
  precarga?: string;
  /**
   * Qué hacer antes de enseñar esto.
   *
   * Solo viene al cambiar de elemento del culto. Pasar de una estrofa a otra,
   * cortar a negro o cambiar un ajuste en marcha no llevan transición: serían
   * medio segundo de negro en mitad de una canción.
   *
   * La cuenta la lleva la ventana de salida y no esta: es la que tiene el
   * fotograma delante, y un temporizador que viaje entre ventanas llegaría
   * tarde de forma distinta cada vez.
   */
  transicion?: TransicionProyeccion;
}

/** Lo que la salida devuelve sobre lo que está reproduciendo. */
export interface EstadoProyeccion {
  /** La `src` a la que se refiere, para descartar lo que llega tarde. */
  src: string;
  pos: number;
  dur: number;
  fin: boolean;
  /** Código de `MediaError` si falló. */
  error?: number;
}

/**
 * Las pantallas conectadas.
 *
 * En el navegador no hay ninguna: proyectar necesita una segunda ventana del
 * sistema, y decir que hay cero es más honesto que inventar una que al pulsar
 * no haría nada.
 */
export async function projectionMonitors(): Promise<MonitorInfo[]> {
  if (!isTauri()) return [];
  return inv<MonitorInfo[]>("projection_monitors");
}

export async function openProjectionCmd(monitor: number): Promise<void> {
  if (!isTauri()) return;
  await inv<void>("open_projection", { monitor });
}

export async function closeProjectionCmd(): Promise<void> {
  if (!isTauri()) return;
  await inv<void>("close_projection");
}

export async function setProjectionCmd(contenido: SalidaProyeccion): Promise<void> {
  if (!isTauri()) return;
  await inv<void>("set_projection", { contenido });
}

/**
 * Avisa cuando la ventana de salida termina de suscribirse.
 *
 * Hace falta porque abrir la ventana y mandarle lo primero son dos cosas
 * seguidas, y entre una y otra el webview todavía está arrancando: el primer
 * mensaje se perdía entero y el proyector se quedaba en negro justo al empezar
 * el culto. En vez de adivinar cuánto tarda, la salida lo dice. Vale igual
 * para cuando la ventana se recarga sola a mitad de un culto.
 */
export async function onProjectionReady(cb: () => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  return listen("proyeccion-lista", () => cb());
}

/**
 * Sigue lo que la salida está reproduciendo. Devuelve cómo dejar de seguirlo.
 *
 * La salida emite y la principal escucha, no al revés: el tiempo que lleva el
 * video lo sabe el elemento que lo está reproduciendo, y preguntárselo desde
 * fuera cada décima sería pasar por el núcleo mil veces por culto.
 */
export async function onProjectionState(cb: (e: EstadoProyeccion) => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  return listen<EstadoProyeccion>("proyeccion-estado", (e) => cb(e.payload));
}
