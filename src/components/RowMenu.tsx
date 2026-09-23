import { useEffect } from "react";
import type { CSSProperties } from "react";
import { Heart, HeartOff, ListPlus, Play, Trash2 } from "lucide-react";
import { seleccionVigente, useStore } from "../store";

const ANCHO = 230;
/** Roughly what the menu measures, to keep it inside the window. */
const ALTO = 250;

const opcion: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  width: "100%",
  padding: "8px 11px",
  borderRadius: 8,
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "left",
};

const encabezado: CSSProperties = {
  padding: "7px 11px 5px",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: ".4px",
  textTransform: "uppercase",
  color: "var(--text-3)",
};

/**
 * Right-click menu for a library row.
 *
 * The app has been suppressing the browser's own context menu since before
 * there was anything to put in its place; this is that place. It acts on the
 * selection, which `openRowMenu` has already made sure contains the row that
 * was clicked.
 */
export default function RowMenu() {
  const menu = useStore((s) => s.rowMenu);
  const ids = useStore(seleccionVigente);
  const closeRowMenu = useStore((s) => s.closeRowMenu);
  const openAddToList = useStore((s) => s.openAddToList);
  const bulkFav = useStore((s) => s.bulkFav);
  const bulkDelete = useStore((s) => s.bulkDelete);
  const play = useStore((s) => s.play);

  // Esc belongs to the global shortcuts for dialogs; this is a lighter layer
  // that closes on its own.
  useEffect(() => {
    if (!menu) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRowMenu();
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [menu, closeRowMenu]);

  if (!menu) return null;

  // Flip near the edges so the menu never opens off-screen.
  const x = Math.min(menu.x, window.innerWidth - ANCHO - 8);
  const y = Math.min(menu.y, window.innerHeight - ALTO - 8);
  const varias = ids.length > 1;

  const hacer = (fn: () => void) => () => {
    fn();
    closeRowMenu();
  };

  return (
    <>
      <div onClick={closeRowMenu} onContextMenu={(e) => { e.preventDefault(); closeRowMenu(); }} style={{ position: "fixed", inset: 0, zIndex: 64 }} />
      <div
        role="menu"
        aria-label="Acciones de la pista"
        style={{ position: "fixed", left: x, top: y, zIndex: 65, width: ANCHO, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 11, boxShadow: "var(--sh-md)", padding: 5, animation: "canDialog .16s cubic-bezier(.22,1,.36,1)" }}
      >
        <div style={encabezado}>{varias ? `${ids.length} pistas` : "Pista"}</div>

        {!varias && (
          <>
            <button role="menuitem" onClick={hacer(() => play(menu.id))} className="hb-s2" style={opcion}>
              <Play size={15} />Reproducir
            </button>
          </>
        )}

        {/* Abre el mismo diálogo que la barra de selección y el panel de
            detalle, en vez del submenú que tenía su propia lista. El atajo va
            escrito: hace exactamente esto. */}
        <button role="menuitem" onClick={hacer(openAddToList)} className="hb-s2" style={opcion}>
          <ListPlus size={15} />Agregar a un culto…
          <span style={{ marginLeft: "auto", fontSize: "10.5px", color: "var(--text-3)" }}>A</span>
        </button>

        <button role="menuitem" onClick={hacer(() => bulkFav(true))} className="hb-s2" style={opcion}>
          <Heart size={15} />Marcar como favorita{varias ? "s" : ""}
        </button>
        <button role="menuitem" onClick={hacer(() => bulkFav(false))} className="hb-s2" style={opcion}>
          <HeartOff size={15} />Quitar de favoritas
        </button>

        <div style={{ height: 1, background: "var(--border)", margin: "5px 4px" }} />
        <button role="menuitem" onClick={hacer(bulkDelete)} className="hb-danger" style={{ ...opcion, color: "var(--danger)" }}>
          <Trash2 size={15} />Quitar de la biblioteca
        </button>
      </div>
    </>
  );
}
