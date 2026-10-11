import React from "react";
import ReactDOM from "react-dom/client";
import ProjectionOutput from "./components/ProjectionOutput";
import { registrar } from "./lib/registro";
import "./styles/global.css";

/**
 * La ventana de salida: solo la pantalla de proyección.
 *
 * Tiene su propia página (`salida.html`) para no cargar nada de la ventana
 * principal. Antes abría `index.html?salida` y, aunque no montara `App`,
 * descargaba y evaluaba el paquete entero —el store con sus suscripciones,
 * los diálogos, las vistas— antes de poder enseñar nada en el proyector.
 */

// Lo que se rompe sin que nadie lo recoja acaba en el log en vez de en una
// consola que en una PC de iglesia nadie abre.
window.addEventListener("error", (e) => {
  registrar("error", `[salida] uncaught: ${e.message} (${e.filename}:${e.lineno})`);
});
window.addEventListener("unhandledrejection", (e) => {
  registrar("error", `[salida] unhandled rejection: ${String(e.reason)}`);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ProjectionOutput />
  </React.StrictMode>,
);
