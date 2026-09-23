// Cómo se llama lo que hay en pantalla, y cuánto hay.
//
// La biblioteca era la única vista sin título: su sitio en la barra lo ocupa
// el buscador. Pero es justo donde más falta hace, porque «Biblioteca»,
// «Favoritas» y «Archivos faltantes» son la misma tabla filtrada y desde la
// tabla no se distinguen — la única pista era cuál de los cuatro botones de la
// barra lateral estaba encendido.
//
// Y el número también: «19 canciones» a secas no dice si son todas o si un
// filtro se está comiendo la mitad.

import type { GroupBy, QuickFilter } from "./types";

export interface Encabezado {
  titulo: string;
  /** Vacío cuando no hay nada que añadir al título. */
  subtitulo: string;
}

const NOMBRE_FILTRO: Record<Exclude<QuickFilter, null>, string> = {
  fav: "Favoritas",
  recent: "Recién agregadas",
  missing: "Archivos faltantes",
};

const NOMBRE_GRUPO: Record<Exclude<GroupBy, "none">, string> = {
  carpeta: "carpeta",
  ocasion: "ocasión",
  album: "álbum",
};

/**
 * El título y el subtítulo de la biblioteca.
 *
 * `mostradas` es lo que la tabla enseña ahora mismo y `total` lo que hay
 * indexado. Se dicen los dos cuando no coinciden: ver «19» sin saber que hay
 * 200 detrás hace pensar que la biblioteca se encogió.
 */
export function encabezadoBiblioteca(
  qf: QuickFilter,
  mostradas: number,
  total: number,
  groupBy: GroupBy,
  buscando: boolean,
): Encabezado {
  const titulo = qf ? NOMBRE_FILTRO[qf] : "Biblioteca";

  // Los archivos que faltan no se cuentan, se explican: quien llega aquí no
  // viene a ver cuántos son, viene a ver qué hacer con ellos.
  if (qf === "missing") {
    return {
      titulo,
      subtitulo:
        mostradas === 0
          ? "No falta ningún archivo."
          : "El archivo ya no está donde estaba. Puedes reapuntarlo sin perder etiquetas ni favorito.",
    };
  }

  const partes: string[] = [];
  // Sin filtro ni búsqueda, «19 de 19» sobra.
  partes.push(
    mostradas === total && !buscando
      ? `${total} ${total === 1 ? "pista" : "pistas"}`
      : `${mostradas} de ${total} ${total === 1 ? "pista" : "pistas"}`,
  );
  if (groupBy !== "none") partes.push(`agrupadas por ${NOMBRE_GRUPO[groupBy]}`);
  return { titulo, subtitulo: partes.join(" · ") };
}
