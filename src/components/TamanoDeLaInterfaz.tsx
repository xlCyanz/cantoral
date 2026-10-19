import type { CSSProperties } from "react";
import { useStore } from "../store";
import { isMacOS } from "../lib/api";
import { TAMANOS } from "../lib/tamano";

// La tarjeta de Configuración que agranda toda la interfaz, para quien no ve
// bien la letra pequeña. Lo que hace el tamaño está en `lib/tamano.ts`; aquí
// solo se elige.

const tarjeta: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--surface)",
  padding: "13px 14px",
  marginBottom: 12,
};

/**
 * Tres botones con `aria-pressed` y no un deslizador: se llega a cada uno con
 * Tab, se elige con Espacio o Intro, y el lector de pantalla dice cuál está
 * puesto. Cada uno enseña una «Aa» al tamaño que pone, para elegir mirando y
 * no leyendo.
 */
export default function TamanoDeLaInterfaz() {
  const tamano = useStore((s) => s.tamanoUi);
  const setTamano = useStore((s) => s.setTamanoUi);
  const mod = isMacOS() ? "⌘" : "Ctrl";

  return (
    <div style={tarjeta}>
      <h2 id="tamano-interfaz-titulo" style={{ fontSize: "12.5px", fontWeight: 600, margin: "0 0 2px" }}>
        Tamaño de la interfaz
      </h2>
      <p id="tamano-interfaz-ayuda" style={{ fontSize: 11, color: "var(--text-2)", margin: "0 0 10px", lineHeight: 1.55 }}>
        Agranda letras, botones y listas en toda la app. También con {mod} + y {mod} −; {mod} 0 la deja en «Grande». Si
        la ventana es pequeña, crece hasta donde quepa.
      </p>
      <div role="group" aria-labelledby="tamano-interfaz-titulo" aria-describedby="tamano-interfaz-ayuda" style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
        {TAMANOS.map((t) => {
          const activo = tamano === t.valor;
          return (
            <button
              key={t.valor}
              onClick={() => setTamano(t.valor)}
              aria-pressed={activo}
              className={activo ? undefined : "hb-s2"}
              style={{
                flex: "1 1 120px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 11px",
                borderRadius: 9,
                textAlign: "left",
                transition: "background .14s,border-color .14s",
                border: `1px solid ${activo ? "var(--primary)" : "var(--border-2)"}`,
                background: activo ? "var(--primary-soft)" : "var(--surface-2)",
                color: activo ? "var(--primary)" : "var(--text)",
              }}
            >
              <span aria-hidden className="display" style={{ fontSize: Math.round(15 * t.factor), lineHeight: 1, width: 28, flex: "0 0 auto" }}>
                Aa
              </span>
              <span style={{ fontSize: "11.5px", fontWeight: 600 }}>{t.etiqueta}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
