import { Check, Mic2, X } from "lucide-react";
import type { CSSProperties } from "react";
import Modal from "./Modal";
import { useStore } from "../store";

const btnBase: CSSProperties = {
  height: 36,
  padding: "0 14px",
  borderRadius: 9,
  fontSize: "12.5px",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
};

export default function SingerCheckDialog() {
  const avisoPistaId = useStore((s) => s.singerCheckTrack);
  const singingToday = useStore((s) => s.singingToday);
  const preguntar = useStore((s) => s.askSingersAtEnd);
  const setPreguntar = useStore((s) => s.setAskSingersAtEnd);
  const guardar = useStore((s) => s.saveSingersForTrack);
  const cerrar = useStore((s) => s.closeSingerCheck);
  const track = useStore((s) => s.tracks.find((t) => t.id === avisoPistaId));

  if (!avisoPistaId || !track) return null;

  const elegidos = new Set(track.singers.filter((n) => singingToday.includes(n)));

  const toggle = (nombre: string) => {
    const next = new Set(elegidos);
    if (next.has(nombre)) next.delete(nombre);
    else next.add(nombre);
    guardar([...next]);
  };

  const nadie = () => guardar([]);

  return (
    <Modal
      labelledBy="aviso-singers-titulo"
      describedBy="aviso-singers-desc"
      onClose={cerrar}
      maxWidth={420}
      role="dialog"
    >
      <div style={{ padding: "20px 22px 18px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "var(--primary-soft)",
              color: "var(--primary)",
              display: "grid",
              placeItems: "center",
              flex: "0 0 auto",
            }}
          >
            <Mic2 size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="aviso-singers-titulo" className="display" style={{ fontSize: 18, margin: "0 0 4px" }}>
              ¿Quién se sabe «{track.titulo}»?
            </h2>
            <p id="aviso-singers-desc" style={{ margin: 0, fontSize: "12px", color: "var(--text-2)", lineHeight: 1.5 }}>
              Marca a los cantantes de hoy que se saben esta canción.
            </p>
          </div>
          <button
            onClick={cerrar}
            className="hb-s2t"
            style={{ width: 28, height: 28, borderRadius: 7, display: "grid", placeItems: "center", color: "var(--text-3)", flex: "0 0 auto" }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
          {singingToday.map((nombre) => {
            const activo = elegidos.has(nombre);
            return (
              <button
                key={nombre}
                onClick={() => toggle(nombre)}
                className="hb-s2"
                style={{
                  width: "100%",
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0 12px",
                  borderRadius: 9,
                  border: `1px solid ${activo ? "var(--primary)" : "var(--border-2)"}`,
                  background: activo ? "var(--primary-soft)" : "var(--surface-2)",
                  color: "var(--text)",
                  fontSize: "13px",
                  fontWeight: 600,
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    border: `1.5px solid ${activo ? "var(--primary)" : "var(--border-2)"}`,
                    background: activo ? "var(--primary)" : "transparent",
                    display: "grid",
                    placeItems: "center",
                    color: "#fff",
                    flex: "0 0 auto",
                  }}
                >
                  {activo && <Check size={11} strokeWidth={3} />}
                </span>
                {nombre}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={nadie}
            className="hb-s2"
            style={{ ...btnBase, border: "1px solid var(--border-2)", background: "var(--surface-2)", color: "var(--text)" }}
          >
            Nadie se la sabe
          </button>
          <div style={{ flex: 1 }} />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: "11.5px",
              color: "var(--text-2)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={preguntar}
              onChange={(e) => setPreguntar(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: "var(--primary)" }}
            />
            Preguntar al terminar
          </label>
        </div>
      </div>
    </Modal>
  );
}
