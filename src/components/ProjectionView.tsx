import { useEffect } from "react";
import { MonitorX, Presentation, Square } from "lucide-react";
import type { CSSProperties } from "react";
import { useStore } from "../store";

/**
 * El panel de mandos de la proyección.
 *
 * Lo que se ve aquí no es lo que sale: aquí están los controles, y por el
 * proyector sale una ventana aparte que no muestra nada de esta. Esta primera
 * versión hace lo básico —elegir pantalla, abrir y cerrar la salida, ponerla
 * en negro— y deja la cola del culto y el video para cuando exista el
 * reproductor.
 */
const tarjeta: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--surface)",
  padding: "10px 11px",
};

const rotulo: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "var(--text-3)",
  marginBottom: 7,
};

export default function ProjectionView() {
  const monitores = useStore((s) => s.monitores);
  const monitorSalida = useStore((s) => s.monitorSalida);
  const proyectando = useStore((s) => s.proyectando);
  const cargarMonitores = useStore((s) => s.cargarMonitores);
  const elegirMonitor = useStore((s) => s.elegirMonitor);
  const alternarProyeccion = useStore((s) => s.alternarProyeccion);
  const proyectar = useStore((s) => s.proyectar);

  // Las pantallas se enchufan y se desenchufan mientras la app está abierta,
  // y normalmente el proyector se conecta justo antes de empezar.
  useEffect(() => {
    void cargarMonitores();
  }, [cargarMonitores]);

  const activo = monitores.find((m) => m.indice === monitorSalida);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "12px 18px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "11.5px", color: "var(--text-2)" }}>
            {monitores.length === 0
              ? "No se detecta ninguna pantalla."
              : <>Sale en <strong style={{ color: "var(--text)" }}>{activo?.nombre ?? "—"}</strong></>}
          </div>
        </div>
        <span
          style={{
            flex: "0 0 auto",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            padding: "3px 9px",
            borderRadius: 20,
            background: proyectando ? "var(--danger-soft)" : "var(--surface-3)",
            color: proyectando ? "var(--danger)" : "var(--text-3)",
          }}
        >
          {proyectando ? "En vivo" : "Apagada"}
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 18px 16px", borderTop: "1px solid var(--border)" }}>
        <div style={{ ...tarjeta, marginTop: 14, maxWidth: 420 }}>
          <div style={rotulo}>Pantalla de salida</div>
          {monitores.length === 0 ? (
            <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text-2)", lineHeight: 1.55 }}>
              Conecta el proyector y vuelve a entrar aquí. En el modo navegador no hay pantallas que ofrecer.
            </p>
          ) : (
            monitores.map((m) => {
              const elegido = m.indice === monitorSalida;
              return (
                <button
                  key={m.indice}
                  onClick={() => elegirMonitor(m.indice)}
                  aria-pressed={elegido}
                  className={elegido ? undefined : "hb-s2"}
                  style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "7px 8px", borderRadius: 8, textAlign: "left", background: elegido ? "var(--primary-soft)" : "transparent" }}
                >
                  <span style={{ width: 13, height: 13, flex: "0 0 auto", borderRadius: "50%", border: `1px solid ${elegido ? "var(--primary)" : "var(--border-2)"}`, display: "grid", placeItems: "center" }}>
                    {elegido && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--primary)" }} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "11.5px", fontWeight: 500, color: "var(--text)" }}>{m.nombre}</span>
                    <span style={{ display: "block", fontSize: 10, color: "var(--text-3)" }}>
                      {m.ancho} × {m.alto}
                      {m.principal ? " · donde está esta ventana" : ""}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 8, padding: "11px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-2)" }}>
        <button
          onClick={alternarProyeccion}
          disabled={monitores.length === 0}
          className={proyectando ? "hb-danger-solid" : "hb-primary"}
          style={{
            height: 34,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 14px",
            borderRadius: 8,
            fontSize: "12.5px",
            fontWeight: 600,
            background: proyectando ? "var(--danger-fill)" : "var(--primary-fill)",
            color: proyectando ? "var(--on-danger)" : "var(--on-primary)",
            opacity: monitores.length === 0 ? 0.45 : 1,
            cursor: monitores.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          {proyectando ? <MonitorX size={15} /> : <Presentation size={15} />}
          {proyectando ? "Cortar la salida" : "Proyectar"}
        </button>
        <button
          onClick={() => proyectar({ modo: "negro" })}
          disabled={!proyectando}
          className="hb-s2"
          style={{ height: 34, display: "flex", alignItems: "center", gap: 8, padding: "0 14px", borderRadius: 8, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "12.5px", fontWeight: 600, opacity: proyectando ? 1 : 0.45, cursor: proyectando ? "pointer" : "not-allowed" }}
        >
          <Square size={13} />Pantalla en negro
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: "var(--text-2)", textAlign: "right", lineHeight: 1.45 }}>
          La proyección no muestra nada de esta ventana.
        </div>
      </div>
    </div>
  );
}
