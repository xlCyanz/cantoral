// Memoización de un solo valor para los selectores puros del store.
//
// Vivía al final de store.ts; aquí se puede usar y probar sin arrastrar el
// store entero (#134).

/**
 * Wrap a pure selector so it only recomputes when what it reads changes.
 *
 * The library is filtered, sorted and grouped by more than one component on
 * every render, while the player writes `posSec` several times a second — so
 * without this the whole catalogue is walked a few dozen times a second to
 * produce a result that did not change. Keeping the previous result also keeps
 * its **identity**, which is what lets `useStore(applyFilters)` skip a render
 * instead of handing React a new array that merely looks the same.
 *
 * One entry is enough: every call inside a render pass reads the same
 * snapshot, and a snapshot that has been replaced is never read again.
 *
 * The cached value is shared between callers, so treat it as read-only.
 */
export function recordar<A extends unknown[], T>(
  calcular: (...args: A) => T,
  leer: (...args: A) => unknown[],
): (...args: A) => T {
  let deps: unknown[] | null = null;
  let valor!: T;
  return (...args: A): T => {
    const ahora = leer(...args);
    if (deps && deps.length === ahora.length && deps.every((d, i) => Object.is(d, ahora[i]))) return valor;
    deps = ahora;
    valor = calcular(...args);
    return valor;
  };
}
