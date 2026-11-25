import { memo, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp, GripVertical, ListOrdered, Play, Save, Trash2, Video, X } from "lucide-react";
import { NOMBRE_TEMPORAL, pistasPorId, plDur, useStore } from "../store";
import { coverStyle } from "../lib/covers";
import { botonPrimario, botonSecundario, emptyBtnPrimary, ocupadoStyle } from "../lib/styles";
import type { Track } from "../lib/types";
import Empty from "./Empty";
import GlifoDePista from "./GlifoDePista";

// La lista temporal (#230). Ver `store/temporal.ts`.
//
// Se parece a la vista de un culto a propósito —las mismas filas, los mismos
// botones para mover, el mismo Alt + flechas— para que no haya que aprender
// otra cosa. Lo que no tiene es lo que hace de un culto un culto: nombre,
// «Hoy cantan» y menú de editar o duplicar.

const GRID = "26px 26px minmax(150px,3fr) 58px 86px";

/** Sin ella, cada render tendría una lista vacía nueva. */
const VACIA: Track[] = [];

const enUnaLinea: CSSProperties = { whiteSpace: "nowrap", flex: "0 0 auto" };

const FilaTemporal = memo(function FilaTemporal({ t, num, total }: { t: Track; num: number; total: number }) {
  const dragging = useStore((s) => s.draggingId === t.id);
  const over = useStore((s) => s.overId === t.id && !!s.draggingId && s.draggingId !== t.id);
  const sonando = useStore((s) => s.queueOrigen === "temporal" && s.playerId === t.id);
  const setDragging = useStore((s) => s.setDragging);
  const setOver = useStore((s) => s.setOver);
  const clearDrag = useStore((s) => s.clearDrag);
  const reordenar = useStore((s) => s.reordenarTemporal);
  const mover = useStore((s) => s.moverEnTemporal);
  const quitar = useStore((s) => s.quitarDeTemporal);
  const play = useStore((s) => s.play);

  const primera = num === 1;
  const ultima = num === total;

  const estilo: CSSProperties = {
    display: "grid",
    gridTemplateColumns: GRID,
    alignItems: "center",
    gap: 8,
    padding: "7px 8px",
    borderRadius: 10,
    transition: "background .12s,box-shadow .12s,opacity .12s",
    ...(sonando ? { background: "var(--primary-soft)" } : {}),
    ...(over ? { boxShadow: "inset 0 2px 0 0 var(--primary)" } : {}),
    ...(dragging ? { opacity: 0.4 } : {}),
    ...(t.missing ? { opacity: 0.7 } : {}),
  };

  const boton: CSSProperties = { width: 24, height: 28, borderRadius: 7, display: "grid", placeItems: "center", color: "var(--text-3)" };

  return (
    <div
      className="lib-row"
      role="listitem"
      tabIndex={0}
      aria-label={`${num} de ${total}, ${t.titulo}, ${t.artista}${sonando ? ", sonando" : ""}`}
      aria-current={sonando ? "true" : undefined}
      draggable
      onDragStart={() => setDragging(t.id)}
      onDragOver={(e) => {
        // Solo los arrastres de dentro de la lista: uno que viene de la
        // biblioteca lo recoge la lista entera, que lo añade al final.
        if (!useStore.getState().draggingId) return;
        e.preventDefault();
        setOver(t.id);
      }}
      onDrop={(e) => {
        if (!useStore.getState().draggingId) return;
        e.preventDefault();
        e.stopPropagation();
        reordenar(t.id);
      }}
      onDragEnd={clearDrag}
      onDoubleClick={() => play(t.id)}
      onKeyDown={(e) => {
        // Alt, como en un culto: las flechas solas recorren la lista, no la
        // cambian. Supr la quita, que es lo que se espera de una cola.
        if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault();
          mover(t.id, e.key === "ArrowUp" ? -1 : 1);
        } else if (e.key === "Enter") {
          e.preventDefault();
          play(t.id);
        } else if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          quitar(t.id);
        }
      }}
      style={estilo}
    >
      <div title="Arrastrar para reordenar" className="hb-text" style={{ display: "grid", placeItems: "center", color: "var(--text-3)", cursor: "grab" }}>
        <GripVertical size={16} />
      </div>
      <span style={{ textAlign: "center", fontSize: "12.5px", color: sonando ? "var(--primary)" : "var(--text-3)", fontWeight: sonando ? 700 : 400, fontVariantNumeric: "tabular-nums" }}>
        {sonando ? <Play size={12} fill="currentColor" stroke="none" aria-hidden /> : num}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        <div style={coverStyle(t, 40)}><GlifoDePista t={t} size="lista" /></div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.titulo}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.artista}</span>
            {t.video && (
              <span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 600, color: "var(--text-2)", background: "var(--surface-3)", padding: "1px 5px", borderRadius: 5 }}>
                <Video size={10} />Video
              </span>
            )}
          </div>
        </div>
      </div>
      <div style={{ fontSize: "12.5px", color: "var(--text-2)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{t.dur}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <button onClick={() => mover(t.id, -1)} disabled={primera} title="Subir" aria-label={`Subir «${t.titulo}»`} className="hb-s2t" style={{ ...boton, ...ocupadoStyle(primera) }}>
          <ChevronUp size={15} />
        </button>
        <button onClick={() => mover(t.id, 1)} disabled={ultima} title="Bajar" aria-label={`Bajar «${t.titulo}»`} className="hb-s2t" style={{ ...boton, ...ocupadoStyle(ultima) }}>
          <ChevronDown size={15} />
        </button>
        <button onClick={() => quitar(t.id)} title="Quitar de la lista temporal" aria-label={`Quitar «${t.titulo}» de la lista temporal`} className="hb-danger" style={{ ...boton, width: 28 }}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
});

