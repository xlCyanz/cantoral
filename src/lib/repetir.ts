// El repertorio de un culto se parece al del culto anterior de la misma
// ocasión. Esto encuentra cuál era ese culto, para poder copiarlo de un clic.

import { comoFecha } from "./fechas";

/** Midnight today, so «already happened» does not depend on the time of day. */
function hoyLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export interface Repetible<T> {
  ocasion: string;
  /** The most recent list of that occasion that has already been held. */
  lista: T;
}

/**
 * The last service held, per occasion, most recent first.
 *
 * Only lists that already happened — today included — are offered. A list
 * dated next Sunday is the one being prepared, and offering to copy it would
 * suggest repeating something nobody has sung yet.
 *
 * Lists without a readable date are left out: there is no way to tell which of
 * two of them came last, and guessing would copy the wrong service.
 */
export function ultimaPorOcasion<T extends { fecha?: string; ocasion?: string; plantilla?: boolean }>(
  listas: readonly T[],
  hoy: Date = hoyLocal(),
): Repetible<T>[] {
  const mejor = new Map<string, { lista: T; t: number }>();
  listas.forEach((l) => {
    if (l.plantilla) return;
    const ocasion = l.ocasion?.trim();
    if (!ocasion) return;
    const f = comoFecha(l.fecha);
    if (!f || f.getTime() > hoy.getTime()) return;
    const previo = mejor.get(ocasion);
    if (!previo || f.getTime() > previo.t) mejor.set(ocasion, { lista: l, t: f.getTime() });
  });
  return [...mejor.entries()]
    .sort((a, b) => b[1].t - a[1].t)
    .map(([ocasion, { lista }]) => ({ ocasion, lista }));
}
