// Domain types — mirror the SQLite schema and the UI view models.

export type Theme = "light" | "dark";
export type View = "biblioteca" | "colecciones" | "lista" | "config";
export type LibState = "content" | "empty" | "scanning" | "error";
export type QuickFilter = "fav" | "recent" | "missing" | null;
export type GroupBy = "none" | "ocasion" | "album" | "carpeta";
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
}

export interface Folder {
  id: string;
  nombre: string;
  ruta: string;
  count: number;
}

export interface Playlist {
  id: string;
  nombre: string;
  fecha: string;
  ocasion: string;
  /** Default ordered track ids (live order is kept in store.plOrder). */
  ids: string[];
}

/** Overlay of edited fields applied on top of a track until saved. */
export type TrackEdit = Partial<Pick<Track, "tono" | "bpm" | "ocasion" | "tags">>;
