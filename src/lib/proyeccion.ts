import type { Track } from "./types";
import { motivoNoProyectable } from "./formatos";
import { estrofasDe } from "./estrofas";
import type { Estrofa } from "./estrofas";
import { assetUrl, type SalidaProyeccion, type VistaProyeccion } from "./api";
import type { CantoralState } from "../store/tipos";
import { pistasPorId } from "../store/selectores";
import { recordar } from "./memo";

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

/**
 * Las pistas que se están proyectando, en su orden.
 *
 * `filasDeLista` mira la lista *abierta*; esta mira la que está en el aire, que
 * no tienen por qué ser la misma.
 */
export const filasProyectadas = recordar(
  (s: CantoralState): Track[] =>
    (s.plOrder[s.proyeccionLista] || [])
      .map((id) => pistasPorId(s.tracks).get(id))
      .filter((t): t is Track => !!t),
  (s: CantoralState) => [s.proyeccionLista, s.plOrder[s.proyeccionLista], s.tracks],
);

/** Lo que hay que ir cargando en silencio estando en `idx`: el siguiente. */
export function precargaDe(s: CantoralState, idx: number): string | undefined {
  return rutaProyectable(filasProyectadas(s)[idx + 1]) || undefined;
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
  const t = filasProyectadas(s)[idx];
  const precarga = precargaDe(s, idx);
  if (!t) return { vista: { modo: "negro" }, precarga };
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
  const t = filasProyectadas(s)[s.proyeccionIdx];
  if (!t || t.video) return VACIO_ESTROFAS;
  return estrofasDeLaPista(s, t.id);
}

const VACIO_ESTROFAS: Estrofa[] = [];
