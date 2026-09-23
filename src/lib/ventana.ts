// Cuánto sitio queda, para lo poco que de verdad depende de ello.
//
// El rediseño encoge dos cosas cuando la ventana se queda corta: el panel de
// detalle y las columnas de la biblioteca. No es un diseño «responsive» al uso
// —esta app vive en una ventana de escritorio, no en un teléfono—, sino una
// sola decisión: con el panel abierto en una pantalla de portátil, la tabla se
// queda sin sitio y hay que devolvérselo.

import { useEffect, useState } from "react";

/** Por debajo de esto, lo que quede para la tabla es poco. */
const CORTE = 1000;

/**
 * Si el espacio que queda para el contenido se ha quedado corto.
 *
 * `reservado` es lo que se lleva algo que no es el contenido —el panel de
 * detalle—, y se descuenta antes de comparar: la ventana puede ser ancha y el
 * hueco estrecho igualmente.
 */
export function useEstrecho(reservado = 0): boolean {
  const [ancho, setAncho] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));

  useEffect(() => {
    const medir = () => setAncho(window.innerWidth);
    window.addEventListener("resize", medir);
    // Y una vez al montar: entre el primer render y este efecto la ventana
    // puede haber cambiado, y en el primer render del arranque `innerWidth`
    // todavía puede ser la de antes de colocarla.
    medir();
    return () => window.removeEventListener("resize", medir);
  }, []);

  return ancho - reservado < CORTE;
}
