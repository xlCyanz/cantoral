// Juntar en una sola escritura lo que llega de las colas de fondo.
//
// Las colas de miniaturas y de duraciones terminan un video cada poco, y cada
// resultado reescribía el catálogo entero (`tracks.map`): una lista nueva que
// despierta a todos los suscriptores del store y vuelve a pintar la
// biblioteca, una vez por video. Con cientos de videos eso es la biblioteca
// repintándose sin parar durante minutos. Aquí los resultados se acumulan y se
// escriben juntos, como mucho una vez cada `LOTE_MS`.

import { useStore } from "../store";
import type { Track } from "./types";

/** Cada cuánto, como mucho, se escribe lo acumulado. */
export const LOTE_MS = 1500;

/** La clave con la que se apunta un resultado: la pista y la ruta que se leyó. */
export const claveDe = (id: string, path: string) => `${id}\0${path}`;

/**
 * Acumula resultados por clave y los entrega todos juntos.
 *
 * El primero que llega programa la entrega; los que llegan antes de que se
 * cumpla se suman a ella. Uno repetido se queda con el último valor.
 */
export function crearLote<T>(
  entregar: (lote: ReadonlyMap<string, T>) => void,
  esperaMs = LOTE_MS,
  programar: (fn: () => void, ms: number) => unknown = setTimeout,
) {
  let pendientes = new Map<string, T>();
  let programado = false;

  const vaciar = () => {
    programado = false;
    if (!pendientes.size) return;
    const lote = pendientes;
    pendientes = new Map();
    entregar(lote);
  };

  return {
    poner(clave: string, valor: T) {
      pendientes.set(clave, valor);
      if (programado) return;
      programado = true;
      programar(vaciar, esperaMs);
    },
    /** Entrega ya lo que haya, sin esperar. */
    vaciar,
  };
}

/**
 * Un lote que, al entregarse, cambia las pistas afectadas con un solo
 * `tracks.map`.
 *
 * Solo cambia la pista que sigue teniendo la ruta que se leyó: si se reapuntó
 * mientras tanto, el resultado es de otro archivo y se descarta. Si no queda
 * ninguna a la que aplicarlo, no se escribe nada.
 */
export function loteDePistas<T>(cambiar: (t: Track, valor: T) => Track, esperaMs = LOTE_MS) {
  return crearLote<T>((lote) => {
    useStore.setState((s) => {
      let alguna = false;
      const tracks = s.tracks.map((t) => {
        if (!t.path) return t;
        const valor = lote.get(claveDe(t.id, t.path));
        if (valor === undefined) return t;
        alguna = true;
        return cambiar(t, valor);
      });
      return alguna ? { tracks } : s;
    });
  }, esperaMs);
}
