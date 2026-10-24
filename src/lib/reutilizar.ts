// Quedarse con las pistas que ya se tenían cuando el núcleo las manda iguales.
//
// Cada instantánea —un reescaneo, quitar una pista, reubicar un archivo— trae
// el catálogo entero en objetos nuevos, aunque casi todos digan lo mismo que
// los que ya había. Lo que se recuerda por objeto se perdía con ellos: las
// filas memorizadas de la tabla se volvían a pintar todas, y la búsqueda
// volvía a quitar las tildes de toda la biblioteca. Aquí cada pista que llega
// igual a la que había se cambia por la que había.

import type { Track } from "./types";

/** Si dos listas de nombres de cantantes dicen lo mismo. */
function mismosNombres(a: readonly string[], b: readonly string[]): boolean {
  return a === b || (a.length === b.length && a.every((nombre, i) => nombre === b[i]));
}

/** Si dos pistas dicen lo mismo, campo a campo. */
export function mismaPista(a: Track, b: Track): boolean {
  if (a === b) return true;
  const campos = Object.keys(a) as (keyof Track)[];
  if (campos.length !== Object.keys(b).length) return false;
  return campos.every((k) =>
    k === "singers"
      ? // Dos listas gemelas no son el mismo objeto y `Object.is` no las
        // diferencia: los nombres comparados por contenido no mueven una fila.
        mismosNombres(a.singers, b.singers)
      : Object.is(a[k], b[k]),
  );
}

/**
 * `nuevas`, con cada pista que llega igual cambiada por la que ya se tenía.
 *
 * Si todas llegan iguales y en el mismo orden, devuelve `antes` tal cual: el
 * catálogo no cambió, y nada de lo que se recuerda por él tiene por qué
 * recalcularse.
 */
export function conservarIguales(antes: Track[], nuevas: Track[]): Track[] {
  if (antes.length === 0) return nuevas;
  const porId = new Map<string, Track>();
  for (const t of antes) porId.set(t.id, t);
  let todoIgual = antes.length === nuevas.length;
  const fuera = nuevas.map((t, i) => {
    const previa = porId.get(t.id);
    if (previa && mismaPista(previa, t)) {
      if (antes[i] !== previa) todoIgual = false;
      return previa;
    }
    todoIgual = false;
    return t;
  });
  return todoIgual ? antes : fuera;
}

/**
 * `antes` sin las pistas `quitadas` y con las `cambiadas` puestas en su sitio.
 *
 * Es lo que contesta el núcleo a quitar, reubicar o fusionar pistas, en vez
 * del catálogo entero (ver `Parche`). Las demás pistas siguen siendo los
 * mismos objetos, y una cambiada que llega igual a la que había se queda con
 * la de antes. Si al final nada cambió, devuelve `antes` tal cual. Una
 * cambiada que no estaba en el catálogo no se añade: el parche nunca trae
 * pistas nuevas.
 */
export function aplicarParche(antes: Track[], quitadas: readonly string[], cambiadas: readonly Track[]): Track[] {
  if (quitadas.length === 0 && cambiadas.length === 0) return antes;
  const fuera = new Set(quitadas);
  const nuevas = new Map(cambiadas.map((t) => [t.id, t]));
  let igual = true;
  const quedan: Track[] = [];
  for (const t of antes) {
    if (fuera.has(t.id)) {
      igual = false;
      continue;
    }
    const nueva = nuevas.get(t.id);
    if (!nueva || mismaPista(t, nueva)) {
      quedan.push(t);
    } else {
      igual = false;
      quedan.push(nueva);
    }
  }
  return igual ? antes : quedan;
}
