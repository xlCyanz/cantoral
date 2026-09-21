import { useState } from "react";
import type { CSSProperties } from "react";
import { Tag, Trash2 } from "lucide-react";
import { etiquetas, useStore } from "../store";
import type { Etiqueta } from "../store";

const h2Style: CSSProperties = { fontSize: "15.5px", fontWeight: 700, margin: "0 0 3px" };
const pStyle: CSSProperties = { fontSize: "12.5px", color: "var(--text-2)", margin: 0, lineHeight: 1.5 };

/**
 * One tag, renameable in place.
 *
 * The name lives in local state while it is being typed and only reaches the
 * store on Enter or on leaving the field — a rename per keystroke would rewrite
 * every track that carries it, once per letter.
 *
 * Keyed on the tag name by the caller, so a renamed tag comes back as a fresh
 * row instead of a field holding a name that no longer exists.
 */
function Fila({ etiqueta }: { etiqueta: Etiqueta }) {
  const [nombre, setNombre] = useState(etiqueta.nombre);
  const renameTag = useStore((s) => s.renameTag);
  const deleteTag = useStore((s) => s.deleteTag);

  const confirmar = () => {
    if (nombre.trim() && nombre !== etiqueta.nombre) renameTag(etiqueta.nombre, nombre);
    else setNombre(etiqueta.nombre);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderBottom: "1px solid var(--border)" }}>
      <Tag size={15} color="var(--text-3)" style={{ flex: "0 0 auto" }} />
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setNombre(etiqueta.nombre);
            e.currentTarget.blur();
          }
        }}
        aria-label={`Nombre de la etiqueta ${etiqueta.nombre}`}
        className="in-focus"
        style={{ flex: 1, minWidth: 0, height: 32, border: "1px solid transparent", background: "transparent", borderRadius: 8, padding: "0 9px", fontSize: "13.5px", fontWeight: 600, color: "var(--text)", outline: "none" }}
      />
      <span style={{ flex: "0 0 auto", fontSize: 12, color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
        {etiqueta.cuenta} {etiqueta.cuenta === 1 ? "pista" : "pistas"}
      </span>
      <button
        onClick={() => deleteTag(etiqueta.nombre)}
        title={`Quitar «${etiqueta.nombre}» de todas las pistas`}
        aria-label={`Quitar la etiqueta ${etiqueta.nombre}`}
        className="hb-danger"
        style={{ flex: "0 0 auto", width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", color: "var(--text-3)" }}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

/** The «Etiquetas» section of Configuración. */
export default function TagManager() {
  const lista = useStore(etiquetas);

  return (
    <div style={{ marginBottom: 30 }}>
      <h2 style={h2Style}>Etiquetas</h2>
      <p style={{ ...pStyle, marginBottom: 12 }}>
        Todas las que has usado, con cuántas pistas llevan cada una. Cambia el nombre y se corrige en
        todas a la vez; si le pones el nombre de otra que ya existe, las dos se unen en una.
      </p>

      {lista.length === 0 ? (
        <p style={{ ...pStyle, padding: "14px 15px", border: "1px solid var(--border)", borderRadius: 13, background: "var(--surface)" }}>
          Todavía no has etiquetado ninguna pista. Se agregan desde el panel de detalle.
        </p>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: 13, overflow: "hidden", background: "var(--surface)" }}>
          {lista.map((e) => (
            <Fila key={e.nombre} etiqueta={e} />
          ))}
        </div>
      )}
    </div>
  );
}
