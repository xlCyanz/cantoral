import type { CSSProperties } from "react";
import { Heart, HeartOff, ListPlus, Trash2 } from "lucide-react";
import { seleccionVigente, useStore } from "../store";

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
  const clearSelection = useStore((s) => s.clearSelection);
  const openAddToList = useStore((s) => s.openAddToList);
  const bulkFav = useStore((s) => s.bulkFav);
  const bulkDelete = useStore((s) => s.bulkDelete);

  if (ids.length === 0) return null;

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
