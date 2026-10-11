// Lo mínimo para hablar con el núcleo desde cualquier ventana.
//
// Aparte de `api.ts` para que la ventana de salida del proyector, que solo
// necesita esto, no cargue con todo lo demás: los diálogos, el abridor de
// archivos y cada comando de la biblioteca. `api.ts` lo vuelve a exportar,
// así que el resto de la app lo sigue pidiendo allí.

import { invoke } from "@tauri-apps/api/core";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Una línea en el log de la app, que es lo que se pide cuando algo falla en
 * otra PC. Nunca falla ni se espera: un diagnóstico no puede ser la causa de
 * otro problema.
 */
export function registrar(nivel: "info" | "warn" | "error", mensaje: string): void {
  if (!isTauri()) return;
  void invoke<void>("registrar", { nivel, mensaje }).catch(() => {});
}
