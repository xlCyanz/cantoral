import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { isTauri, registrar } from "./lib/api";
import { cargarNavegador } from "./lib/backend";
import { aplicarTemaGuardado } from "./lib/temaGuardado";
import "./styles/global.css";

// El tema antes del primer dibujo, para no pintar claro a quien lo usa oscuro
// mientras se leen los ajustes.
aplicarTemaGuardado();

// La ventana de salida tiene su propia página, `salida.html` (ver
// `salida.tsx`): esta es solo la principal.

// Lo que se rompe sin que nadie lo recoja —un error suelto, una promesa
// rechazada que se lanzó con `void`, o el propio arrastre de la barra, que
// Tauri pide por su cuenta— acaba en el log en vez de en una consola que en
// una PC de iglesia nadie abre.
window.addEventListener("error", (e) => {
  registrar("error", `[main] uncaught: ${e.message} (${e.filename}:${e.lineno})`);
});
window.addEventListener("unhandledrejection", (e) => {
  registrar("error", `[main] unhandled rejection: ${String(e.reason)}`);
});

async function arrancar() {
  // Fuera de Tauri —`pnpm dev`— la app corre sobre los datos de ejemplo, que
  // van en un trozo aparte para no pesar en la de escritorio.
  if (!isTauri()) await cargarNavegador();
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
void arrancar();
