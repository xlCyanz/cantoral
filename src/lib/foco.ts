// Focus trapping for dialogs: what can take focus, and where Tab wraps. Kept
// out of Modal.tsx so that file only exports components (fast refresh), and
// so the wrapping rule can be tested without a DOM.

/** What `Tab` is allowed to land on inside a dialog. */
const ENFOCABLES = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** The focusable controls of a container, in tab order. */
export function enfocables(caja: HTMLElement): HTMLElement[] {
  return [...caja.querySelectorAll<HTMLElement>(ENFOCABLES)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Which control `Tab` should move to, when the move has to wrap.
 *
 * Returns `null` when the browser's own behaviour is already right — that is,
 * everywhere except the two edges of the dialog, where `Tab` would otherwise
 * walk out into the page behind it.
 */
export function siguienteFoco(
  lista: readonly HTMLElement[],
  activo: Element | null,
  haciaAtras: boolean,
): HTMLElement | null {
  if (lista.length === 0) return null;
  const primero = lista[0];
  const ultimo = lista[lista.length - 1];
  // Focus that escaped the dialog — or never entered it — comes back in.
  if (!activo || !lista.includes(activo as HTMLElement)) return haciaAtras ? ultimo : primero;
  if (haciaAtras && activo === primero) return ultimo;
  if (!haciaAtras && activo === ultimo) return primero;
  return null;
}
