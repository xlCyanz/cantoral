import type { Track } from "./types";
import { motivoNoProyectable } from "./formatos";
import { estrofasDe } from "./estrofas";
import type { Estrofa } from "./estrofas";
import { assetUrl, type SalidaProyeccion, type VistaProyeccion } from "./api";
import type { CantoralState } from "../store/tipos";
import { momentosPorId, pistasPorId } from "../store/selectores";
import { recordar } from "./memo";
import { elementosDe } from "./momentos";
import type { Elemento } from "./momentos";

// Qué se manda al proyector, decidido sin tocar el estado.
//
// Vivían al principio de store.ts, mezcladas con las acciones que las usan.
// Son funciones puras sobre una instantánea del estado: la línea entre la
// regla (qué se proyecta) y el efecto (mandarlo, avisar, reintentar) queda
// aquí a la vista (#134). El slice `store/proyeccion.ts` es el que las llama.

/**
 * La URL `asset://` de una pista, o cadena vacía si no hay nada que proyectar.
 *
 * Una sola función para las dos cosas que necesitan coincidir: lo que se manda
 * a la salida y lo que se compara cuando la salida contesta. Si fueran dos,
 * cualquier diferencia entre ellas tiraría los informes de progreso a la
 * basura sin que se notara.
 */
export function rutaProyectable(t: Track | undefined): string {
  if (!t || motivoNoProyectable(t)) return "";
  return assetUrl(t.path!);
}

/** La ruta de un elemento del culto. Un momento no tiene archivo que proyectar. */
export function rutaDeElemento(e: Elemento | undefined): string {
  return e?.clase === "pista" ? rutaProyectable(e.pista) : "";
}

/**
 * Lo que se está proyectando, en su orden: pistas y momentos (#145).
 *
 * `elementosDeLista` mira la lista *abierta*; esta mira la que está en el aire,
 * que no tienen por qué ser la misma.
 */
export const filasProyectadas = recordar(
  (s: CantoralState): Elemento[] =>
    elementosDe(s.plOrder[s.proyeccionLista] || [], pistasPorId(s.tracks), momentosPorId(s.playlists)),
  (s: CantoralState) => [s.proyeccionLista, s.plOrder[s.proyeccionLista], s.tracks, s.playlists],
);

/**
 * Lo que hay que ir cargando en silencio estando en `idx`: la siguiente pista.
 *
 * Por encima de un momento: mientras dura la oración se va cargando la canción
 * de después, que es la que tiene que arrancar sin parpadeo al pulsar
 * «Siguiente».
 */
export function precargaDe(s: CantoralState, idx: number): string | undefined {
  const filas = filasProyectadas(s);
  let i = idx + 1;
  while (filas[i]?.clase === "momento") i++;
  return rutaDeElemento(filas[i]) || undefined;
}

/**
 * El mensaje para la salida con el elemento `idx` del culto abierto.
 *
 * Una pista sin archivo reproducible sale como su título sobre el negro, no
 * como un negro a secas: por el proyector se canta esa canción igual, y una
 * pantalla vacía no dice nada. El motivo se queda en la ventana de mandos —a
 * la congregación no le importa que falte un archivo.
 */
export function salidaDelCulto(s: CantoralState, idx: number, reproduciendo: boolean): SalidaProyeccion {
  const e = filasProyectadas(s)[idx];
  const precarga = precargaDe(s, idx);
  if (!e) return { vista: { modo: "negro" }, precarga };
  // Un momento sin música sale como su título sobre negro (#145). No hay
  // archivo, así que la salida nunca avisa de que se terminó: la cola se queda
  // aquí hasta que alguien pulse «Siguiente», que es justo lo que se quiere
  // mientras alguien ora o lee.
  if (e.clase === "momento") {
    return { vista: { modo: "titulo", titulo: e.momento.titulo, sub: e.momento.texto || undefined }, precarga };
  }
  const t = e.pista;
  const src = rutaProyectable(t);
  if (!src) return { vista: { modo: "titulo", titulo: t.titulo, sub: t.artista || undefined }, precarga };
  return {
    vista: {
      modo: "media",
      src,
      video: !!t.video,
      titulo: t.titulo,
      sub: t.artista || undefined,
      reproduciendo,
      // Un video ya llena la pantalla; lo de abajo es para el audio, que por
      // sí solo no pone nada delante de la congregación.
      ...(t.video ? {} : { audio: fondoDeAudio(s, t) }),
    },
    precarga,
  };
}

