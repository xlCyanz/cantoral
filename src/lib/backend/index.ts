// Cuál de los dos backends corre.
//
// El único sitio de la app que pregunta si está dentro de Tauri para decidir
// qué hacer con los datos. El store no lo pregunta: llama a `backend()` y
// aplica lo que le contestan (#135).

import { isTauri } from "../api";
import { crearMemoria } from "./memoria";
import { tauri } from "./tauri";
import type { Backend } from "./tipos";

export type { Backend } from "./tipos";
export { NoDisponible } from "./tipos";

let actual: Backend | null = null;

/**
 * El backend de este entorno.
 *
 * Se decide la primera vez que se pide y no al cargar el módulo: Tauri inyecta
 * sus globales antes de que corra nada de la app, pero una prueba decide si
 * simula Tauri al preparar sus mocks, y tiene que poder hacerlo antes.
 */
export function backend(): Backend {
  actual ??= isTauri() ? tauri : crearMemoria();
  return actual;
}

/** Para las pruebas: un backend concreto, o `null` para volver a elegirlo. */
export function usarBackend(b: Backend | null) {
  actual = b;
}
