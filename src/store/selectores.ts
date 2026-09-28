import type { Playlist, Track } from "../lib/types";
import { carpetaReal } from "../lib/carpetas";
import { enOrden, vigentes } from "../lib/selection";
import type { CantoralState } from "./tipos";
import { recordar } from "../lib/memo";

// ============================================================
// Derived selectors (pure) — used by components against a state snapshot.
// ============================================================

/**
 * The catalogue by id, built once per catalogue.
 *
 * Every list view turns an order of ids into tracks. With `tracks.find` that
 * was one walk of the whole library per id —thirty ids over five thousand
 * tracks is 150 000 comparisons per render (#136)—; this is one walk per
 * catalogue, and the catalogue only changes when a snapshot lands.
 */
export const pistasPorId = recordar(
  (tracks: readonly Track[]): ReadonlyMap<string, Track> => new Map(tracks.map((t) => [t.id, t])),
  (tracks: readonly Track[]) => [tracks],
);

/**
 * The highest track id in the catalogue, or 0 without any.
 *
 * Numeric: ids are strings on this side, and "10" sorts before "9".
 */
export function ultimoId(tracks: readonly Track[]): number {
  let max = 0;
  for (const t of tracks) {
    const n = Number(t.id);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/**
 * Whether the scan takes over the library view instead of a corner card.
 *
 * Only for a scan that has nothing behind it: a first scan of an empty
 * library, where a corner card would float over a blank screen. The moment
 * there is a catalogue to show — even one the running scan is still filling —
 * the table wins and the scan moves to the corner.
 *
 * Shared by the view and the card so the two can never both decide they are
 * the one showing the progress.
 */
export function escaneoAPantallaCompleta(s: CantoralState): boolean {
  return s.scanning && s.libState === "empty" && s.view === "biblioteca";
}

/** Currently loaded player track. */
export function cur(s: CantoralState): Track | null {
  return pistasPorId(s.tracks).get(s.playerId) ?? null;
}

/**
 * Occasions actually present in the catalogue, for the filter chips.
 *
 * Derived rather than hardcoded so a custom occasion shows up as a filter as
 * soon as a track carries it — the detail panel writes occasions straight into
 * the catalogue, so there is no half-saved state to reason about here.
 */
export const ocasiones = recordar(
  (s: CantoralState): string[] => {
    const found = new Set<string>();
    s.tracks.forEach((t) => {
      const o = t.ocasion?.trim();
      if (o) found.add(o);
    });
    // Keep the active filter listed even if its last track just changed occasion,
    // otherwise its chip vanishes and the filter can no longer be switched off.
    if (s.ocasion) found.add(s.ocasion);
    return [...found].sort((a, b) => a.localeCompare(b, "es"));
  },
  (s: CantoralState) => [s.tracks, s.ocasion],
);

/** Ocasiones que vale la pena sugerir aunque nada las lleve todavía. */
const OCASIONES_DE_SIEMPRE = [
  "Servicio dominical",
  "Adoración",
  "Alabanza",
  "Comunión",
  "Ofrenda",
  "Reflexión",
  "Navidad",
  "Resurrección",
  "Reunión juvenil",
  "Ensayo",
];

/**
 * Lo que se sugiere al escribir una ocasión, en una pista o en un culto.
 *
 * Las que ya usa esta iglesia primero —en sus pistas y en sus cultos—, y
 * después las de siempre que aún no. Antes el panel de detalle y el diálogo
 * de nueva lista sugerían cosas distintas, y el diálogo ninguna del catálogo:
 * quien etiquetaba sus pistas «Culto de jóvenes» no lo veía al crear la
 * lista de ese culto (#139).
 */
export const sugerenciasDeOcasion = recordar(
  (s: CantoralState): string[] => {
    const propias = new Set<string>();
    for (const o of [...s.tracks.map((t) => t.ocasion), ...s.playlists.map((p) => p.ocasion)]) {
      const limpia = o?.trim();
      if (limpia) propias.add(limpia);
    }
    const suyas = [...propias].sort((a, b) => a.localeCompare(b, "es"));
    return [...suyas, ...OCASIONES_DE_SIEMPRE.filter((o) => !propias.has(o))];
  },
  (s: CantoralState) => [s.tracks, s.playlists],
);

/**
 * Tracks of the open culto list, in its order, skipping ids whose track is gone.
 *
 * Remembered like the others: the view reads it on every render, and a fresh
 * array each time would re-render the whole list once a second.
 */
export const filasDeLista = recordar(
  (s: CantoralState): Track[] =>
    (s.plOrder[s.curPlaylist] || [])
      .map((id) => pistasPorId(s.tracks).get(id))
      .filter((t): t is Track => !!t),
  (s: CantoralState) => [s.curPlaylist, s.plOrder[s.curPlaylist], s.tracks],
);

/**
 * Las pistas sobre las que actúa «Agregar a un culto».
 *
 * La selección si hay una; si no, la pista que el panel de detalle tiene
 * abierta. En ese orden, porque una selección es explícita y el panel puede
 * llevar abierto desde hace rato. El menú contextual no hace falta mirarlo:
 * `openRowMenu` ya deja la selección apuntando a la fila sobre la que se abrió.
 */
export const pistasParaAgregar = recordar(
  (s: CantoralState): readonly string[] => {
    const elegidas = seleccionVigente(s);
    if (elegidas.length > 0) return elegidas;
    return s.detailOpen && s.selId ? [s.selId] : VACIO;
  },
  (s: CantoralState) => [seleccionVigente(s), s.detailOpen, s.selId],
);

/** Una sola instancia, para que el memo de arriba conserve su identidad. */
const VACIO: readonly string[] = [];

/**
 * The selection, pruned to what is on screen and put in display order.
 *
 * Both the count the user reads and the ids a bulk action sends come from
 * here, so a selection that outlived its rows — after a filter change, a
 * rescan or a deletion — can never be acted on behind the user's back.
 */
export const seleccionVigente = recordar(
  (s: CantoralState): string[] => {
    const visibles = applyFilters(s).map((t) => t.id);
    return enOrden(visibles, vigentes(visibles, s.selection));
  },
  (s: CantoralState) => [s.tracks, s.qf, s.ocasion, s.query, s.sortKey, s.sortDir, s.selection],
);

/**
 * The lists kept as starting points for new ones.
 *
 * Remembered so that the «Nueva lista» dialog is handed the same array while
 * nothing changed: a fresh one on every read would re-render the dialog on
 * each tick of the player.
 */
export const plantillas = recordar(
  (s: CantoralState): Playlist[] => s.playlists.filter((p) => p.plantilla),
  (s: CantoralState) => [s.playlists],
);

/** Cuándo se tocó un culto, en milisegundos; `0` si no lo dice. */
function cuandoSeToco(p: Playlist): number {
  const t = Date.parse(p.tocada);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Los cultos, el último que se tocó arriba. Las plantillas, fuera.
 *
 * Se compara el instante y no el texto: el núcleo escribe `+00:00` y el
 * navegador `Z`, y como texto esas dos formas del mismo momento no ordenan
 * igual. El orden es estable, así que un empate conserva el que trajo el
 * núcleo.
 */
export const cultos = recordar(
  (s: CantoralState): Playlist[] =>
    s.playlists.filter((p) => !p.plantilla).sort((a, b) => cuandoSeToco(b) - cuandoSeToco(a)),
  (s: CantoralState) => [s.playlists],
);

/** Ids that form the play queue for the view the user pressed play in. */
export function queueForView(s: CantoralState): string[] {
  if (s.view === "lista") return (s.plOrder[s.curPlaylist] || []).slice();
  return applyFilters(s).map((t) => t.id);
}

/** Live play queue, minus ids whose track disappeared. Falls back to the library. */
export function playQueue(s: CantoralState): string[] {
  const ids = new Set(s.tracks.map((t) => t.id));
  const live = s.queue.filter((id) => ids.has(id));
  return live.length ? live : applyFilters(s).map((t) => t.id);
}

/** Filter + sort the library exactly like the design's applyFilters(). */
export const applyFilters = recordar(
  (s: CantoralState): Track[] => {
    let list = s.tracks.slice();
    if (s.qf === "fav") list = list.filter((t) => t.fav);
    else if (s.qf === "missing") list = list.filter((t) => t.missing);
    // Lo que trajo el último escaneo, todo, lo más nuevo arriba. Antes eran las
    // ocho de id más alto sin decirlo: quien indexaba cuarenta veía ocho (#139).
    else if (s.qf === "recent") list = list.filter((t) => t.nueva).sort((a, b) => b.added - a.added);
    if (s.ocasion) list = list.filter((t) => t.ocasion === s.ocasion);
    if (s.query) {
      const q = s.query.toLowerCase();
      list = list.filter((t) =>
        [t.titulo, t.artista, t.album, t.ocasion]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    if (s.qf !== "recent") {
      const dir = s.sortDir === "asc" ? 1 : -1;
      const k = s.sortKey;
      list.sort((a, b) => {
        let av: string | number = a[k as keyof Track] as never;
        let bv: string | number = b[k as keyof Track] as never;
        if (k === "dur") {
          av = a.durSec;
          bv = b.durSec;
        }
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
        return String(av).localeCompare(String(bv), "es") * dir;
      });
    }
    return list;
  },
  (s: CantoralState) => [s.tracks, s.qf, s.ocasion, s.query, s.sortKey, s.sortDir],
);

export interface Group {
  showHeader: boolean;
  /** Identidad del grupo, para plegarlo. Vacía cuando no hay agrupación. */
  clave: string;
  label?: string;
  /** La carpeta en el disco, solo al agrupar por carpeta. */
  ruta?: string;
  countLabel?: string;
  /** Cuántas pistas tiene, plegado o no: el encabezado sigue diciéndolo. */
  count: number;
  colapsado: boolean;
  tracks: { track: Track; num: number }[];
}

/**
 * Group + number the filtered list.
 *
 * Agrupar por carpeta usa la carpeta *del disco*, no la raíz indexada: ver
 * `carpetaReal`. Un grupo plegado no entrega pistas, y la numeración solo
 * avanza sobre lo que se está viendo, así que los números siempre leen 1, 2,
 * 3… hacia abajo de la tabla.
 */
export const buildGroups = recordar(
  (s: CantoralState, list: Track[]): Group[] => {
    if (s.groupBy === "none" || s.qf === "recent") {
      return [
        {
          showHeader: false,
          clave: "",
          count: list.length,
          colapsado: false,
          tracks: list.map((track, i) => ({ track, num: i + 1 })),
        },
      ];
    }
    const porCarpeta = s.groupBy === "carpeta";
    const key = s.groupBy;
    const mapa = new Map<string, { nombre: string; ruta: string; pistas: Track[] }>();
    list.forEach((t) => {
      const c = porCarpeta
        ? carpetaReal(t, s.folders)
        : (() => {
            const v = ((t[key as keyof Track] as string) || "").trim() || "—";
            return { clave: v, nombre: v, ruta: "" };
          })();
      let g = mapa.get(c.clave);
      if (!g) {
        g = { nombre: c.nombre, ruta: c.ruta, pistas: [] };
        mapa.set(c.clave, g);
      }
      g.pistas.push(t);
    });
    const claves = [...mapa.keys()].sort((a, b) =>
      mapa.get(a)!.nombre.localeCompare(mapa.get(b)!.nombre, "es"),
    );
    let n = 0;
    return claves.map((clave) => {
      const g = mapa.get(clave)!;
      const colapsado = s.gruposColapsados.includes(clave);
      return {
        showHeader: true,
        clave,
        label: g.nombre,
        ruta: g.ruta,
        count: g.pistas.length,
        countLabel: g.pistas.length + (g.pistas.length === 1 ? " pista" : " pistas"),
        colapsado,
        tracks: colapsado ? [] : g.pistas.map((track) => ({ track, num: ++n })),
      };
    });
  },
  (s: CantoralState, list: Track[]) => [list, s.groupBy, s.qf, s.folders, s.gruposColapsados],
);

/**
 * Total playlist duration label, e.g. "23 min".
 *
 * Takes the catalogue rather than the whole state so a view can call it while
 * only subscribing to `tracks`.
 */
export function plDur(s: { tracks: Track[] }, ids: string[]): string {
  const porId = pistasPorId(s.tracks);
  const total = ids.reduce((a, id) => a + (porId.get(id)?.durSec ?? 0), 0);
  return Math.round(total / 60) + " min";
}
