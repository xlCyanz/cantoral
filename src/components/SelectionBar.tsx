import { useState } from "react";
import type { CSSProperties } from "react";
import { Heart, HeartOff, ListPlus, Tag, Trash2, X } from "lucide-react";
import { etiquetas, seleccionVigente, useStore } from "../store";

const boton: CSSProperties = {
  flex: "0 0 auto",
  height: 34,
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "0 12px",
  borderRadius: 9,
  border: "1px solid var(--border-2)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "12.5px",
  fontWeight: 600,
};

const menu: CSSProperties = {
  position: "absolute",
  bottom: 44,
  left: 0,
  zIndex: 61,
  minWidth: 210,
  maxHeight: 280,
  overflowY: "auto",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 11,
  boxShadow: "var(--sh-md)",
  padding: 5,
};

const opcion: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "left",
};

/**
 * What can be done to the rows that are picked.
 *
 * Appears only once something is selected, so the library looks exactly as it
 * did until the moment the bar has something to act on.
 */
export default function SelectionBar() {
  const ids = useStore(seleccionVigente);
  const lists = useStore((s) => s.playlists);
  const tags = useStore(etiquetas);
  const clearSelection = useStore((s) => s.clearSelection);
  const bulkAddToPlaylist = useStore((s) => s.bulkAddToPlaylist);
  const bulkFav = useStore((s) => s.bulkFav);
  const bulkTag = useStore((s) => s.bulkTag);
  const bulkDelete = useStore((s) => s.bulkDelete);
  const [abierto, setAbierto] = useState<"lista" | "etiqueta" | null>(null);
  const [nueva, setNueva] = useState("");

  if (ids.length === 0) return null;

  const cerrar = () => {
    setAbierto(null);
    setNueva("");
  };

  return (
    <div
      role="region"
      aria-label="Acciones sobre la selección"
      style={{ position: "fixed", left: "50%", bottom: 104, zIndex: 60, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8, background: "var(--bg-2)", border: "1px solid var(--border-2)", borderRadius: 13, boxShadow: "var(--sh-lg)", padding: "8px 10px", animation: "canToast .24s cubic-bezier(.22,1,.36,1)" }}
    >
      <span aria-live="polite" style={{ flex: "0 0 auto", padding: "0 6px", fontSize: "12.5px", fontWeight: 700, color: "var(--text)" }}>
        {ids.length === 1 ? "1 pista" : `${ids.length} pistas`}
      </span>

      <div style={{ position: "relative" }}>
        <button onClick={() => setAbierto(abierto === "lista" ? null : "lista")} className="hb-s2" style={boton}>
          <ListPlus size={15} />Agregar a lista
        </button>
        {abierto === "lista" && (
          <>
            <div onClick={cerrar} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
            <div style={menu}>
              {lists.length === 0 ? (
                <p style={{ ...opcion, color: "var(--text-3)", fontWeight: 500 }}>Todavía no hay listas.</p>
              ) : (
                lists.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      bulkAddToPlaylist(p.id);
                      cerrar();
                    }}
                    className="hb-s2"
                    style={opcion}
                  >
                    {p.nombre}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ position: "relative" }}>
        <button onClick={() => setAbierto(abierto === "etiqueta" ? null : "etiqueta")} className="hb-s2" style={boton}>
          <Tag size={15} />Etiquetar
        </button>
        {abierto === "etiqueta" && (
          <>
            <div onClick={cerrar} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
            <div style={menu}>
              <input
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && nueva.trim()) {
                    bulkTag(nueva, true);
                    cerrar();
                  }
                }}
                placeholder="Etiqueta nueva y Enter…"
                list="etiquetas-existentes"
                className="in-focus"
                autoFocus
                style={{ width: "100%", height: 34, border: "1px solid var(--border-2)", background: "var(--surface-2)", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", marginBottom: 4 }}
              />
              {tags.map((t) => (
                <div key={t.nombre} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <button onClick={() => { bulkTag(t.nombre, true); cerrar(); }} className="hb-s2" style={{ ...opcion, flex: 1 }}>
                    {t.nombre}
                  </button>
                  <button
                    onClick={() => { bulkTag(t.nombre, false); cerrar(); }}
                    title={`Quitar «${t.nombre}» de la selección`}
                    aria-label={`Quitar la etiqueta ${t.nombre} de la selección`}
                    className="hb-danger"
                    style={{ flex: "0 0 auto", width: 28, height: 28, borderRadius: 7, display: "grid", placeItems: "center", color: "var(--text-3)" }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <button onClick={() => bulkFav(true)} title="Marcar como favoritas" className="hb-s2" style={boton}>
        <Heart size={15} />
      </button>
      <button onClick={() => bulkFav(false)} title="Quitar de favoritas" className="hb-s2" style={boton}>
        <HeartOff size={15} />
      </button>
      <button onClick={bulkDelete} title="Quitar de la biblioteca" className="hb-danger" style={{ ...boton, color: "var(--danger)" }}>
        <Trash2 size={15} />
      </button>

      <span style={{ width: 1, height: 22, background: "var(--border)" }} />
      <button onClick={clearSelection} title="Deseleccionar" aria-label="Deseleccionar todo" className="hb-s2t" style={{ ...boton, padding: "0 9px" }}>
        <X size={16} />
      </button>
    </div>
  );
}
