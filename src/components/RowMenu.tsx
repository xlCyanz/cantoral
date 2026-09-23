import { useEffect } from "react";
import type { CSSProperties } from "react";
import { cur, seleccionVigente, useStore } from "../store";
import { gestorDeArchivos } from "../lib/api";

const ANCHO = 206;
/** Roughly what the menu measures, to keep it inside the window. */
const ALTO = 220;

/**
 * Una entrada del menú.
 *
 * Sin icono: seis iconos en columna a la izquierda de seis palabras no añaden
 * nada que las palabras no digan ya, y le daban al menú el ancho de un panel.
 * Lo que sí ayuda es el atajo a la derecha, que es donde se aprende.
 */
const opcion = (peligro?: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  height: 27,
  padding: "0 12px",
  color: peligro ? "var(--danger)" : "var(--text)",
  fontSize: 12,
  textAlign: "left",
});

const atajo: CSSProperties = { fontSize: "10.5px", color: "var(--text-3)", marginLeft: 18 };

/**
 * Right-click menu for a library row.
 *
 * The app has been suppressing the browser's own context menu since before
 * there was anything to put in its place; this is that place. It acts on the
 * selection, which `openRowMenu` has already made sure contains the row that
 * was clicked.
 *
 * Con una sola pista ofrece todo lo que se le puede hacer; con varias, solo lo
 * que tiene sentido en plural — «ver el detalle» de doce pistas no quiere
 * decir nada, y ofrecerlo sería ofrecer una decepción.
 *
 * Sin «favoritas»: el corazón está en cada fila y en la barra de selección,
 * que es la que sale al elegir varias. Una tercera puerta a lo mismo solo
 * alarga el menú.
 */
export default function RowMenu() {
  const menu = useStore((s) => s.rowMenu);
  const ids = useStore(seleccionVigente);
  const pista = useStore((s) => (s.rowMenu ? s.tracks.find((t) => t.id === s.rowMenu!.id) : undefined));
  const sonando = useStore(cur);
  const closeRowMenu = useStore((s) => s.closeRowMenu);
  const openAddToList = useStore((s) => s.openAddToList);
  const openDetail = useStore((s) => s.onRowClick);
  const openSheetEditor = useStore((s) => s.openSheetEditor);
  const revealTrack = useStore((s) => s.revealTrack);
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
  const titulo = varias ? `${ids.length} pistas` : (pista?.titulo ?? "Pista");

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
        style={{ position: "fixed", left: x, top: y, zIndex: 65, minWidth: ANCHO, background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 9, boxShadow: "var(--sh-md)", padding: "0 0 4px", overflow: "hidden", animation: "canDialog .16s cubic-bezier(.22,1,.36,1)" }}
      >
        {/* El título de la pista y no la palabra «Pista»: con el menú abierto
            encima de una tabla de veinte filas, lo primero que hay que poder
            comprobar es sobre cuál se abrió. */}
        <div
          title={titulo}
          style={{ padding: "7px 12px 6px", fontSize: "10.5px", color: "var(--text-3)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 230 }}
        >
          {titulo}
        </div>

        {!varias && (
          <button role="menuitem" onClick={hacer(() => play(menu.id))} className="hb-s2" style={opcion()}>
            <span>Reproducir ahora</span>
            <span style={atajo}>{sonando?.id === menu.id ? "sonando" : ""}</span>
          </button>
        )}

        <button role="menuitem" onClick={hacer(openAddToList)} className="hb-s2" style={opcion()}>
          <span>Agregar a culto…</span>
          <span style={atajo}>A</span>
        </button>

        {!varias && (
          <>
            <button role="menuitem" onClick={hacer(() => openDetail(menu.id))} className="hb-s2" style={opcion()}>
              <span>Ver el detalle</span>
            </button>
            <button role="menuitem" onClick={hacer(() => openSheetEditor(menu.id))} className="hb-s2" style={opcion()}>
              <span>Letra y acordes</span>
              <span style={atajo}>{pista?.tieneHoja ? "escrita" : ""}</span>
            </button>
          </>
        )}

        {!varias && pista?.path && (
          <button role="menuitem" onClick={hacer(() => revealTrack(menu.id))} className="hb-s2" style={opcion()}>
            <span>Mostrar en {gestorDeArchivos()}</span>
          </button>
        )}

        <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
        <button role="menuitem" onClick={hacer(bulkDelete)} className="hb-danger" style={opcion(true)}>
          <span>Quitar de la biblioteca…</span>
        </button>
      </div>
    </>
  );
}
