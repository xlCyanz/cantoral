import { ChevronDown, Mic2 } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import type { Singer } from "../lib/types";
import { botonSecundario } from "../lib/styles";

/**
 * «Hoy cantan…»: eligen quiénes cantan hoy y la biblioteca —o el culto abierto—
 * muestra lo que se sabe al menos uno. No es un filtro rápido de la barra
 * lateral: es para el culto del domingo y se suelta al cerrar la app, así que
 * vive junto a la fila de filtros y junto a «Reproducir todo».
 *
 * Dos tamaños, para los dos sitios donde vive: junto a los controles de la
 * biblioteca (34 px, como el «Agrupar») y en la fila de acciones del culto
 * (42 px, como «Agregar canciones…») — con uno menor la fila queda dispar.
 */
export default function SingingTodayDropdown({
  singers,
  singingToday,
  toggle,
  clear,
  tamanio = "barra",
}: {
  singers: Singer[];
  singingToday: string[];
  toggle: (nombre: string) => void;
  clear: () => void;
  /** «barra» junto a la fila de filtros; «accion» en la fila del culto. */
  tamanio?: "barra" | "accion";
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [abierto]);

  const activo = singingToday.length > 0;
  const label = activo ? `Hoy cantan: ${singingToday.join(", ")}` : "Hoy cantan…";

  return (
    <div ref={ref} style={{ position: "relative", flex: "0 0 auto" }}>
      <button
        onClick={() => setAbierto(!abierto)}
        style={{
          ...(tamanio === "accion" ? { ...botonSecundario(42), cursor: "pointer" } : chip),
          maxWidth: tamanio === "accion" ? 240 : 200,
        }}
        title="Elegir quiénes cantan hoy"
      >
        <Mic2 size={tamanio === "accion" ? 15 : 13} style={{ flex: "0 0 auto", color: activo ? "var(--primary)" : "var(--text-3)" }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        <ChevronDown size={tamanio === "accion" ? 15 : 13} style={{ flex: "0 0 auto", transform: abierto ? "rotate(180deg)" : "none", transition: "transform .14s" }} />
      </button>
      {abierto && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 20,
            minWidth: 190,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "var(--sh-lg)",
            padding: "6px 0",
          }}
        >
          {singers.map((c) => {
            const checked = singingToday.includes(c.nombre);
            return (
              <label
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 12px",
                  fontSize: "12.5px",
                  color: "var(--text)",
                  cursor: "pointer",
                  background: checked ? "var(--primary-soft)" : "transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(c.nombre)}
                  style={{ width: 15, height: 15, accentColor: "var(--primary)" }}
                />
                {c.nombre}
              </label>
            );
          })}
          {activo && (
            <button
              onClick={clear}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "7px 12px",
                fontSize: "11.5px",
                color: "var(--text-2)",
                textAlign: "left",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                borderTop: "1px solid var(--border)",
              }}
            >
              Quitar filtro
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const chip: CSSProperties = {
  height: 34,
  border: "1px solid var(--border-2)",
  background: "var(--surface)",
  borderRadius: 9,
  padding: "0 10px",
  fontSize: "12.5px",
  fontWeight: 500,
  color: "var(--text)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
};
