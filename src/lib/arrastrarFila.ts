// Una fila que se recorre con el ratón, sin barra de desplazamiento.
//
// La fila de filtros de la biblioteca no cabe entera en cuanto una iglesia
// tiene seis ocasiones y diez etiquetas. La barra horizontal que aparecía
// debajo se comía tres píxeles de la fila, tapaba el borde de los chips y en
// Windows sale siempre —no se esconde sola como en macOS—, así que se veía una
// barra gris permanente cruzando la interfaz.
//
// Se quita y se deja recorrer de las dos maneras que alguien intenta por su
// cuenta: girando la rueda encima, y arrastrando.

import { useEffect } from "react";
import type { RefObject } from "react";

/** Lo que hay que mover el ratón para que cuente como arrastre y no como clic. */
const UMBRAL = 4;

/**
 * Deja recorrer una fila con la rueda y arrastrándola.
 *
 * El arrastre no puede comerse los clics: la fila está hecha de botones, y si
 * soltar contara siempre como arrastre no se podría filtrar por nada. Hasta
 * que el ratón no se mueve `UMBRAL` píxeles esto no hace nada, y el clic llega
 * al botón como siempre.
 */
export function useArrastrarFila(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // La rueda de un ratón normal solo da desplazamiento vertical, y encima de
    // una fila horizontal eso no hace nada. Un trackpad sí manda el eje X, y
    // ese se respeta tal cual.
    const alGirar = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      // Sin nada que recorrer, la rueda es de quien esté debajo.
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    let id: number | null = null;
    let desdeX = 0;
    let desdeScroll = 0;
    let arrastrando = false;

    const alPulsar = (e: PointerEvent) => {
      // Solo el botón principal: con el secundario se abre un menú.
      if (e.button !== 0 || el.scrollWidth <= el.clientWidth) return;
      id = e.pointerId;
      desdeX = e.clientX;
      desdeScroll = el.scrollLeft;
      arrastrando = false;
    };

    const alMover = (e: PointerEvent) => {
      if (id !== e.pointerId) return;
      const avance = e.clientX - desdeX;
      if (!arrastrando) {
        if (Math.abs(avance) < UMBRAL) return;
        arrastrando = true;
        // Desde aquí el puntero es de la fila: si se sale de ella mientras se
        // arrastra, los eventos siguen llegando y no se queda a medias.
        el.setPointerCapture(e.pointerId);
        el.style.cursor = "grabbing";
        // Y sin seleccionar texto por el camino.
        el.style.userSelect = "none";
      }
      el.scrollLeft = desdeScroll - avance;
    };

    const alSoltar = (e: PointerEvent) => {
      if (id !== e.pointerId) return;
      if (arrastrando) {
        // El clic que viene detrás de un arrastre no es un clic: filtraría por
        // el chip que quedara debajo del dedo al soltar.
        const tragar = (c: MouseEvent) => {
          c.stopPropagation();
          c.preventDefault();
        };
        el.addEventListener("click", tragar, { capture: true, once: true });
        // Si no hubo clic —soltar fuera de un botón—, el oyente sobraría.
        window.setTimeout(() => el.removeEventListener("click", tragar, true), 0);
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      }
      el.style.cursor = "";
      el.style.userSelect = "";
      id = null;
      arrastrando = false;
    };

    el.addEventListener("wheel", alGirar, { passive: false });
    el.addEventListener("pointerdown", alPulsar);
    el.addEventListener("pointermove", alMover);
    el.addEventListener("pointerup", alSoltar);
    el.addEventListener("pointercancel", alSoltar);
    return () => {
      el.removeEventListener("wheel", alGirar);
      el.removeEventListener("pointerdown", alPulsar);
      el.removeEventListener("pointermove", alMover);
      el.removeEventListener("pointerup", alSoltar);
      el.removeEventListener("pointercancel", alSoltar);
    };
  }, [ref]);
}
