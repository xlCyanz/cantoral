// Cómo se llama la copia de una lista.
//
// La regla vive en Rust (`db::nombre_copia`), que es la que corre en la app.
// Esto la repite para el modo navegador, igual que el resto del store repite
// en memoria lo que allí hace SQLite. Las pruebas de los dos lados usan los
// mismos casos a propósito: si una se mueve, la otra lo dice.

/** `«Culto (copia 3)»` → `«Culto»`. Anything else comes back untouched. */
function raizSinCopia(nombre: string): string {
  const m = /^(.*) \(copia(| \d+)\)$/.exec(nombre);
  // «Culto (copiado)» is a name, not a copy of «Culto».
  return m ? m[1] : nombre;
}

/**
 * The name a copy of `base` should get, avoiding the names already in use.
 *
 * Copying a copy gives «Culto (copia 2)», not «Culto (copia) (copia)».
 */
export function nombreDeCopia(base: string, usados: readonly string[]): string {
  const raiz = raizSinCopia(base.trim());
  const libre = (n: string) => !usados.some((u) => u.trim() === n);
  const primero = `${raiz} (copia)`;
  if (libre(primero)) return primero;
  // Starts at 2 because «(copia)» is the first one.
  for (let n = 2; n < 1000; n++) {
    const intento = `${raiz} (copia ${n})`;
    if (libre(intento)) return intento;
  }
  return primero;
}
