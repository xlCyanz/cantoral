import type { Track } from "./types";
import { motivoNoProyectable } from "./formatos";
import { assetUrl, type SalidaProyeccion } from "./api";
import type { CantoralState } from "../store/tipos";

// Qué se manda al proyector, decidido sin tocar el estado.
//
// Funciones puras sobre una instantánea del estado: la línea entre la regla
// (qué se proyecta) y el efecto (mandarlo, avisar, reintentar) queda aquí a la
// vista (#134). El slice `store/proyeccion.ts` es el que las llama.
//
// Ya no hay un culto que proyectar aparte: todo sale del reproductor. El
// proyector enseña el video que suena en la barra, y con cualquier otra cosa
// se queda en negro.

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
 * El mensaje para la salida con el video que suena en el reproductor.
 *
 * Sin precarga ni transición: lo que viene después lo decide la cola del
 * reproductor, y medio segundo de negro al darle al play sería un parpadeo.
 */
export function salidaDePista(t: Track, reproduciendo: boolean): SalidaProyeccion {
  const src = rutaProyectable(t);
  if (!src) return { vista: { modo: "negro" } };
  return { vista: { modo: "media", src, titulo: t.titulo, sub: t.artista || undefined, reproduciendo } };
}

/**
 * Si lo que suena en la barra sale por el proyector.
 *
 * La barra es la misma en los dos casos —play, pausa, saltar, volumen—; esto
 * solo cambia quién lo reproduce: la ventana de salida en vez del `<audio>` o
 * del panel de detalle.
 */
export function enElProyector(s: CantoralState): boolean {
  return !!s.proyeccionPista && s.proyeccionPista === s.playerId;
}
