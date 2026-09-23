import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ProjectionOutput from "./components/ProjectionOutput";
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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{esSalida ? <ProjectionOutput /> : <App />}</React.StrictMode>,
);
