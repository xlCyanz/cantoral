import { useState } from "react";
import type { CSSProperties } from "react";
import { Heart, HeartOff, ListPlus, Tag, Trash2 } from "lucide-react";
import { etiquetas, seleccionVigente, useStore } from "../store";

const boton: CSSProperties = {
  flex: "0 0 auto",
  height: 25,
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "0 9px",
  borderRadius: 6,
  border: "1px solid var(--border-2)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "11.5px",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

/** The one that starts the sentence, so it looks like the answer. */
const botonPrincipal: CSSProperties = {
  ...boton,
  border: 0,
  background: "var(--primary-fill)",
  color: "var(--on-primary)",
};

/**
 * The menus hang downwards.
 *
 * They used to open upwards, because the bar floated near the player. Now the
 * bar lives in the toolbar row, and a menu that grew up from there would climb
 * over the window's own chrome.
 */
const menu: CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  marginTop: 4,
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
  padding: "7px 10px",
  borderRadius: 8,
  color: "var(--text)",
  fontSize: "12.5px",
  fontWeight: 600,
  textAlign: "left",
};

/**
 * What can be done to the rows that are picked.
 *
 * Lives inside the toolbar row and takes it over: while something is selected,
 * the chips and the grouping controls step aside. It used to float over the
 * table near the player, which put it on top of the very rows it was acting
 * on — so the last thing you saw before confirming was a bar covering the
 * evidence.
 */
export default function SelectionBar() {
  const ids = useStore(seleccionVigente);
  const tags = useStore(etiquetas);
  const clearSelection = useStore((s) => s.clearSelection);
  const openAddToList = useStore((s) => s.openAddToList);
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
      style={{
        // Se ajusta a lo que tiene, no estira: es una barra de herramientas,
        // no un reparto de espacio.
        flex: "0 1 auto",
        minWidth: 0,
        height: 36,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 6px 0 10px",
        // En una ventana estrecha —o con el panel de detalle abierto, que se
        // lleva 300 px— la fila se desplaza en vez de recortar los botones:
        // una acción a medio dibujar es una acción a la que no se puede
        // llegar, y aquí una de ellas quita pistas de la biblioteca.
        overflowX: "auto",
        border: "1px solid var(--primary)",
        borderRadius: 8,
        background: "var(--primary-soft)",
        animation: "canFade .16s ease-out",
      }}
    >
      <span aria-live="polite" style={{ flex: "0 0 auto", fontSize: 12, fontWeight: 600, color: "var(--primary)", whiteSpace: "nowrap" }}>
        {ids.length === 1 ? "1 pista seleccionada" : `${ids.length} pistas seleccionadas`}
      </span>

      {/* Un botón, no un desplegable: el mismo diálogo que se abre desde el
          panel de detalle y desde el menú contextual, y que dice cuántas
          pistas va a mover antes de elegir a dónde. El atajo va escrito
          porque el diálogo se abre igual con `A`. */}
      <button onClick={openAddToList} className="hb-primary" style={botonPrincipal}>
        <ListPlus size={13} />Agregar a un culto… <span style={{ opacity: 0.7 }}>A</span>
      </button>

      <button onClick={() => bulkFav(true)} title="Marcar como favoritas" aria-label="Marcar la selección como favoritas" className="hb-s2" style={boton}>
        <Heart size={13} />
      </button>
      <button onClick={() => bulkFav(false)} title="Quitar de favoritas" aria-label="Quitar la selección de favoritas" className="hb-s2" style={boton}>
        <HeartOff size={13} />
      </button>

      <div style={{ position: "relative", flex: "0 0 auto" }}>
        <button onClick={() => setAbierto(abierto === "etiqueta" ? null : "etiqueta")} className="hb-s2" style={boton}>
          <Tag size={13} />Etiquetar…
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
                style={{ width: "100%", height: 32, border: "1px solid var(--border-2)", background: "var(--surface-2)", borderRadius: 8, padding: "0 10px", fontSize: "12.5px", outline: "none", marginBottom: 4 }}
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
                    style={{ flex: "0 0 auto", width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", color: "var(--text-3)" }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <button onClick={bulkDelete} className="hb-danger" style={{ ...boton, color: "var(--danger)" }}>
        <Trash2 size={13} />Quitar…
      </button>

      {/* El atajo va escrito: Esc ya deshacía la selección antes de que esto
          existiera, y nadie tenía forma de saberlo. */}
      <button onClick={clearSelection} aria-label="Deseleccionar todo" className="hb-text" style={{ ...boton, border: 0, background: "transparent", color: "var(--text-2)", fontWeight: 500 }}>
        Cancelar <span style={{ opacity: 0.65 }}>Esc</span>
      </button>
    </div>
  );
}
