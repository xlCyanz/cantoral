// Domain types — mirror the SQLite schema and the UI view models.

export type Theme = "light" | "dark";
export type ThemeMode = "light" | "dark" | "system";
export type View = "biblioteca" | "colecciones" | "lista" | "config" | "proyeccion";
/**
 * What the library view has to show. A scan in flight is *not* one of these:
 * it runs alongside whatever the library already holds (see `scanning`).
 */
export type LibState = "content" | "empty" | "error";
export type QuickFilter = "fav" | "recent" | "missing" | null;
export type GroupBy = "none" | "ocasion" | "album" | "carpeta";
/**
 * Cuánto respira la tabla de la biblioteca.
 *
 * «Cómoda» es para preparar: hay sitio para la carátula y el ojo descansa.
 * «Compacta» es para el domingo, cuando lo que importa es cuántas filas caben
 * en la pantalla del atril sin tener que desplazarse a media alabanza.
 */
export type Densidad = "comoda" | "compacta";
export type SortKey = "titulo" | "album" | "ocasion" | "tono" | "bpm" | "dur";
export type SortDir = "asc" | "desc";

export interface Track {
  id: string;
  titulo: string;
  artista: string;
  album: string;
  /** Human-readable duration, e.g. "4:12". */
  dur: string;
  durSec: number;
  /** Musical key (tono), e.g. "Sol", "Lam". */
  tono: string;
  bpm: number;
  ocasion: string;
  /** File format label, e.g. "MP3", "WAV", "MP4". */
  formato: string;
  /** Folder friendly name this track belongs to. */
  carpeta: string;
  tags: string[];
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
   * Whether this track has lyrics or chords written down.
   *
   * A flag, not the sheet: the catalogue travels whole on every refresh, and a
   * few thousand sheets would make every snapshot megabytes of text that the
   * screen asking for it is not going to read.
   */
  tieneHoja: boolean;
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
  fecha: string;
  ocasion: string;
  /** Default ordered track ids (live order is kept in store.plOrder). */
  ids: string[];
  /** A list kept as a starting point rather than as a service of its own. */
  plantilla: boolean;
}

/** Overlay of edited fields applied on top of a track until saved. */
export type TrackEdit = Partial<Pick<Track, "tono" | "bpm" | "ocasion" | "tags">>;
