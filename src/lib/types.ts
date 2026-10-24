// Domain types — mirror the SQLite schema and the UI view models.

export type Theme = "light" | "dark";
export type ThemeMode = "light" | "dark" | "system";
export type View = "biblioteca" | "colecciones" | "lista" | "config";
/**
 * What the library view has to show. A scan in flight is *not* one of these:
 * it runs alongside whatever the library already holds (see `scanning`).
 */
export type LibState = "content" | "empty" | "error";
export type QuickFilter = "fav" | "recent" | "missing" | null;
export type GroupBy = "none" | "album" | "carpeta";
/**
 * Cuánto respira la tabla de la biblioteca.
 *
 * «Cómoda» es para preparar: hay sitio para la carátula y el ojo descansa.
 * «Compacta» es para el domingo, cuando lo que importa es cuántas filas caben
 * en la pantalla del atril sin tener que desplazarse a media alabanza.
 */
export type Densidad = "comoda" | "compacta";
export type SortKey = "titulo" | "album" | "dur";
export type SortDir = "asc" | "desc";

export interface Track {
  id: string;
  titulo: string;
  artista: string;
  album: string;
  /** Human-readable duration, e.g. "4:12". */
  dur: string;
  durSec: number;
  /** File format label, e.g. "MP3", "WAV", "MP4". */
  formato: string;
  /** Folder friendly name this track belongs to. */
  carpeta: string;
  fav: boolean;
  missing: boolean;
  /** Recency rank (mock) / added timestamp ordinal (backend). Higher = newer. */
  added: number;
  video?: boolean;
  /** Absolute path on disk (backend only). */
  path?: string;
  /** Cover art URL (asset:// in the app), if the file had embedded art. */
  cover?: string;
  /**
   * Si entró con el último escaneo: lo que enseña «Recién agregadas» (#139).
   * Un reescaneo sin novedades no deja ninguna marcada.
   */
  nueva?: boolean;
  /**
   * Si es un video del que no se pudo sacar miniatura (backend only). No se
   * vuelve a intentar hasta que el archivo cambie o se reubique.
   */
  miniaturaFallida?: boolean;
  /** Nombres de los cantantes que se saben esta pista. */
  singers: string[];
}

/** Una persona que canta en la iglesia. */
export interface Singer {
  id: string;
  nombre: string;
}

export interface Folder {
  id: string;
  nombre: string;
  ruta: string;
  count: number;
  /** RFC3339 timestamp of the last scan, if scanned. */
  lastScan?: string;
  /** Whether scans of this folder descend into subfolders (backend only). */
  recursive?: boolean;
}

export interface Playlist {
  id: string;
  nombre: string;
  /** Default order (live order is kept in store.plOrder): track ids. */
  ids: string[];
  /**
   * La última vez que se abrió o se cambió, en ISO. Es lo que ordena los
   * cultos: no tienen fecha, y lo que se está preparando es lo último que se
   * tocó.
   */
  tocada: string;
}

/** Overlay of edited fields applied on top of a track until saved. */
export type TrackEdit = Partial<Pick<Track, "artista">>;
