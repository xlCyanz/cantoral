// What a click does to a selection.
//
// Kept out of the store and out of React because it is the part with rules:
// plain click replaces, ⌘/Ctrl adds or removes, Shift takes a run. All of it
// relative to the list **as it is shown** — filtered, sorted, grouped — since
// that is the order the user sees and reasons about.

/** The modifier keys a click carried. */
export interface Modificadores {
  /** ⌘ on macOS, Ctrl elsewhere. */
  meta?: boolean;
  shift?: boolean;
}

/**
 * The run of ids between two rows, ends included, in display order.
 *
 * Direction does not matter: dragging a Shift-click upwards selects the same
 * rows as dragging it down.
 */
export function rango(visibles: readonly string[], desde: string, hasta: string): string[] {
  const a = visibles.indexOf(desde);
  const b = visibles.indexOf(hasta);
  if (a < 0 || b < 0) return b < 0 ? [] : [hasta];
  const [ini, fin] = a <= b ? [a, b] : [b, a];
  return visibles.slice(ini, fin + 1);
}

export interface Resultado {
  seleccion: string[];
  /** Row a later Shift-click measures from. */
  ancla: string | null;
  /** Whether this click should also open the detail panel. */
  abrirDetalle: boolean;
}

/**
 * Work out the new selection for a click on `id`.
 *
 * Only a plain click opens the detail panel: extending a selection is about
 * the set, and having the panel follow the last row touched would fight the
 * thing the user is doing.
 */
export function alHacerClic(
  visibles: readonly string[],
  seleccion: readonly string[],
  ancla: string | null,
  id: string,
  mods: Modificadores = {},
): Resultado {
  if (mods.shift) {
    // With nothing to measure from, Shift behaves like a plain click.
    const base = ancla ?? seleccion[seleccion.length - 1] ?? null;
    if (!base) return { seleccion: [id], ancla: id, abrirDetalle: false };
    return { seleccion: rango(visibles, base, id), ancla: base, abrirDetalle: false };
  }

  if (mods.meta) {
    const dentro = seleccion.includes(id);
    return {
      seleccion: dentro ? seleccion.filter((x) => x !== id) : [...seleccion, id],
      // Removing a row leaves the anchor where it was: the row is gone from
      // the selection, so measuring a later range from it would be odd.
      ancla: dentro ? ancla : id,
      abrirDetalle: false,
    };
  }

  return { seleccion: [id], ancla: id, abrirDetalle: true };
}

/**
 * The selection, in the order the rows are shown.
 *
 * Clicks arrive in whatever order the user made them, but everything done with
 * a selection — adding to a service list above all — should follow the order
 * on screen.
 */
export function enOrden(visibles: readonly string[], seleccion: readonly string[]): string[] {
  const elegidas = new Set(seleccion);
  return visibles.filter((id) => elegidas.has(id));
}

/**
 * Drop from the selection whatever is no longer on screen.
 *
 * A selection that outlives its rows is a bulk action about to touch tracks the
 * user can no longer see — after a filter change, a rescan, or a deletion.
 */
export function vigentes(visibles: readonly string[], seleccion: readonly string[]): string[] {
  const hay = new Set(visibles);
  return seleccion.filter((id) => hay.has(id));
}
