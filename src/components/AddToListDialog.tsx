import { ListMusic, Plus } from "lucide-react";
import type { CSSProperties } from "react";
import { cultos, pistasParaAgregar, plantillas, plDur, useStore } from "../store";
import { gradientFor, inicialDe } from "../lib/covers";
import Modal from "./Modal";

/**
 * El único sitio desde el que se agrega a un culto.
 *
 * Antes había tres, y cada uno era un desplegable distinto: uno en el panel de
 * detalle que agregaba **una** pista, uno en la barra de selección y otro en el
 * menú contextual que agregaban **la selección**. Tres implementaciones del
 * mismo menú, dos comportamientos distintos y ninguna forma de saber cuál te
 * iba a tocar. Ahora los tres abren esto, y esto dice cuántas pistas va a
 * mover antes de que elijas a dónde.
 */
const fila: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "7px 8px",
  borderRadius: 8,
  textAlign: "left",
};

export default function AddToListDialog() {
  const abierto = useStore((s) => s.dialog === "addToList");
  const ids = useStore(pistasParaAgregar);
  // En el mismo orden que la barra lateral: el culto que se está preparando
  // es el último que se tocó, y es al que casi siempre se agrega.
  const losCultos = useStore(cultos);
  const lasPlantillas = useStore(plantillas);
  const playlists = [...losCultos, ...lasPlantillas];
  const plOrder = useStore((s) => s.plOrder);
  const tracks = useStore((s) => s.tracks);
  const closeDialog = useStore((s) => s.closeDialog);
  const addToListConfirm = useStore((s) => s.addToListConfirm);
  const newList = useStore((s) => s.newList);

  if (!abierto) return null;

  const cuantas = ids.length;

  return (
    <Modal labelledBy="agregar-culto-titulo" describedBy="agregar-culto-cuantas" onClose={closeDialog} maxWidth={360}>
      <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid var(--border)" }}>
        <h2 id="agregar-culto-titulo" style={{ fontSize: 13, fontWeight: 600, margin: "0 0 1px" }}>
          Agregar a un culto
        </h2>
        {/* Cuántas y dónde caen, antes de elegir: si van al final, eso no
            debería ser una sorpresa que se descubre mirando la lista después. */}
        <p id="agregar-culto-cuantas" style={{ fontSize: 11, color: "var(--text-2)", margin: 0 }}>
          {cuantas === 1 ? "Se agrega 1 pista al final del culto." : `Se agregan ${cuantas} pistas al final del culto.`}
        </p>
      </div>

      <div style={{ maxHeight: 212, overflowY: "auto", padding: 5 }}>
        {playlists.length === 0 ? (
          <p style={{ ...fila, color: "var(--text-3)", fontSize: 12 }}>Todavía no hay cultos. Crea el primero abajo.</p>
        ) : (
          playlists.map((p) => {
            const orden = plOrder[p.id] ?? p.ids;
            const yaEstaban = ids.filter((id) => orden.includes(id)).length;
            return (
              <button key={p.id} onClick={() => addToListConfirm(p.id)} className="hb-s2" style={fila}>
                <span style={{ position: "relative", width: 24, height: 24, flex: "0 0 auto", borderRadius: 6, overflow: "hidden", display: "grid", placeItems: "center" }}>
                  <span style={gradientFor(p.id, 150)} />
                  <span className="display" style={{ position: "relative", fontSize: 12, color: "rgba(255,255,255,.9)" }}>
                    {inicialDe(p.nombre)}
                  </span>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.nombre}
                  </span>
                  <span style={{ display: "block", fontSize: "10.5px", color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {[
                      p.plantilla ? "Plantilla" : "",
                      `${orden.length} ${orden.length === 1 ? "pista" : "pistas"}`,
                      plDur({ tracks }, orden),
                      // Decirlo aquí evita el viaje de elegir, leer «ya estaban
                      // todas» y volver a abrir el diálogo.
                      yaEstaban > 0 ? (yaEstaban === cuantas ? "ya están todas" : `${yaEstaban} ya ahí`) : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>

      <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border)", display: "flex", gap: 7, alignItems: "center" }}>
        <button onClick={newList} className="hb-s2" style={{ height: 28, display: "flex", alignItems: "center", gap: 6, padding: "0 11px", borderRadius: 7, border: "1px solid var(--border-2)", background: "var(--surface-2)", color: "var(--text)", fontSize: "11.5px", fontWeight: 600 }}>
          <Plus size={13} />Nuevo culto…
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={closeDialog} className="hb-text" style={{ height: 28, padding: "0 11px", borderRadius: 7, background: "transparent", color: "var(--text-2)", fontSize: "11.5px" }}>
          Cancelar
        </button>
      </div>
    </Modal>
  );
}

/** El botón que abre el diálogo, igual desde donde se pulse. */
export function AddToListButton({ style, className, icono = true, label = "Agregar a un culto…" }: { style?: CSSProperties; className?: string; icono?: boolean; label?: string }) {
  const openAddToList = useStore((s) => s.openAddToList);
  return (
    <button onClick={openAddToList} className={className} style={style}>
      {icono && <ListMusic size={13} />}
      {label}
    </button>
  );
}
