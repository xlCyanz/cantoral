import { memo, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowUpDown, Calendar, ChevronDown, ChevronUp, Download, EllipsisVertical, GripVertical, Library, ListMusic, Pencil, Play, Presentation, Trash2, Video } from "lucide-react";
import { filasDeLista, plDur, useStore } from "../store";
import { coverStyle, gradientFor, hasCover } from "../lib/covers";
import { ocasionBadge, ocupadoStyle } from "../lib/styles";
import type { Track } from "../lib/types";
import Empty, { emptyBtnSecondary } from "./Empty";

const GRID = "26px 26px minmax(150px,3fr) 116px 50px 58px 86px";

/** Shared empty order, so an absent list does not hand out a fresh array each read. */
const VACIA: string[] = [];

function CoverInner({ t }: { t: Track }) {
  if (hasCover(t)) return null;
  if (t.missing)
    return <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
  if (t.video)
    return <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.92)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" /><rect x="2" y="6" width="14" height="12" rx="2" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
}

/**
 * One row of a culto list. Like the library's row there is an instance per
 * pista, so it reads only the two drag flags it reacts to.
 */
const PlRow = memo(function PlRow({ t, num, total }: { t: Track; num: number; total: number }) {
  const dragging = useStore((s) => s.draggingId === t.id);
  const over = useStore((s) => s.overId === t.id && !!s.draggingId && s.draggingId !== t.id);
  const setDragging = useStore((s) => s.setDragging);
  const setOver = useStore((s) => s.setOver);
  const reorderPl = useStore((s) => s.reorderPl);
  const clearDrag = useStore((s) => s.clearDrag);
  const play = useStore((s) => s.play);
  const removeFromPl = useStore((s) => s.removeFromPl);
  const moveInPlaylist = useStore((s) => s.moveInPlaylist);

  const primera = num === 1;
  const ultima = num === total;

  const rowStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: GRID,
    alignItems: "center",
    gap: 8,
    padding: "7px 8px",
    borderRadius: 10,
    transition: "background .12s,box-shadow .12s,opacity .12s",
    ...(over ? { boxShadow: "inset 0 2px 0 0 var(--primary)" } : {}),
    ...(dragging ? { opacity: 0.4 } : {}),
    ...(t.missing ? { opacity: 0.7 } : {}),
  };

  return (
    <div
      className="lib-row"
      role="listitem"
      tabIndex={0}
      aria-label={`${num} de ${total}, ${t.titulo}, ${t.artista}`}
      draggable
      onDragStart={() => setDragging(t.id)}
      onDragOver={(e) => { e.preventDefault(); setOver(t.id); }}
      onDrop={(e) => { e.preventDefault(); reorderPl(t.id); }}
      onDragEnd={clearDrag}
      onDoubleClick={() => play(t.id)}
      onKeyDown={(e) => {
        // Alt, so the plain arrows keep walking the list rather than rewriting
        // it — and so a stray keypress cannot silently reorder the service.
        if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault();
          moveInPlaylist(t.id, e.key === "ArrowUp" ? -1 : 1);
        } else if (e.key === "Enter") {
          e.preventDefault();
          play(t.id);
        }
      }}
      style={rowStyle}
    >
      <div title="Arrastrar para reordenar" className="hb-text" style={{ display: "grid", placeItems: "center", color: "var(--text-3)", cursor: "grab" }}>
        <GripVertical size={16} />
      </div>
      <span style={{ textAlign: "center", fontSize: "12.5px", color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>{num}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        <div style={coverStyle(t, 40)}><CoverInner t={t} /></div>
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
      <div><span style={ocasionBadge}>{t.ocasion}</span></div>
      <div style={{ fontSize: "12.5px", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{t.tono}</div>
      <div style={{ fontSize: "12.5px", color: "var(--text-2)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{t.dur}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        {/* Visible buttons, not just the drag handle: precise dragging is a
            skill the app should not require to change the order of a service. */}
        <button
          onClick={() => moveInPlaylist(t.id, -1)}
          disabled={primera}
          title="Subir en la lista"
          aria-label={`Subir «${t.titulo}» en la lista`}
          className="hb-s2t"
          style={{ width: 24, height: 28, borderRadius: 7, display: "grid", placeItems: "center", color: "var(--text-3)", ...ocupadoStyle(primera) }}
        >
          <ChevronUp size={15} />
        </button>
        <button
          onClick={() => moveInPlaylist(t.id, 1)}
          disabled={ultima}
          title="Bajar en la lista"
          aria-label={`Bajar «${t.titulo}» en la lista`}
          className="hb-s2t"
          style={{ width: 24, height: 28, borderRadius: 7, display: "grid", placeItems: "center", color: "var(--text-3)", ...ocupadoStyle(ultima) }}
        >
          <ChevronDown size={15} />
        </button>
        <button onClick={() => removeFromPl(t.id)} title="Quitar de la lista" aria-label={`Quitar «${t.titulo}» de la lista`} className="hb-danger" style={{ width: 28, height: 28, borderRadius: 7, display: "grid", placeItems: "center", color: "var(--text-3)" }}>
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
});

export default function PlaylistView() {
  const [menuOpen, setMenuOpen] = useState(false);
  const curPlaylist = useStore((s) => s.curPlaylist);
  const pl = useStore((s) => s.playlists.find((p) => p.id === s.curPlaylist));
  const order = useStore((s) => s.plOrder[s.curPlaylist] || VACIA);
  const rows = useStore(filasDeLista);
  const duracion = useStore((s) => plDur(s, s.plOrder[s.curPlaylist] || VACIA));
  const playAll = useStore((s) => s.playAll);
  const openService = useStore((s) => s.openService);
  const exportPl = useStore((s) => s.exportPl);
  const editCurrentList = useStore((s) => s.editCurrentList);
  const deleteCurrentList = useStore((s) => s.deleteCurrentList);
  const showBiblioteca = useStore((s) => s.showBiblioteca);
  const reorderNotice = useStore((s) => s.reorderNotice);

  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* hero */}
      <div style={{ display: "flex", gap: 22, padding: "28px 24px 24px", alignItems: "flex-end", background: "linear-gradient(180deg,var(--surface-2),transparent)" }}>
        <div style={{ position: "relative", width: 148, height: 148, flex: "0 0 auto", borderRadius: 16, overflow: "hidden", boxShadow: "var(--sh-md)" }}>
          <div style={gradientFor(curPlaylist)} />
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <ListMusic size={58} color="rgba(255,255,255,.92)" strokeWidth={1.4} />
          </div>
        </div>
        <div style={{ minWidth: 0, paddingBottom: 2 }}>
          <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: "var(--primary)", background: "var(--primary-soft)", padding: "3px 10px", borderRadius: 7, marginBottom: 10 }}>
            Lista para culto
          </span>
          <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.8px", lineHeight: 1.05, margin: "0 0 10px", textWrap: "balance" } as CSSProperties}>{pl?.nombre}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 14, color: "var(--text-2)", fontSize: 13, fontWeight: 500, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Calendar size={15} />{pl?.fecha}</span>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-3)" }} />
            <span>{order.length} pistas · {duracion}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
            <button onClick={playAll} className="hb-primary hb-active-scale" style={{ height: 42, display: "flex", alignItems: "center", gap: 9, padding: "0 20px", borderRadius: 11, background: "var(--primary)", color: "var(--on-primary)", fontSize: 14, fontWeight: 700, boxShadow: "var(--sh-sm)", transition: "background .14s,transform .08s" }}>
              <Play size={17} fill="currentColor" stroke="none" />Reproducir todo
            </button>
            <button onClick={openService} className="hb-s2" title="Letras y acordes a pantalla completa" style={{ height: 42, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderRadius: 11, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "13.5px", fontWeight: 600, transition: "background .14s" }}>
              <Presentation size={16} />Modo culto
            </button>
            <button onClick={exportPl} className="hb-s2" style={{ height: 42, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderRadius: 11, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "13.5px", fontWeight: 600, transition: "background .14s" }}>
              <Download size={16} />Exportar
            </button>
            <div style={{ position: "relative" }}>
              <button title="Más acciones" onClick={() => setMenuOpen((v) => !v)} className="hb-s2t" style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 11, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text-2)" }}>
                <EllipsisVertical size={18} />
              </button>
              {menuOpen && (
                <>
                  <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
                  <div style={{ position: "absolute", right: 0, top: 48, zIndex: 21, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 11, boxShadow: "var(--sh-md)", padding: 5, minWidth: 190 }}>
                    <button onClick={() => { setMenuOpen(false); editCurrentList(); }} className="hb-s2" style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 11px", borderRadius: 8, color: "var(--text)", fontSize: 13, fontWeight: 600, textAlign: "left" }}>
                      <Pencil size={15} />Editar lista
                    </button>
                    <button onClick={() => { setMenuOpen(false); deleteCurrentList(); }} className="hb-danger" style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 11px", borderRadius: 8, color: "var(--danger)", fontSize: 13, fontWeight: 600, textAlign: "left" }}>
                      <Trash2 size={15} />Eliminar lista
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* track list */}
      {rows.length === 0 ? (
        <Empty
          compact
          icon={<ListMusic size={42} strokeWidth={1.6} />}
          title="Esta lista está vacía"
          desc="Agrega pistas desde la Biblioteca para armar el repertorio de este culto."
          action={
            <button onClick={showBiblioteca} className="hb-s2" style={emptyBtnSecondary}>
              <Library size={16} />Ir a la biblioteca
            </button>
          }
        />
      ) : (
        <div style={{ padding: "8px 24px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: GRID, alignItems: "center", gap: 8, padding: "8px 8px 9px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, letterSpacing: ".4px", textTransform: "uppercase", color: "var(--text-3)" }}>
            <span /><span style={{ textAlign: "center" }}>#</span><span>Título</span><span>Ocasión</span><span>Tono</span><span style={{ textAlign: "right" }}>Dur.</span><span />
          </div>
          <div role="list">
            {rows.map((t, i) => (
              <PlRow key={t.id} t={t} num={i + 1} total={rows.length} />
            ))}
          </div>
          {/* Moving a row is silent otherwise: the list re-renders, but nothing
              says where the song ended up. */}
          <p aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
            {reorderNotice}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 8px", color: "var(--text-3)", fontSize: "12.5px" }}>
            <ArrowUpDown size={14} />Arrastra las pistas para cambiar el orden del culto, o usa los botones de cada fila. Con el teclado: <kbd>Alt</kbd> + <kbd>↑</kbd> / <kbd>↓</kbd>.
          </div>
        </div>
      )}
    </div>
  );
}
