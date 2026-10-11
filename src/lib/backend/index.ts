// Cuál de los dos backends corre.
//
// El único sitio de la app que pregunta si está dentro de Tauri para decidir
// qué hacer con los datos. El store no lo pregunta: llama a `backend()` y
// aplica lo que le contesta (#135).

import { isTauri } from "../api";
import { tauri } from "./tauri";
import type { Backend } from "./tipos";

export type { Backend } from "./tipos";
export { NoDisponible } from "./tipos";

let actual: Backend | null = null;

/**
 * Cómo se crea el backend del navegador, una vez cargado.
 *
 * No se importa aquí: la base en memoria y los datos de ejemplo solo sirven
 * con `pnpm dev`, y la app de escritorio los llevaba igual en su paquete
 * principal. Se cargan aparte con `cargarNavegador`: `main.tsx` lo hace fuera
 * de Tauri antes de pintar nada, y las pruebas en su preparación.
 */
let crearNavegador: (() => Backend) | null = null;

/** Cargar la base en memoria del navegador, para que `backend()` la pueda dar. */
export async function cargarNavegador(): Promise<void> {
  crearNavegador ??= (await import("./memoria")).crearMemoria;
}

/**
 * El backend de este entorno.
 *
 * Se decide la primera vez que se pide y no al cargar el módulo: Tauri inyecta
 * sus globales antes de que corra nada de la app, pero una prueba decide si
 * simula Tauri al preparar sus mocks, y tiene que poder hacerlo antes.
 */
export function backend(): Backend {
  if (actual) return actual;
  if (isTauri()) return (actual = tauri);
  if (!crearNavegador) throw new Error("Falta cargar el backend del navegador: ver cargarNavegador()");
  return (actual = crearNavegador());
}

/** Para las pruebas: un backend concreto, o `null` para volver a elegirlo. */
export function usarBackend(b: Backend | null) {
  actual = b;
}
