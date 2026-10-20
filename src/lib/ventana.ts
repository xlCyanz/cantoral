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
  // El sí o el no, no el ancho: arrastrar el borde de la ventana manda un
  // `resize` por fotograma, y guardando los píxeles cada uno volvía a pintar
  // la tabla y el panel aunque la respuesta no cambiara.
  const [estrecho, setEstrecho] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth) - reservado < CORTE);

  useEffect(() => {
    const medir = () => setEstrecho(window.innerWidth - reservado < CORTE);
    window.addEventListener("resize", medir);
    // Y una vez al montar: entre el primer render y este efecto la ventana
    // puede haber cambiado, y en el primer render del arranque `innerWidth`
    // todavía puede ser la de antes de colocarla.
    medir();
    return () => window.removeEventListener("resize", medir);
  }, [reservado]);

  return estrecho;
}

// ---------------------------------------------------------------- maximizar

/**
 * Si un cambio de «maximizada» se anima.
 *
 * En Windows la barra de título es nuestra (`decorations: false`). tao ya deja
 * a la ventana los estilos de una ventana con marco (`WS_CAPTION`,
 * `WS_THICKFRAME`) y esconde el marco con `WM_NCCALCSIZE`, así que lo nativo
 * está hecho; aun así, al maximizar desde nuestros botones o con el doble clic
 * el contenido salta de golpe al tamaño nuevo. Aquí el contenido se asienta
 * en un momento, sea cual sea el camino —botón, doble clic, Win + ↑ o
 * arrastrar la ventana arriba—, porque lo que se mira es el estado y no quién
 * lo cambió.
 *
 * En macOS no: los semáforos son los del sistema, y el zoom ya se anima.
 * Tampoco la primera vez que se sabe el estado, que no es un cambio.
 */
export function animaAlMaximizar(previo: boolean | null, ahora: boolean, mac: boolean): boolean {
  return !mac && previo !== null && previo !== ahora;
}

/** La clase que hace la animación (ver `global.css`). */
export const CLASE_ASENTANDO = "ventana-asentando";
/** Lo que dura, con margen: se quita a mano porque sin animación no hay `animationend`. */
const DURACION_MS = 260;

/**
 * Asentar el contenido de la ventana: un instante de escala y opacidad que
 * termina en su sitio.
 *
 * Sobre `#root` y solo mientras dura: un `transform` en un antepasado cambia
 * contra qué se colocan los `position: fixed` —diálogos, menú, avisos—, y
 * dejarlo puesto los descolocaría. Como `#root` ocupa toda la ventana, durante
 * esos milisegundos quedan igual. Con «reducir movimiento» la regla de CSS no
 * anima nada.
 */
export function asentarLaVentana(raiz: HTMLElement | null = typeof document === "undefined" ? null : document.getElementById("root")): void {
  if (!raiz) return;
  // Quitar y volver a poner, para que un segundo cambio seguido vuelva a
  // empezar en vez de quedarse a medias.
  raiz.classList.remove(CLASE_ASENTANDO);
  void raiz.offsetWidth;
  raiz.classList.add(CLASE_ASENTANDO);
  if (quitarAsentado) clearTimeout(quitarAsentado);
  quitarAsentado = setTimeout(() => {
    raiz.classList.remove(CLASE_ASENTANDO);
    quitarAsentado = null;
  }, DURACION_MS);
}
let quitarAsentado: ReturnType<typeof setTimeout> | null = null;
