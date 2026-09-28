import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ProjectionOutput from "./components/ProjectionOutput";
import { registrar } from "./lib/api";
import "./styles/global.css";

/**
 * La ventana de salida carga el mismo paquete con `?salida` y se queda solo
 * con la pantalla de proyección.
 *
 * Aquí y no dentro de `App` porque lo que hay que evitar es precisamente que
 * `App` se monte: trae el reloj del reproductor, los atajos de teclado, la
 * carga del catálogo y los diálogos. Nada de eso tiene sentido en una pantalla
 * que cuelga delante de una congregación, y el reloj además correría dos
 * veces.
 */
const esSalida = new URLSearchParams(window.location.search).has("salida");

// Lo que se rompe sin que nadie lo recoja —un error suelto, una promesa
// rechazada que se lanzó con `void`, o el propio arrastre de la barra, que
// Tauri pide por su cuenta— acaba en el log en vez de en una consola que en
// una PC de iglesia nadie abre.
const ventana = esSalida ? "salida" : "main";
window.addEventListener("error", (e) => {
  registrar("error", `[${ventana}] uncaught: ${e.message} (${e.filename}:${e.lineno})`);
});
window.addEventListener("unhandledrejection", (e) => {
  registrar("error", `[${ventana}] unhandled rejection: ${String(e.reason)}`);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{esSalida ? <ProjectionOutput /> : <App />}</React.StrictMode>,
);
