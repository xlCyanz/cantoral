// Elegir varias canciones de la biblioteca para un culto, desde el culto.
//
// Las reglas del diálogo «Agregar canciones» fuera de React: qué se ve al
// buscar, qué hace un clic con o sin Mayúsculas y a dónde van las flechas.
// Así se pueden probar sin DOM, y el componente solo las pinta.

import type { Track } from "./types";
import { coincideEnCampos, sinTildes } from "./buscarLetra";

/** Alto de cada fila, pinchado como en la tabla: la ventana se calcula sin medir el DOM. */
export const ALTO_FILA = 50;
/** Alto de la lista. Fijo, para que el diálogo no salte de tamaño a cada tecla. */
export const ALTO_LISTA = 360;

/**
 * Las canciones que muestra el diálogo para lo escrito, por título.
 *
 * Toda la biblioteca, sin los filtros que tenga puestos la tabla: quien arma
 * un culto busca en todo lo que hay, no en lo último que estuvo mirando. La
 * coincidencia es la misma que la de la biblioteca —título, artista, álbum,
 * ocasión, sin tildes—; la letra no entra, porque eso es una pregunta al
 * núcleo y aquí se filtra a cada tecla.
 */
export function buscarCanciones(tracks: readonly Track[], consulta: string): Track[] {
  const q = sinTildes(consulta.trim());
  const halladas = q ? tracks.filter((t) => coincideEnCampos(t, q)) : tracks.slice();
  return halladas.sort((a, b) => a.titulo.localeCompare(b.titulo, "es") || a.artista.localeCompare(b.artista, "es"));
}

/**
 * Marcar o desmarcar una canción.
 *
 * Las elegidas guardan el orden en que se marcaron, que es el orden en que
 * entran al culto: quien arma la lista suele ir marcando en el orden en que
 * se van a cantar.
 */
export function alternar(elegidas: readonly string[], id: string): string[] {
  return elegidas.includes(id) ? elegidas.filter((x) => x !== id) : [...elegidas, id];
}

/**
 * Mayúsculas + clic: lo que hay entre la última marcada y esta, en el orden
 * que se ve, toma el estado de la que se pulsó.
 *
 * `marcar` es cómo queda la pulsada; las que ya están en el culto no se tocan.
 * Las que se agregan van detrás de las que ya estaban elegidas, en el orden de
 * la lista.
 */
export function marcarRango(
  visibles: readonly string[],
  elegidas: readonly string[],
  desde: string,
  hasta: string,
  marcar: boolean,
  yaEstan: ReadonlySet<string>,
): string[] {
  const a = visibles.indexOf(desde);
  const b = visibles.indexOf(hasta);
  // Sin un punto de partida a la vista, es un clic normal.
  if (a < 0 || b < 0) {
    if (yaEstan.has(hasta)) return elegidas.slice();
    const dentro = elegidas.includes(hasta);
    return marcar === dentro ? elegidas.slice() : alternar(elegidas, hasta);
  }
  const [ini, fin] = a <= b ? [a, b] : [b, a];
  const tramo = visibles.slice(ini, fin + 1).filter((id) => !yaEstan.has(id));
  if (!marcar) {
    const fuera = new Set(tramo);
    return elegidas.filter((id) => !fuera.has(id));
  }
  const hay = new Set(elegidas);
  return [...elegidas, ...tramo.filter((id) => !hay.has(id))];
}

/**
 * La siguiente fila a la que se puede ir con las flechas, o `null` si no hay.
 *
 * Se saltan las que ya están en el culto: su casilla está deshabilitada, no
 * toma el foco, y pararse en ella no serviría de nada.
 */
export function siguienteElegible(
  visibles: readonly string[],
  desde: number,
  paso: 1 | -1,
  yaEstan: ReadonlySet<string>,
): number | null {
  for (let i = desde + paso; i >= 0 && i < visibles.length; i += paso) {
    if (!yaEstan.has(visibles[i])) return i;
  }
  return null;
}

/** El texto del botón que confirma, con cuántas van. */
export function textoDeAgregar(n: number): string {
  if (n === 0) return "Agregar canciones";
  return n === 1 ? "Agregar 1 canción" : `Agregar ${n} canciones`;
}
