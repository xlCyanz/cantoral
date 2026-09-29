// Los momentos del culto que no son pistas (#145): una oración, una lectura,
// los anuncios.
//
// Viven en el mismo orden que las pistas —`plOrder` sigue siendo una lista de
// cadenas— con un id que empieza por `m:`. Así arrastrar, subir y bajar, quitar
// y guardar el orden no tienen que saber que existen; lo que sí tiene que
// saberlo es lo que *dibuja* o *reproduce* el culto, y para eso está
// `Elemento`.

import type { Momento, TipoMomento, Track } from "./types";

/** Con qué empieza el id de un momento. Debe coincidir con `db::PREFIJO_MOMENTO`. */
export const PREFIJO_MOMENTO = "m:";

/** Si una entrada del orden de un culto es un momento y no una pista. */
export function esMomento(id: string): boolean {
  return id.startsWith(PREFIJO_MOMENTO);
}

/** Solo las pistas de un orden: lo que se reproduce, se cuenta como «pistas» o lleva letra. */
export function soloPistas(ids: readonly string[]): string[] {
  return ids.filter((id) => !esMomento(id));
}

/** Los tipos, en el orden en que se ofrecen, con su nombre para leer. */
export const TIPOS_DE_MOMENTO: readonly { tipo: TipoMomento; etiqueta: string }[] = [
  { tipo: "oracion", etiqueta: "Oración" },
  { tipo: "lectura", etiqueta: "Lectura" },
  { tipo: "anuncios", etiqueta: "Anuncios" },
  { tipo: "ofrenda", etiqueta: "Ofrenda" },
  { tipo: "mensaje", etiqueta: "Mensaje" },
  { tipo: "otro", etiqueta: "Otro" },
];

/** Un tipo que llega de fuera —un archivo, otra versión— y no se conoce es «otro». */
export function tipoDeMomento(tipo: unknown): TipoMomento {
  return TIPOS_DE_MOMENTO.find((t) => t.tipo === tipo)?.tipo ?? "otro";
}

export function etiquetaDeTipo(tipo: TipoMomento): string {
  return TIPOS_DE_MOMENTO.find((t) => t.tipo === tipo)?.etiqueta ?? "Otro";
}

/** Una entrada del culto ya resuelta: la pista o el momento que hay en ese sitio. */
export type Elemento =
  | { clase: "pista"; id: string; pista: Track }
  | { clase: "momento"; id: string; momento: Momento };

/**
 * El orden de un culto convertido en lo que hay que dibujar.
 *
 * Se salta lo que ya no existe —una pista que se quitó de la biblioteca, un
 * momento que se borró en otra ventana—, como antes se saltaban las pistas.
 */
export function elementosDe(
  ids: readonly string[],
  pistas: ReadonlyMap<string, Track>,
  momentos: ReadonlyMap<string, Momento>,
): Elemento[] {
  const fuera: Elemento[] = [];
  for (const id of ids) {
    if (esMomento(id)) {
      const momento = momentos.get(id);
      if (momento) fuera.push({ clase: "momento", id, momento });
    } else {
      const pista = pistas.get(id);
      if (pista) fuera.push({ clase: "pista", id, pista });
    }
  }
  return fuera;
}

/** Las pistas de una lista de elementos, en su orden. */
export function pistasDe(elementos: readonly Elemento[]): Track[] {
  return elementos.flatMap((e) => (e.clase === "pista" ? [e.pista] : []));
}

/**
 * «6 pistas», o «6 pistas · 2 momentos».
 *
 * Los momentos se cuentan aparte: «8 pistas» para un culto con seis canciones
 * y una oración diría que hay ocho canciones.
 */
export function resumenDeOrden(ids: readonly string[]): string {
  const momentos = ids.filter(esMomento).length;
  const pistas = ids.length - momentos;
  const texto = `${pistas} ${pistas === 1 ? "pista" : "pistas"}`;
  return momentos === 0 ? texto : `${texto} · ${momentos} ${momentos === 1 ? "momento" : "momentos"}`;
}
