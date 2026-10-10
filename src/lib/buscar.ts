// Buscar en la biblioteca sin que importen las mayúsculas ni las tildes.
//
// La biblioteca y el diálogo de «Agregar canciones» buscan con esto, así que
// lo que aparece en uno aparece en el otro.

import type { Track } from "./types";

/** Minúsculas y sin tildes: «Señor» y «senor» se leen igual. */
export function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Lo que se busca de cada pista, ya sin tildes; uno por pista, no uno por tecla. */
const camposSinTildes = new WeakMap<Track, string>();

/**
 * Si lo buscado está en el título, el artista, el álbum o la ocasión.
 *
 * `q` llega ya pasado por `sinTildes`, una vez por búsqueda: quien escribe
 * «senor» encuentra «Señor».
 */
export function coincideEnCampos(t: Track, q: string): boolean {
  let campos = camposSinTildes.get(t);
  if (campos === undefined) {
    campos = sinTildes([t.titulo, t.artista, t.album, t.ocasion].join(" "));
    camposSinTildes.set(t, campos);
  }
  return campos.includes(q);
}
