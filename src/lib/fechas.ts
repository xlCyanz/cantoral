// La fecha de una lista se guarda como `YYYY-MM-DD`, que es lo que SQLite sabe
// ordenar. Aquí se convierte a algo que una persona lee, y se decide si un
// culto está por venir.

/** Whether a stored value is an ISO date this app can sort and read. */
export function esIso(valor: string | undefined | null): boolean {
  return !!valor && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

/**
 * An ISO date as a local `Date`, or null.
 *
 * Built field by field on purpose. `new Date("2025-07-13")` is parsed as UTC
 * midnight, which anywhere west of Greenwich renders as the 12th — a service
 * list showing the wrong day is exactly the failure this whole change exists
 * to prevent.
 */
export function comoFecha(iso: string | undefined | null): Date | null {
  if (!esIso(iso)) return null;
  const [a, m, d] = iso!.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  // Rejects «2025-02-31», which the constructor would roll into March.
  if (fecha.getFullYear() !== a || fecha.getMonth() !== m - 1 || fecha.getDate() !== d) return null;
  return fecha;
}

/**
 * The date as it should be read.
 *
 * Anything that is not ISO comes back untouched: dates written before this
 * existed are kept as their author typed them rather than blanked, so «el
 * domingo después de Pascua» still says something.
 */
export function formatearFecha(valor: string | undefined | null): string {
  const f = comoFecha(valor);
  if (!f) return valor?.trim() ?? "";
  return f.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** The short form, for a card where the long one would not fit. */
export function formatearFechaCorta(valor: string | undefined | null): string {
  const f = comoFecha(valor);
  if (!f) return valor?.trim() ?? "";
  return f.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

/** Midnight today, so comparing dates never depends on the time of day. */
function hoyLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/**
 * Whether a list is for a service still to come.
 *
 * Today counts as upcoming: on Sunday morning the service is the thing you are
 * about to do, not something already filed away.
 */
export function esProxima(valor: string | undefined | null, hoy: Date = hoyLocal()): boolean {
  const f = comoFecha(valor);
  return !!f && f.getTime() >= hoy.getTime();
}

export interface PorFecha<T> {
  /** Today and later, soonest first — the next service at the top. */
  proximos: T[];
  /** Before today, most recent first. */
  pasados: T[];
  /** No date, or one nobody could read. Order untouched. */
  sinFecha: T[];
}

/**
 * Split lists into what is coming, what already happened, and the rest.
 *
 * Upcoming goes soonest first, which is the opposite of past: what matters
 * ahead is the nearest service, and behind, the last one.
 */
export function partirPorFecha<T extends { fecha?: string }>(
  listas: readonly T[],
  hoy: Date = hoyLocal(),
): PorFecha<T> {
  const proximos: T[] = [];
  const pasados: T[] = [];
  const sinFecha: T[] = [];
  listas.forEach((l) => {
    if (!esIso(l.fecha)) sinFecha.push(l);
    else if (esProxima(l.fecha, hoy)) proximos.push(l);
    else pasados.push(l);
  });
  const clave = (l: T) => l.fecha ?? "";
  proximos.sort((a, b) => clave(a).localeCompare(clave(b)));
  pasados.sort((a, b) => clave(b).localeCompare(clave(a)));
  return { proximos, pasados, sinFecha };
}
