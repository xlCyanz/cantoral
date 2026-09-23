// Partir la letra de una canción en lo que cabe de una vez en un proyector.
//
// La hoja de una canción entera no cabe en una pantalla legible desde la
// última fila, así que proyectarla es proyectar un trozo cada vez. El trozo
// natural es la estrofa: es como está escrita la letra y es como la canta la
// congregación.
//
// Se parte por líneas en blanco y por encabezados de sección —`{coro}`,
// `{comment: Puente}`—, que es exactamente donde el autor de la hoja ya puso
// las separaciones. No se inventa ninguna: una hoja escrita de corrido sale
// como una sola estrofa, que es lo que dice su autor que es.
//
// Los acordes no entran. Por el proyector va la letra que canta la
// congregación; los acordes son para quien toca, y para eso está el modo
// culto en el atril.

import { parseHoja } from "./chords";

/** Un trozo de letra tal como sale por el proyector. */
export interface Estrofa {
  /** «Coro», «Puente»… Vacío cuando el trozo no lleva encabezado. */
  etiqueta: string;
  /** Las líneas de letra, ya sin acordes. */
  lineas: string[];
}

/** Cuántas líneas seguidas se proyectan juntas como mucho. */
const MAXIMO = 8;

/**
 * La letra de una hoja, partida en estrofas.
 *
 * `letra` es el campo de letra sola y `acordes` la hoja en ChordPro; se usa la
 * primera que tenga algo, porque una pista puede tener escrita una y no la
 * otra. De la hoja con acordes se saca solo el texto.
 *
 * Una estrofa muy larga se parte en trozos de `MAXIMO` líneas. Sin ese tope,
 * una hoja escrita sin líneas en blanco saldría entera en una pantalla, en un
 * tamaño que no se lee desde el fondo — que es el problema que esto viene a
 * resolver.
 */
export function estrofasDe(letra: string | undefined, acordes: string | undefined): Estrofa[] {
  const conAcordes = (acordes ?? "").trim();
  const sola = (letra ?? "").trim();
  if (!conAcordes && !sola) return [];

  const lineas = conAcordes
    ? parseHoja(conAcordes).map((l) =>
        l.tipo === "seccion"
          ? { seccion: l.etiqueta ?? "", texto: "" }
          : { seccion: null, texto: l.segmentos.map((s) => s.texto).join("") },
      )
    : sola.replace(/\r\n?/g, "\n").split("\n").map((t) => ({ seccion: null, texto: t }));

  const fuera: Estrofa[] = [];
  let actual: Estrofa | null = null;

  const cerrar = () => {
    if (actual && actual.lineas.length > 0) fuera.push(actual);
    actual = null;
  };

  for (const l of lineas) {
    if (l.seccion !== null) {
      // Un encabezado empieza estrofa aunque no venga precedido de un hueco.
      cerrar();
      actual = { etiqueta: l.seccion, lineas: [] };
      continue;
    }
    if (!l.texto.trim()) {
      cerrar();
      continue;
    }
    if (!actual) actual = { etiqueta: "", lineas: [] };
    actual.lineas.push(l.texto.trimEnd());
    if (actual.lineas.length === MAXIMO) {
      // Se parte, y lo que sigue hereda el encabezado: en la pantalla tiene que
      // seguir poniendo «Coro» mientras se está cantando el coro.
      const etiqueta = actual.etiqueta;
      cerrar();
      actual = { etiqueta, lineas: [] };
    }
  }
  cerrar();
  return fuera;
}