export default function TemporalView() {
  const ids = useStore((s) => s.temporal);
  const porId = useStore((s) => pistasPorId(s.tracks));
  const filas = ids.length ? ids.map((id) => porId.get(id)).filter((t): t is Track => !!t) : VACIA;
  const duracion = useStore((s) => plDur(s, s.temporal));
  const reorderNotice = useStore((s) => s.reorderNotice);
  const reproducir = useStore((s) => s.reproducirTemporal);
  const vaciar = useStore((s) => s.vaciarTemporal);
  const guardar = useStore((s) => s.abrirGuardarTemporal);
  const verTodaLaBiblioteca = useStore((s) => s.verTodaLaBiblioteca);
  const arrastrandoDesdeBiblioteca = useStore((s) => s.dragFromLibrary.length);
  const agregar = useStore((s) => s.agregarATemporal);
  const endLibraryDrag = useStore((s) => s.endLibraryDrag);
  const [sobre, setSobre] = useState(false);

  const n = filas.length;

  return (
    <div
      style={{ padding: "0 0 40px", minHeight: "100%", ...(sobre ? { outline: "2px dashed var(--primary)", outlineOffset: -8, borderRadius: 14 } : {}) }}
      // Toda la vista recibe lo que se suelta de la biblioteca, también vacía:
      // es justo cuando más falta un sitio grande donde soltar.
      onDragOver={(e) => {
        if (!arrastrandoDesdeBiblioteca) return;
        e.preventDefault();
        setSobre(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(false);
      }}
      onDrop={(e) => {
        if (!arrastrandoDesdeBiblioteca) return;
        e.preventDefault();
        setSobre(false);
        agregar(useStore.getState().dragFromLibrary);
        endLibraryDrag();
      }}
    >
      <div style={{ display: "flex", gap: 22, padding: "28px 24px 24px", alignItems: "flex-end", background: "linear-gradient(180deg,var(--surface-2),transparent)" }}>
        <div style={{ width: 148, height: 148, flex: "0 0 auto", borderRadius: 16, display: "grid", placeItems: "center", background: "var(--primary-soft)", color: "var(--primary)", boxShadow: "var(--sh-md)" }}>
          <ListOrdered size={64} strokeWidth={1.6} />
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingBottom: 2 }}>
          <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 8 }}>
            Sobre la marcha
          </span>
          <h1 className="display" style={{ fontSize: 34, lineHeight: 1.05, margin: "0 0 10px" }}>{NOMBRE_TEMPORAL}</h1>
          <div style={{ color: "var(--text-2)", fontSize: 13, fontWeight: 500 }}>
            {n === 0 ? "Vacía" : `${n} ${n === 1 ? "pista" : "pistas"} · ${duracion}`}
          </div>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
            <button onClick={reproducir} disabled={n === 0} className="hb-primary hb-active-scale" style={{ ...botonPrimario(42), ...enUnaLinea, fontWeight: 700, ...ocupadoStyle(n === 0) }}>
              <Play size={17} fill="currentColor" stroke="none" />Reproducir
            </button>
            <button onClick={guardar} disabled={n === 0} className="hb-s2" title="Crear una lista de canciones con este orden" style={{ ...botonSecundario(42), ...enUnaLinea, ...ocupadoStyle(n === 0) }}>
              <Save size={16} />Guardar como lista…
            </button>
            <button onClick={vaciar} disabled={n === 0} className="hb-danger" style={{ ...botonSecundario(42), ...enUnaLinea, ...ocupadoStyle(n === 0) }}>
              <Trash2 size={16} />Vaciar
            </button>
          </div>
        </div>
      </div>

      {n === 0 ? (
        <Empty
          compact
          icon={<ListOrdered size={42} strokeWidth={1.6} />}
          title="La lista temporal está vacía"
          desc="Arrastra canciones desde la biblioteca hasta aquí o hasta «Lista temporal» en la barra lateral, o usa «Agregar a la lista temporal» en el menú de cada canción. Suenan una detrás de otra."
          action={
            <button onClick={verTodaLaBiblioteca} className="hb-primary" style={emptyBtnPrimary}>
              Ir a la biblioteca
            </button>
          }
        />
      ) : (
        <div style={{ padding: "8px 24px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: GRID, alignItems: "center", gap: 8, padding: "8px 8px 9px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, letterSpacing: ".4px", textTransform: "uppercase", color: "var(--text-3)" }}>
            <span /><span style={{ textAlign: "center" }}>#</span><span>Título</span><span style={{ textAlign: "right" }}>Dur.</span><span />
          </div>
          <div role="list" aria-label={NOMBRE_TEMPORAL}>
            {filas.map((t, i) => (
              <FilaTemporal key={t.id} t={t} num={i + 1} total={n} />
            ))}
          </div>
          <p aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
            {reorderNotice}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 8px", color: "var(--text-3)", fontSize: "12.5px" }}>
            <ArrowUpDown size={14} style={{ flex: "0 0 auto" }} />
            <span>
              Arrastra para cambiar el orden, o usa los botones de cada fila. Con el teclado: <kbd>Alt</kbd> + <kbd>↑</kbd> / <kbd>↓</kbd> para mover y <kbd>Supr</kbd> para quitar.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
