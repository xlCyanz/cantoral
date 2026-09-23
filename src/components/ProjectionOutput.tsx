import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { SalidaProyeccion } from "../lib/api";

/**
 * Lo que se ve por el proyector.
 *
 * Esta es toda la interfaz de la ventana de salida: no monta la app, no lee la
 * biblioteca y no puede tocar nada. Recibe por evento lo que tiene que
 * mostrar y lo muestra. Si la ventana principal se cuelga, aquí se queda lo
 * último que llegó en vez de aparecer un error delante de la congregación.
 *
 * Arranca en negro y vuelve a negro: en una proyección el fondo por defecto no
 * es blanco ni gris, es apagado.
 */
export default function ProjectionOutput() {
  const [salida, setSalida] = useState<SalidaProyeccion>({ modo: "negro" });

  useEffect(() => {
    let soltar: (() => void) | undefined;
    void listen<SalidaProyeccion>("proyeccion", (e) => setSalida(e.payload)).then((f) => (soltar = f));
    return () => soltar?.();
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        color: "rgba(255,255,255,.94)",
        display: "grid",
        placeItems: "center",
        // Nada de esta ventana se puede tocar: es una pantalla, no una
        // interfaz. Sin cursor y sin selección, por si alguien mueve el ratón.
        cursor: "none",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      {salida.modo === "titulo" && (
        <div style={{ padding: 40, textAlign: "center", maxWidth: "80vw" }}>
          <div className="display" style={{ fontSize: "5vw", lineHeight: 1.15, textWrap: "balance" }}>
            {salida.titulo}
          </div>
          {salida.sub && (
            <div style={{ marginTop: "1.2vw", fontSize: "1.8vw", color: "rgba(255,255,255,.55)" }}>{salida.sub}</div>
          )}
        </div>
      )}
    </div>
  );
}
