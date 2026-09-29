// Lo que el store le pide al mundo de fuera.
//
// La app corre en dos sitios: dentro de Tauri, con el núcleo en Rust y SQLite,
// y en un navegador con `pnpm dev`, sobre los datos de ejemplo. Antes el store
// llevaba las dos versiones de casi cada acción —`if (!isTauri()) {…}` y la de
// verdad debajo— y ya divergían: quitar una pista en el navegador la dejaba en
// los cultos, y en la app no (#135). Ahora el store tiene un solo camino y lo
// que cambia entre los dos sitios vive detrás de esta interfaz, con dos
// implementaciones: `tauri.ts`, que habla con el núcleo, y `memoria.ts`, que
// hace lo mismo sobre una base en memoria.
//
// Cada operación contesta lo mismo que contesta el núcleo, así que el store
// aplica la respuesta igual venga de donde venga. Lo que no es de datos sino
// de la plataforma —la ventana, la proyección, el actualizador, el tema, el
// registro— sigue en `api.ts`, que ya sabe no hacer nada fuera de Tauri.

import type { ArchivoDeLista } from "../compartir";
import type {
  BackupInfo,
  CopiaAutomatica,
  DuplicateReport,
  Novedades,
  ScanProgressEvent,
  Sheet,
  Snapshot,
} from "../api";
import type { Playlist } from "../types";

/**
 * Lo que un entorno no sabe hacer, dicho para quien lo pidió.
 *
 * El navegador no tiene disco que mostrar ni archivos que mover. No es un
 * fallo —nada se rompió—, así que el store lo enseña como un aviso y no como
 * un error.
 */
export class NoDisponible extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "NoDisponible";
  }
}

export interface Backend {
  /**
   * Si las pistas tienen un archivo que suena de verdad.
   *
   * Con él, el `<audio>` o el `<video>` llevan el tiempo; sin él, el
   * reproductor lo simula con el reloj de un segundo.
   */
  readonly reproduceArchivos: boolean;

  // ---- catálogo
  getLibrary(): Promise<Snapshot>;
  getTracksSince(after: string): Promise<Novedades>;
  reconcileLibrary(): Promise<Snapshot>;
  setTrackFav(id: string, fav: boolean): Promise<void>;
  setTracksFav(ids: string[], fav: boolean): Promise<void>;
  updateTrack(id: string, artista: string, bpm: number, ocasion: string): Promise<void>;
  deleteTrack(id: string): Promise<Snapshot>;
  deleteTracks(ids: string[]): Promise<Snapshot>;
  /** Elige el archivo nuevo de una pista y la apunta a él; null si se canceló. */
  relocateTrack(id: string): Promise<Snapshot | null>;
  revealFile(path: string): Promise<void>;

  // ---- carpetas y escaneo
  pickFolder(): Promise<string | null>;
  addAndScanFolder(path: string, recursive: boolean): Promise<Snapshot>;
  rescanFolder(id: string): Promise<Snapshot>;
  cancelScan(): Promise<void>;
  onScanProgress(cb: (p: ScanProgressEvent) => void): Promise<() => void>;
  removeFolder(id: string): Promise<Snapshot>;
  /** Elige la ubicación nueva de una carpeta y la reapunta; null si se canceló. */
  relocateFolder(id: string): Promise<Snapshot | null>;

  // ---- cultos
  getPlaylists(): Promise<Playlist[]>;
  createPlaylist(nombre: string, ocasion: string, desde?: string): Promise<string>;
  duplicatePlaylist(id: string): Promise<string>;
  addTracksToPlaylist(playlist: string, ids: string[]): Promise<Playlist[]>;
  setPlaylistOrder(playlist: string, ids: string[]): Promise<void>;
  setPlaylistTemplate(playlist: string, plantilla: boolean): Promise<Playlist[]>;
  updatePlaylist(playlist: string, nombre: string, ocasion: string): Promise<Playlist[]>;
  touchPlaylist(playlist: string): Promise<void>;
  deletePlaylist(playlist: string): Promise<Playlist[]>;

  // ---- letras y acordes
  getTrackSheet(id: string): Promise<Sheet>;
  /** Solo las que tienen algo escrito. */
  getSheets(ids: string[]): Promise<Sheet[]>;
  updateTrackSheet(id: string, letra: string, acordes: string): Promise<void>;

  // ---- duplicados
  findDuplicates(): Promise<DuplicateReport>;
  mergeDuplicates(keep: string, drop: string[]): Promise<Snapshot>;
  dismissDuplicates(signature: string): Promise<DuplicateReport>;
  restoreDismissedDuplicates(): Promise<DuplicateReport>;

  // ---- ajustes
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // ---- copias de seguridad
  /** Elige dónde y copia la base; null si se canceló. */
  backup(): Promise<{ dest: string; cuando: string } | null>;
  /** Elige un respaldo para restaurar; null si se canceló. */
  pickBackup(): Promise<string | null>;
  inspectBackup(src: string): Promise<BackupInfo>;
  restoreDatabase(src: string): Promise<Snapshot>;
  /** Las que el núcleo guardó antes de quitar, restaurar o fusionar (#143). */
  listAutoBackups(): Promise<CopiaAutomatica[]>;

  // ---- archivos que salen y entran
  /** Guarda la hoja imprimible de un culto; false si se canceló. */
  saveSheet(nombre: string, html: string): Promise<boolean>;
  /** Guarda un culto para otra instalación; false si se canceló. */
  saveSharedList(nombre: string, json: string): Promise<boolean>;
  /** Abre un culto exportado desde otra instalación; null si se canceló. */
  openSharedList(): Promise<ArchivoDeLista | null>;
  /** Muestra el archivo de registro en el explorador. */
  revealLog(): Promise<void>;
}