/** Lo que se dibuja mientras suena una pista sin imagen. */
export function fondoDeAudio(s: CantoralState, t: Track): NonNullable<Extract<VistaProyeccion, { modo: "media" }>["audio"]> {
  const tipo = s.salidaDeAudio;
  if (tipo === "negro") return { tipo };
  const trozos = estrofasDeLaPista(s, t.id);
  const actual = trozos[Math.min(s.proyeccionEstrofa, Math.max(0, trozos.length - 1))];
  return {
    tipo,
    etiqueta: actual?.etiqueta || undefined,
    lineas: actual?.lineas,
    // La carátula ya viene como `asset://` del catálogo.
    portada: tipo === "portada" ? t.cover : undefined,
  };
}

/**
 * La letra de una pista, partida en estrofas.
 *
 * Recordada porque la mira cada mensaje que sale a la salida —y sale uno por
 * cada cambio de ajuste, de estrofa y de elemento—, y volver a leer la hoja
 * entera cada vez no hace falta.
 */
export const estrofasDeLaPista = recordar(
  (s: CantoralState, id: string): Estrofa[] => {
    const hoja = s.sheets[id];
    return estrofasDe(hoja?.letra, hoja?.acordes);
  },
  (s: CantoralState, id: string) => [s.sheets[id], id],
);

/** Cuántas estrofas tiene lo que está en pantalla, o 0 si no se proyecta letra. */
export function estrofasEnPantalla(s: CantoralState): Estrofa[] {
  if (s.salidaDeAudio === "negro" || s.proyeccionIdx < 0) return VACIO_ESTROFAS;
  const e = filasProyectadas(s)[s.proyeccionIdx];
  if (e?.clase !== "pista" || e.pista.video) return VACIO_ESTROFAS;
  return estrofasDeLaPista(s, e.pista.id);
}

const VACIO_ESTROFAS: Estrofa[] = [];

// ---------------------------------------------------------------- un video suelto

/**
 * El mensaje para la salida con una pista que se puso a sonar desde el
 * reproductor —la biblioteca, una lista, «Reproducir todo»—, no desde la cola
 * del culto. Sin precarga ni transición: no hay un orden preparado que
 * adelantar, y medio segundo de negro al darle al play sería un parpadeo.
 */
export function salidaDePista(t: Track, reproduciendo: boolean): SalidaProyeccion {
  const src = rutaProyectable(t);
  if (!src) return { vista: { modo: "negro" } };
  return { vista: { modo: "media", src, video: !!t.video, titulo: t.titulo, sub: t.artista || undefined, reproduciendo } };
}

/**
 * La pista del culto que está en el aire, si la hay y se puede reproducir.
 *
 * Nada si la salida está en negro, si lo que hay es un momento sin música o
 * si la salida la ocupa un video puesto desde el reproductor.
 */
export function pistaEnElAire(s: CantoralState): Track | undefined {
  if (!s.proyectando || s.proyeccionPista || s.proyeccionEnNegro || s.proyeccionIdx < 0) return undefined;
  const e = filasProyectadas(s)[s.proyeccionIdx];
  return e?.clase === "pista" && rutaProyectable(e.pista) ? e.pista : undefined;
}

/**
 * De qué habla la barra del reproductor.
 *
 * - `pista`: el video que puso el reproductor está saliendo por el proyector.
 *   La barra es la de siempre, pero lo que suena lo suena la salida.
 * - `culto`: lo que suena es una pista del culto en el aire. La barra la
 *   enseña y sus botones mandan sobre la salida. Solo con el reproductor
 *   parado: si alguien pone algo a sonar en el portátil, la barra es suya.
 * - `local`: el `<audio>` de la barra o el video del panel.
 */
export type ModoDeLaBarra = "local" | "pista" | "culto";

export function modoDeLaBarra(s: CantoralState): ModoDeLaBarra {
  if (s.proyeccionPista && s.proyeccionPista === s.playerId) return "pista";
  if (!s.playing && pistaEnElAire(s)) return "culto";
  return "local";
}
