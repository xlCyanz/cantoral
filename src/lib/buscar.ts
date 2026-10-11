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
 * Lo mismo, por el texto de origen.
 *
 * Cada instantánea del núcleo trae objetos nuevos, y una pista a la que se le
 * cambia el corazón también es un objeto nuevo: con la caché solo por objeto,
 * la primera tecla después de cualquiera de esas cosas volvía a quitar las
 * tildes de toda la biblioteca. Por el texto, un objeto nuevo que dice lo
 * mismo no cuesta nada. Con tope, para que una sesión muy larga de ediciones
 * no la haga crecer sin fin: al llegar, se vacía y se vuelve a llenar con lo
 * que se use.
 */
const porTexto = new Map<string, string>();
const TOPE_POR_TEXTO = 50_000;

/** Título, artista y álbum de la pista, sin tildes ni mayúsculas. */
function camposDe(t: Track): string {
  let campos = camposSinTildes.get(t);
  if (campos !== undefined) return campos;
  const origen = [t.titulo, t.artista, t.album].join(" ");
  campos = porTexto.get(origen);
  if (campos === undefined) {
    campos = sinTildes(origen);
    if (porTexto.size >= TOPE_POR_TEXTO) porTexto.clear();
    porTexto.set(origen, campos);
  }
  camposSinTildes.set(t, campos);
  return campos;
}

/**
 * Si lo buscado está en el título, el artista o el álbum.
 *
 * `q` llega ya pasado por `sinTildes`, una vez por búsqueda: quien escribe
 * «senor» encuentra «Señor».
 */
export function coincideEnCampos(t: Track, q: string): boolean {
  return camposDe(t).includes(q);
}

/** Cuánto trabaja cada trozo cuando no hay `requestIdleCallback`. */
const TRAMO_MS = 4;
/** Sube con cada preparación, para que una que quedó atrás se detenga. */
let turno = 0;

/**
 * Deja la búsqueda lista para la primera tecla, en los ratos libres.
 *
 * Quitar las tildes de diez mil pistas son unas decenas de milisegundos, y
 * sin esto se pagaban en la primera letra que se escribía después de abrir la
 * app. Aquí se hace a trozos, cuando la ventana no tiene nada mejor que hacer,
 * y la caché de arriba lo guarda para cuando llegue la tecla.
 */
export function prepararBusqueda(tracks: readonly Track[]): void {
  const mio = ++turno;
  let i = 0;
  const programar = (fn: (plazo?: IdleDeadline) => void) => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(fn);
    else setTimeout(fn, 0);
  };
  const tramo = (plazo?: IdleDeadline) => {
    if (mio !== turno) return;
    const fin = performance.now() + TRAMO_MS;
    while (i < tracks.length && (plazo ? plazo.timeRemaining() > 1 : performance.now() < fin)) camposDe(tracks[i++]);
    if (i < tracks.length) programar(tramo);
  };
  programar(tramo);
}
