// La lista temporal (#230): lo que va a sonar, armado sobre la marcha.
//
// No es un culto: no tiene nombre, no se guarda en la base de datos y no hace
// falta crearla. Se le van soltando canciones y suenan una detrás de otra.
// Se recuerda entre sesiones con las preferencias hasta que alguien la vacía,
// porque armarla y perderla al cerrar la app sin querer es peor que tener que
// darle a «Vaciar».
//
// Aquí solo las reglas del orden, puras, para probarlas sin el store.

/**
 * Añade `ids` al final, sin repetir las que ya están.
 *
 * Una canción no suena dos veces sin pedirlo (ver `cola.ts`), así que tampoco
 * se pone dos veces en la lista. `agregadas` cuenta las que entraron de verdad,
 * para poder decir «ya estaba» en vez de «0 agregadas».
 */
export function agregarAlFinal(lista: readonly string[], ids: readonly string[]): { lista: string[]; agregadas: number } {
  const hay = new Set(lista);
  const nuevas: string[] = [];
  for (const id of ids) {
    if (hay.has(id)) continue;
    hay.add(id);
    nuevas.push(id);
  }
  return { lista: [...lista, ...nuevas], agregadas: nuevas.length };
}

/**
 * Mueve `id` `delta` posiciones. En los extremos no da la vuelta: devuelve
 * `null`, igual que una pista que no está.
 */
export function moverEn(lista: readonly string[], id: string, delta: number): string[] | null {
  const desde = lista.indexOf(id);
  const hasta = desde + delta;
  if (desde < 0 || hasta < 0 || hasta >= lista.length || delta === 0) return null;
  const nueva = lista.slice();
  nueva.splice(desde, 1);
  nueva.splice(hasta, 0, id);
  return nueva;
}

/** Pone `desde` donde está `hasta`, como al soltar un arrastre sobre otra fila. */
export function llevarA(lista: readonly string[], desde: string, hasta: string): string[] | null {
  if (desde === hasta) return null;
  const de = lista.indexOf(desde);
  const a = lista.indexOf(hasta);
  if (de < 0 || a < 0) return null;
  const nueva = lista.slice();
  nueva.splice(de, 1);
  nueva.splice(a, 0, desde);
  return nueva;
}

/** Lo que se recordó, si se puede leer como lista temporal. */
export function esListaTemporal(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}
