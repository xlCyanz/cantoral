// The slice of interface state that outlives a session, and the reading of it.
//
// It travels as one JSON string under a single `settings` key rather than a
// row per field: nine round trips to the backend to remember a volume is nine
// more than it takes. What comes back is a file the user can have restored from
// a backup made by another version of the app, so nothing is trusted — every
// field is checked on its own and whatever does not hold up is dropped, leaving
// that preference at its default instead of poisoning the whole load.

import type { Densidad, GroupBy, SortDir, SortKey, View } from "./types";

/** What is remembered between sessions. */
export interface UiPrefs {
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  groupBy: GroupBy;
  view: View;
  curPlaylist: string;
  /** Whether the print preview includes the lyrics and chords. */
  printWithLyrics: boolean;
  /** How tall the library rows are. */
  densidad: Densidad;
}

/** The settings key it is stored under. */
export const UI_PREFS_KEY = "ui";

const SORT_KEYS: SortKey[] = ["titulo", "album", "ocasion", "tono", "bpm", "dur"];
const SORT_DIRS: SortDir[] = ["asc", "desc"];
const GROUP_BYS: GroupBy[] = ["none", "ocasion", "album", "carpeta"];
// «proyeccion» queda fuera a propósito: abrir Cantoral un martes por la tarde
// en la pantalla de proyectar, sin proyector conectado, no es donde nadie
// quiere aterrizar. Se recuerda dónde se estaba trabajando, no lo que se
// estaba haciendo en vivo.
const VIEWS: View[] = ["biblioteca", "colecciones", "lista", "config"];
const DENSIDADES: Densidad[] = ["comoda", "compacta"];

/** The fields worth writing back, in one place so a new one cannot be missed. */
export const PREF_FIELDS = [
  "volume",
  "muted",
  "shuffle",
  "repeat",
  "sortKey",
  "sortDir",
  "groupBy",
  "view",
  "curPlaylist",
  "printWithLyrics",
  "densidad",
] as const;

export function serialisePrefs(s: UiPrefs): string {
  const limpio: UiPrefs = {
    volume: s.volume,
    muted: s.muted,
    shuffle: s.shuffle,
    repeat: s.repeat,
    sortKey: s.sortKey,
    sortDir: s.sortDir,
    groupBy: s.groupBy,
    view: s.view,
    curPlaylist: s.curPlaylist,
    printWithLyrics: s.printWithLyrics,
    densidad: s.densidad,
  };
  return JSON.stringify(limpio);
}

function esBooleano(v: unknown): v is boolean {
  return typeof v === "boolean";
}

/**
 * Read back what was stored, keeping only the fields that still make sense.
 *
 * Returns the fields it could vouch for and nothing else, so the caller can
 * apply it over the defaults. A string that is not even JSON gives an empty
 * object rather than an exception: a preference that cannot be read is worth
 * losing, not worth failing the whole startup for.
 */
export function parsePrefs(raw: string | null | undefined): Partial<UiPrefs> {
  if (!raw) return {};
  let crudo: unknown;
  try {
    crudo = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) return {};
  const o = crudo as Record<string, unknown>;
  const out: Partial<UiPrefs> = {};

  // A volume out of range is clamped rather than dropped: whoever wrote 1.4
  // meant «as loud as it goes», and silently starting at 0.72 would be worse.
  if (typeof o.volume === "number" && Number.isFinite(o.volume)) {
    out.volume = Math.min(1, Math.max(0, o.volume));
  }
  if (esBooleano(o.muted)) out.muted = o.muted;
  if (esBooleano(o.shuffle)) out.shuffle = o.shuffle;
  if (esBooleano(o.repeat)) out.repeat = o.repeat;
  if (SORT_KEYS.includes(o.sortKey as SortKey)) out.sortKey = o.sortKey as SortKey;
  if (SORT_DIRS.includes(o.sortDir as SortDir)) out.sortDir = o.sortDir as SortDir;
  if (GROUP_BYS.includes(o.groupBy as GroupBy)) out.groupBy = o.groupBy as GroupBy;
  if (VIEWS.includes(o.view as View)) out.view = o.view as View;
  if (typeof o.curPlaylist === "string") out.curPlaylist = o.curPlaylist;
  if (esBooleano(o.printWithLyrics)) out.printWithLyrics = o.printWithLyrics;
  if (DENSIDADES.includes(o.densidad as Densidad)) out.densidad = o.densidad as Densidad;
  return out;
}

/**
 * Settle the remembered view against the lists that actually exist.
 *
 * A service list that was deleted — or that belongs to a library restored from
 * somewhere else — would otherwise open as an empty list view with no way of
 * telling why. The library is always a safe place to land.
 */
export function resolveView(
  prefs: Partial<UiPrefs>,
  playlists: readonly { id: string }[],
): { view?: View; curPlaylist?: string } {
  const existe = prefs.curPlaylist !== undefined && playlists.some((p) => p.id === prefs.curPlaylist);
  const out: { view?: View; curPlaylist?: string } = {};
  if (existe) out.curPlaylist = prefs.curPlaylist;
  if (prefs.view !== undefined) out.view = prefs.view === "lista" && !existe ? "biblioteca" : prefs.view;
  return out;
}
