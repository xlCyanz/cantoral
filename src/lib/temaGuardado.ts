// El tema con el que se pintó la última vez, para el primer dibujo.
//
// El tema elegido vive en la base, y la base se lee cuando la ventana ya está
// pintada: quien usa el tema oscuro veía un destello claro al abrir la app,
// y en Windows más, porque el webview contesta «claro» a `matchMedia` aunque
// el sistema esté en oscuro. Aquí se guarda el tema ya resuelto, en el
// almacenamiento del webview, y `main.tsx` lo pone antes de pintar nada.
//
// Es solo una pista para el primer dibujo: la verdad sigue en la base, y en
// cuanto llega se aplica encima. Si el almacenamiento no está —bloqueado,
// lleno, un navegador en privado— no pasa nada: se pinta como antes.

import type { Theme } from "./types";

export const CLAVE_TEMA = "cantoral.tema";

/** El tema del último dibujo, o `null` si no hay o no se puede leer. */
export function leerTemaGuardado(): Theme | null {
  try {
    const t = globalThis.localStorage?.getItem(CLAVE_TEMA);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

/** Apuntar el tema con el que se está pintando, para la próxima vez. */
export function guardarTema(t: Theme): void {
  try {
    globalThis.localStorage?.setItem(CLAVE_TEMA, t);
  } catch {
    // Sin almacenamiento, la próxima vez se pinta como siempre.
  }
}

/** Poner en el documento el tema guardado, antes del primer dibujo. */
export function aplicarTemaGuardado(): void {
  const t = leerTemaGuardado();
  if (t) document.documentElement.setAttribute("data-theme", t);
}
