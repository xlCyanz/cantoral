// Ordenar el catálogo una vez y no en cada cambio que no lo mueve.
//
// Con diez mil pistas, ordenar por título son cientos de miles de
// `localeCompare`: decenas de milisegundos en un portátil y varias veces más
// en el PC de una iglesia. Y casi nada de lo que cambia el catálogo mueve el
// orden: un corazón, el artista que se está escribiendo, una miniatura o una
// duración que llega cambian una pista sin tocar su título. Aquí se recuerda
// el orden como posiciones en el catálogo, y mientras las pistas sigan en el
// mismo sitio con el mismo valor para lo que se ordena, se reutiliza.
//
// `Intl.Collator` no sirve de atajo: medido aquí, en V8, ordenaba más despacio
// que `localeCompare("es")`.

/**
 * Un orden recordado. Cada llamada devuelve `items` ordenados con `comparar`.
 *
 * - `firma` dice qué orden se pide (columna y sentido); otra firma ordena de
 *   nuevo.
 * - `mismoValor(a, b)` dice si dos versiones de un elemento ordenan igual. Si
 *   todos los elementos están donde estaban y ordenan igual, el orden anterior
 *   vale: se reutilizan sus posiciones con los objetos nuevos, en una pasada.
 *
 * Ordena posiciones y no objetos, con un `sort` estable: los empates quedan en
 * el orden del catálogo, igual que con `items.slice().sort(comparar)`.
 *
 * El resultado se comparte entre llamadas: solo lectura.
 */
export function crearOrden<T extends { id: string }>() {
  let entrada: readonly T[] | null = null;
  let firmaAnterior = "";
  let posiciones: number[] = [];
  let salida: readonly T[] = [];

  return (
    items: readonly T[],
    firma: string,
    comparar: (a: T, b: T) => number,
    mismoValor: (a: T, b: T) => boolean,
  ): readonly T[] => {
    if (items === entrada && firma === firmaAnterior) return salida;
    const reutilizable = entrada !== null && firma === firmaAnterior && mismoSitio(entrada, items, mismoValor);
    if (!reutilizable) {
      posiciones = Array.from({ length: items.length }, (_, i) => i);
      posiciones.sort((a, b) => comparar(items[a], items[b]));
    }
    entrada = items;
    firmaAnterior = firma;
    salida = posiciones.map((i) => items[i]);
    return salida;
  };
}

/** Si cada elemento sigue en su sitio y ordena igual que antes. */
function mismoSitio<T extends { id: string }>(
  antes: readonly T[],
  ahora: readonly T[],
  mismoValor: (a: T, b: T) => boolean,
): boolean {
  if (antes.length !== ahora.length) return false;
  for (let i = 0; i < ahora.length; i++) {
    const a = antes[i];
    const b = ahora[i];
    if (a !== b && (a.id !== b.id || !mismoValor(a, b))) return false;
  }
  return true;
}
