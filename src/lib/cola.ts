// Qué suena después, y qué antes (pedido de la iglesia).
//
// Una canción no vuelve a sonar sin que se haya pedido. Sin «Repetir», la cola
// se acaba en la última; en aleatorio, cada canción suena una vez antes de que
// pueda volver a salir. «Repetir la lista» vuelve a empezar —en aleatorio, con
// otro orden—, y «Repetir la canción» la vuelve a poner cuando se acaba.

/** Los tres modos del botón de repetir, en el orden en que se recorren. */
export type ModoRepetir = "no" | "lista" | "una";
export const MODOS_REPETIR: readonly ModoRepetir[] = ["no", "lista", "una"];

/** El siguiente modo al pulsar el botón. */
export function siguienteModo(m: ModoRepetir): ModoRepetir {
  return MODOS_REPETIR[(MODOS_REPETIR.indexOf(m) + 1) % MODOS_REPETIR.length];
}

/** Cómo se dice cada modo, para el botón y los lectores de pantalla. */
export const NOMBRE_REPETIR: Record<ModoRepetir, string> = {
  no: "Repetir: no",
  lista: "Repetir la lista",
  una: "Repetir la canción",
};

export interface Paso {
  /** La que suena después, o `null` si la cola se acabó. */
  id: string | null;
  /** Las que ya sonaron en esta vuelta aleatoria (incluida la nueva). */
  sonadas: string[];
}

/**
 * La siguiente de la cola.
 *
 * `sonadas` son las que ya sonaron en esta vuelta en aleatorio; fuera de
 * aleatorio no se usan. `azar` es inyectable para las pruebas.
 */
export function siguiente(
  ids: readonly string[],
  actual: string,
  opciones: { aleatorio: boolean; repetir: ModoRepetir; sonadas: readonly string[] },
  azar: () => number = Math.random,
): Paso {
  if (ids.length === 0) return { id: null, sonadas: [] };
  const { aleatorio, repetir } = opciones;

  if (aleatorio) {
    const vistas = new Set([...opciones.sonadas, actual]);
    let quedan = ids.filter((id) => !vistas.has(id));
    let vuelta = [...vistas];
    if (quedan.length === 0) {
      // Ya sonaron todas. Solo vuelve a empezar quien pidió repetir la lista,
      // y nunca con la que acaba de sonar.
      if (repetir !== "lista") return { id: null, sonadas: [...vistas] };
      quedan = ids.filter((id) => id !== actual);
      if (quedan.length === 0) quedan = [...ids];
      vuelta = [];
    }
    const id = quedan[Math.floor(azar() * quedan.length)];
    return { id, sonadas: [...vuelta, id] };
  }

  const i = ids.indexOf(actual);
  if (i < 0) return { id: ids[0], sonadas: [] };
  if (i + 1 < ids.length) return { id: ids[i + 1], sonadas: [] };
  return { id: repetir === "lista" ? ids[0] : null, sonadas: [] };
}

/**
 * La anterior. Sin «Repetir la lista», en la primera no da la vuelta: se
 * queda en ella (y se vuelve a empezar).
 */
export function anterior(ids: readonly string[], actual: string, repetir: ModoRepetir): string | null {
  if (ids.length === 0) return null;
  const i = ids.indexOf(actual);
  if (i > 0) return ids[i - 1];
  if (i === 0) return repetir === "lista" ? ids[ids.length - 1] : actual;
  return ids[0];
}
