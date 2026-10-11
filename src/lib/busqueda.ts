// Mover la barra de progreso mientras manda sobre el proyector.
//
// Con lo que suena en el portátil, mover la barra salta en el `<audio>` en el
// acto, y está bien que lo haga en cada píxel. Con lo que sale por el
// proyector cada salto es un mensaje a otra ventana que tiene que buscar en
// el archivo y volver a decodificar: arrastrar la barra mandaba decenas por
// segundo, y la salida se atascaba buscando posiciones que ya no importaban
// mientras la congregación veía el video a saltos. Aquí la barra se mueve en
// el portátil mientras se arrastra, y a la salida solo llega dónde se soltó.

/** Lo mínimo entre dos saltos mandados con las flechas. */
export const INTERVALO_MS = 200;

export interface Reloj {
  ahora: () => number;
  programar: (fn: () => void, ms: number) => unknown;
  cancelar: (id: unknown) => void;
}

const relojReal: Reloj = {
  ahora: () => performance.now(),
  programar: (fn, ms) => setTimeout(fn, ms),
  cancelar: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/**
 * Junta los saltos de la barra y manda a `mandar` solo los que hacen falta.
 *
 * - `arrastrar`: con el ratón. No manda nada; se apunta adónde va.
 * - `tecla`: con las flechas. Manda como mucho uno cada `INTERVALO_MS`, y el
 *   último siempre llega.
 * - `soltar`: al soltar el ratón o la tecla. Manda lo apuntado, si queda algo.
 */
export function crearBusquedaDiferida(mandar: (f: number) => void, reloj: Reloj = relojReal) {
  let pendiente: number | null = null;
  let ultimo = -Infinity;
  let temporizador: unknown = null;

  const enviar = () => {
    if (temporizador !== null) reloj.cancelar(temporizador);
    temporizador = null;
    if (pendiente === null) return;
    const f = pendiente;
    pendiente = null;
    ultimo = reloj.ahora();
    mandar(f);
  };

  return {
    arrastrar(f: number) {
      pendiente = f;
    },
    tecla(f: number) {
      pendiente = f;
      const falta = ultimo + INTERVALO_MS - reloj.ahora();
      if (falta <= 0) enviar();
      else if (temporizador === null) temporizador = reloj.programar(enviar, falta);
    },
    soltar: enviar,
  };
}
