// Windowing math for the library table.
//
// Kept out of the component, and out of the DOM, so the arithmetic that decides
// which rows exist can be read and tested on its own. Row heights are pinned
// here and applied as explicit heights in the view: derive them from padding
// and line height instead and the table drifts the moment a platform renders
// the font a pixel taller.

import type { Track } from "./types";

/** Height of one track row, in pixels. */
export const ALTO_FILA = 56;
/** Height of one group header. */
export const ALTO_GRUPO = 44;
/** Rows kept mounted above and below the viewport, so a fast scroll is not blank. */
export const MARGEN = 8;
/**
 * Number of rows from which the table is windowed.
 *
 * Windowing costs something real: only the rows near the viewport exist, so
 * ⌘F, the tab order and a screen reader's row count cover the window rather
 * than the whole library. A few dozen rows are cheap to keep whole, and that
 * is what most libraries are — the cost this pays for only shows up at the
 * thousands of pistas the windowing is for.
 */
export const DESDE = 120;

/** One row of the flattened table: a group header, or a track. */
export type Fila =
  | { tipo: "grupo"; label: string; countLabel: string }
  | { tipo: "pista"; track: Track; num: number };

/**
 * The shape `buildGroups` returns, restated structurally so this module owes
 * nothing to the store.
 */
interface Grupo {
  showHeader: boolean;
  label?: string;
  countLabel?: string;
  tracks: { track: Track; num: number }[];
}

/** A flattened table plus where every row starts, so an offset maps to an index. */
export interface Plano {
  filas: Fila[];
  /** `offsets[i]` is the top of row `i`; the last entry is the table's full height. */
  offsets: number[];
}

/** Flatten groups into rows and measure where each one sits. */
export function aplanar(grupos: Grupo[]): Plano {
  const filas: Fila[] = [];
  const offsets: number[] = [0];
  let y = 0;
  for (const g of grupos) {
    if (g.showHeader) {
      filas.push({ tipo: "grupo", label: g.label ?? "", countLabel: g.countLabel ?? "" });
      y += ALTO_GRUPO;
      offsets.push(y);
    }
    for (const { track, num } of g.tracks) {
      filas.push({ tipo: "pista", track, num });
      y += ALTO_FILA;
      offsets.push(y);
    }
  }
  return { filas, offsets };
}

/** Full height of a flattened table, which is what holds the scrollbar open. */
export function altoTotal(plano: Plano): number {
  return plano.offsets[plano.offsets.length - 1];
}

/**
 * Half-open range of rows to render at a scroll position.
 *
 * `desplazado` is how much of the table has already scrolled past the top of
 * the viewport, `visible` how tall that viewport is. `desde` is inclusive,
 * `hasta` exclusive, and `plano.offsets[desde]` is how far down the rendered
 * slice has to be pushed to land where it belongs.
 */
export function ventana(
  plano: Plano,
  desplazado: number,
  visible: number,
  margen = MARGEN,
): { desde: number; hasta: number } {
  const n = plano.filas.length;
  if (n === 0) return { desde: 0, hasta: 0 };
  const arriba = Math.max(0, desplazado);
  const primera = filaEn(plano.offsets, arriba, n);
  const ultima = filaEn(plano.offsets, arriba + Math.max(0, visible), n);
  return { desde: Math.max(0, primera - margen), hasta: Math.min(n, ultima + 1 + margen) };
}

/** Index of the row that contains `y`, by binary search over the row tops. */
function filaEn(offsets: number[], y: number, n: number): number {
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const medio = (lo + hi + 1) >> 1;
    if (offsets[medio] <= y) lo = medio;
    else hi = medio - 1;
  }
  return lo;
}
