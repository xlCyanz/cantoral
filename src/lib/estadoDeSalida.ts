// Cuándo la ventana de salida le cuenta a la principal por dónde va.
//
// El `<video>` avisa con `timeupdate` unas cuatro veces por segundo, y cada
// aviso era un evento entre ventanas que la principal tenía que recibir,
// deserializar y comparar. Pero quien opera solo ve segundos enteros: lo que
// cambia algo es el segundo, la duración, el archivo, o que termine, falle,
// se pause o arranque.

import type { EstadoProyeccion } from "./api";

/**
 * Si `nuevo` dice algo que `anterior` no dijo ya.
 *
 * `forzar` es para lo que se manda siempre aunque el número no cambie: el
 * final, un fallo, la pausa y el arranque, y los metadatos recién cargados.
 */
export function hayQueReportar(
  anterior: EstadoProyeccion | null,
  nuevo: EstadoProyeccion,
  forzar = false,
): boolean {
  if (forzar || nuevo.fin || nuevo.error !== undefined || !anterior) return true;
  return anterior.src !== nuevo.src || anterior.pos !== nuevo.pos || anterior.dur !== nuevo.dur;
}
