import { memo, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowUpDown, BookmarkMinus, BookmarkPlus, Share2, ChevronDown, ChevronUp, Copy, EllipsisVertical, GripVertical, Hourglass, ListMusic, ListPlus, MonitorPlay, Pencil, Play, Printer, Trash2, Video } from "lucide-react";
import { elementosDeLista, plDur, useStore } from "../store";
import { coverStyle, gradientFor, inicialDe } from "../lib/covers";
import { etiquetaDeTipo, resumenDeOrden } from "../lib/momentos";
import { botonPrimario, botonSecundario, emptyBtnPrimary, emptyBtnSecondary, ocasionBadge, ocupadoStyle } from "../lib/styles";
import type { Momento, Track } from "../lib/types";
import Empty from "./Empty";
import GlifoDePista from "./GlifoDePista";
import IconoDeMomento from "./IconoDeMomento";

const GRID = "26px 26px minmax(150px,3fr) 116px 58px 86px";

const menuItem = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  width: "100%",
  padding: "9px 11px",
  borderRadius: 8,
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "left",
} as const;

/**
 * Un botón de la fila de acciones del culto: su rótulo en una línea, sin
 * encogerse. Lo que no cabe baja entero a la siguiente fila; partido en dos
 * líneas empujaba «Imprimir» fuera de la cabecera a 800 px.
 */
const enUnaLinea: CSSProperties = { whiteSpace: "nowrap", flex: "0 0 auto" };

/** Shared empty order, so an absent list does not hand out a fresh array each read. */
const VACIA: string[] = [];

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
      <div><span style={ocasionBadge}>{t.ocasion}</span></div>
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

/**
 * Un momento sin música del culto: una oración, una lectura (#145).
 *
 * Se arrastra, se sube y se baja como una pista —es un sitio más en el orden—,
 * pero no tiene carátula ni duración ni se reproduce: en su lugar, un icono de
 * su tipo, y Intro o el doble clic abren lo que dice para cambiarlo.
 */
const MomentoRow = memo(function MomentoRow({ m, num, total }: { m: Momento; num: number; total: number }) {
  const dragging = useStore((s) => s.draggingId === m.id);
  const over = useStore((s) => s.overId === m.id && !!s.draggingId && s.draggingId !== m.id);
  const setDragging = useStore((s) => s.setDragging);
  const setOver = useStore((s) => s.setOver);
  const reorderPl = useStore((s) => s.reorderPl);
  const clearDrag = useStore((s) => s.clearDrag);
  const removeFromPl = useStore((s) => s.removeFromPl);
  const moveInPlaylist = useStore((s) => s.moveInPlaylist);
  const editarMomento = useStore((s) => s.editarMomento);

  const primera = num === 1;
  const ultima = num === total;
  const tipo = etiquetaDeTipo(m.tipo);

  return (
    <div
      className="lib-row"
      role="listitem"
      tabIndex={0}
      aria-label={`${num} de ${total}, momento sin música: ${m.titulo}${m.texto ? `, ${m.texto}` : ""}`}
      draggable
      onDragStart={() => setDragging(m.id)}
      onDragOver={(e) => { e.preventDefault(); setOver(m.id); }}
      onDrop={(e) => { e.preventDefault(); reorderPl(m.id); }}
      onDragEnd={clearDrag}
      onDoubleClick={() => editarMomento(m.id)}
      onKeyDown={(e) => {
        if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault();
          moveInPlaylist(m.id, e.key === "ArrowUp" ? -1 : 1);
        } else if (e.key === "Enter") {
          e.preventDefault();
          editarMomento(m.id);
        }
      }}
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        alignItems: "center",
        gap: 8,
        padding: "7px 8px",
        borderRadius: 10,
        transition: "background .12s,box-shadow .12s,opacity .12s",
        ...(over ? { boxShadow: "inset 0 2px 0 0 var(--primary)" } : {}),
        ...(dragging ? { opacity: 0.4 } : {}),
      }}
    >
      <div title="Arrastrar para reordenar" className="hb-text" style={{ display: "grid", placeItems: "center", color: "var(--text-3)", cursor: "grab" }}>
        <GripVertical size={16} />
      </div>
      <span style={{ textAlign: "center", fontSize: "12.5px", color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>{num}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        {/* Del tamaño de una carátula, pero sin serlo: punteado y sin color,
            para que se lea como un hueco en la música y no como otra canción. */}
        <div style={{ width: 40, height: 40, flex: "0 0 auto", borderRadius: 8, border: "1px dashed var(--border-2)", color: "var(--text-2)", display: "grid", placeItems: "center" }}>
          <IconoDeMomento tipo={m.tipo} size={18} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.titulo}</div>
          <div style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {m.texto || "Sin música · la proyección espera a «Siguiente»"}
          </div>
        </div>
      </div>
      <div><span style={{ fontSize: 12, color: "var(--text-2)" }}>{tipo}</span></div>
      <div style={{ fontSize: "12.5px", color: "var(--text-3)", textAlign: "right" }} aria-hidden>—</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <button
          onClick={() => moveInPlaylist(m.id, -1)}
          disabled={primera}
          title="Subir en la lista"
          aria-label={`Subir «${m.titulo}» en la lista`}
          className="hb-s2t"
          style={{ width: 24, height: 28, borderRadius: 7, display: "grid", placeItems: "center", color: "var(--text-3)", ...ocupadoStyle(primera) }}
        >
          <ChevronUp size={15} />
        </button>
        <button
          onClick={() => moveInPlaylist(m.id, 1)}
          disabled={ultima}
          title="Bajar en la lista"
          aria-label={`Bajar «${m.titulo}» en la lista`}
          className="hb-s2t"
          style={{ width: 24, height: 28, borderRadius: 7, display: "grid", placeItems: "center", color: "var(--text-3)", ...ocupadoStyle(ultima) }}
        >
          <ChevronDown size={15} />
        </button>
        <button onClick={() => editarMomento(m.id)} title="Editar el momento" aria-label={`Editar «${m.titulo}»`} className="hb-s2t" style={{ width: 28, height: 28, borderRadius: 7, display: "grid", placeItems: "center", color: "var(--text-3)" }}>
          <Pencil size={14} />
        </button>
        <button onClick={() => removeFromPl(m.id)} title="Quitar del culto" aria-label={`Quitar «${m.titulo}» del culto`} className="hb-danger" style={{ width: 28, height: 28, borderRadius: 7, display: "grid", placeItems: "center", color: "var(--text-3)" }}>
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
  const rows = useStore(elementosDeLista);
  const nuevoMomento = useStore((s) => s.nuevoMomento);
  const duracion = useStore((s) => plDur(s, s.plOrder[s.curPlaylist] || VACIA));
  const playAll = useStore((s) => s.playAll);
  const showProyeccion = useStore((s) => s.showProyeccion);
  const openPrintPreview = useStore((s) => s.openPrintPreview);
  const editCurrentList = useStore((s) => s.editCurrentList);
  const deleteCurrentList = useStore((s) => s.deleteCurrentList);
  const duplicateCurrentList = useStore((s) => s.duplicateCurrentList);
  const toggleCurrentTemplate = useStore((s) => s.toggleCurrentTemplate);
  const shareCurrentList = useStore((s) => s.shareCurrentList);
  const abrirAgregarCanciones = useStore((s) => s.abrirAgregarCanciones);
  const reorderNotice = useStore((s) => s.reorderNotice);
  const arrastrandoDesdeBiblioteca = useStore((s) => s.dragFromLibrary.length);
  const bulkAddToPlaylist = useStore((s) => s.bulkAddToPlaylist);
  const endLibraryDrag = useStore((s) => s.endLibraryDrag);
  const [sobreLaLista, setSobreLaLista] = useState(false);

  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* hero */}
      <div style={{ display: "flex", gap: 22, padding: "28px 24px 24px", alignItems: "flex-end", background: "linear-gradient(180deg,var(--surface-2),transparent)" }}>
        <div style={{ position: "relative", width: 148, height: 148, flex: "0 0 auto", borderRadius: 16, overflow: "hidden", boxShadow: "var(--sh-md)" }}>
          <div style={gradientFor(curPlaylist, 150)} />
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <span className="display" style={{ fontSize: 58, color: "rgba(255,255,255,.9)" }}>{inicialDe(pl?.nombre ?? "")}</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingBottom: 2 }}>
          {/* El sobrescrito dice la ocasión, no «Lista para culto». Eso último
              lo sabe cualquiera que esté mirando esta pantalla; la ocasión es
              lo que distingue un domingo de un ensayo. Una lista sin ocasión
              —las importadas y las viejas pueden no tenerla— vuelve al rótulo
              genérico antes que dejar el hueco. */}
          <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 8 }}>
            {pl?.plantilla ? "Plantilla" : pl?.ocasion?.trim() || "Lista para culto"}
          </span>
          <h1 className="display" style={{ fontSize: 34, lineHeight: 1.05, margin: "0 0 10px", textWrap: "balance" } as CSSProperties}>{pl?.nombre}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 14, color: "var(--text-2)", fontSize: 13, fontWeight: 500, flexWrap: "wrap" }}>
            <span>{resumenDeOrden(order)} · {duracion}</span>
          </div>
          <div data-acciones-culto style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
            <button onClick={playAll} className="hb-primary hb-active-scale" style={{ ...botonPrimario(42), ...enUnaLinea, fontWeight: 700, transition: "background .14s,transform .08s" }}>
              <Play size={17} fill="currentColor" stroke="none" />Reproducir todo
            </button>
            {/* Armar el culto sin salir de él: elegir varias de la biblioteca de
                una vez, en lugar de ir y volver por cada canción. */}
            <button onClick={abrirAgregarCanciones} className="hb-s2" title="Elegir varias canciones de la biblioteca" style={{ ...botonSecundario(42), ...enUnaLinea }}>
              <ListPlus size={16} />Agregar canciones…
            </button>
            {/* El documento pone «Proyectar» aquí, entre reproducir e
                imprimir. En la etapa 4 se quedó fuera porque no había a dónde
                ir; ahora sí, y es la única puerta: se proyecta el culto que
                está abierto. */}
            <button onClick={() => showProyeccion()} className="hb-s2" title="Sacar el culto por el proyector"
              style={{ ...botonSecundario(42), ...enUnaLinea }}>
              <MonitorPlay size={16} />Proyectar
            </button>
            {/* Era «Exportar», que escribía un .html y lo abría en el
                navegador para que allí alguien pulsara Cmd/Ctrl+P. Lo que se
                quería era la hoja; el archivo suelto era el peaje. Guardar el
                .html sigue estando, dentro de la vista previa. */}
            <button onClick={openPrintPreview} className="hb-s2" style={{ ...botonSecundario(42), ...enUnaLinea }}>
              <Printer size={16} />Imprimir
            </button>
            <div style={{ position: "relative", flex: "0 0 auto" }}>
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
                    <button onClick={() => { setMenuOpen(false); nuevoMomento(); }} className="hb-s2" style={menuItem}>
                      <Hourglass size={15} />Añadir un momento…
                    </button>
                    <button onClick={() => { setMenuOpen(false); duplicateCurrentList(); }} className="hb-s2" style={menuItem}>
                      <Copy size={15} />Duplicar lista
                    </button>
                    {/* «Exportar» ya existe y hace una hoja para imprimir.
                        Esto es lo otro: el archivo que entiende otra copia de
                        Cantoral, no una persona. */}
                    <button onClick={() => { setMenuOpen(false); shareCurrentList(); }} className="hb-s2" style={menuItem}>
                      <Share2 size={15} />Enviar a otra instalación
                    </button>
                    <button onClick={() => { setMenuOpen(false); toggleCurrentTemplate(); }} className="hb-s2" style={menuItem}>
                      {pl?.plantilla ? <BookmarkMinus size={15} /> : <BookmarkPlus size={15} />}
                      {pl?.plantilla ? "Quitar de plantillas" : "Guardar como plantilla"}
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
          desc="Elige de la biblioteca las canciones de este culto; puedes marcar varias de una vez."
          action={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              {/* Era «Ir a la biblioteca», que sacaba de aquí para ir trayendo
                  las canciones de una en una. Esto las trae sin salir. */}
              <button onClick={abrirAgregarCanciones} className="hb-primary" style={emptyBtnPrimary}>
                <ListPlus size={16} />Agregar canciones…
              </button>
              <button onClick={nuevoMomento} className="hb-s2" style={emptyBtnSecondary}>
                <Hourglass size={16} />Añadir un momento…
              </button>
            </div>
          }
        />
      ) : (
        <div
          onDragOver={(e) => {
            if (!arrastrandoDesdeBiblioteca) return;
            e.preventDefault();
            setSobreLaLista(true);
          }}
          onDragLeave={() => setSobreLaLista(false)}
          onDrop={(e) => {
            if (!arrastrandoDesdeBiblioteca) return;
            e.preventDefault();
            setSobreLaLista(false);
            bulkAddToPlaylist(curPlaylist);
            endLibraryDrag();
          }}
          style={{ padding: "8px 24px 0", ...(sobreLaLista ? { outline: "2px dashed var(--primary)", outlineOffset: -6, borderRadius: 14 } : {}) }}
        >
          <div style={{ display: "grid", gridTemplateColumns: GRID, alignItems: "center", gap: 8, padding: "8px 8px 9px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, letterSpacing: ".4px", textTransform: "uppercase", color: "var(--text-3)" }}>
            <span /><span style={{ textAlign: "center" }}>#</span><span>Título</span><span>Ocasión</span><span style={{ textAlign: "right" }}>Dur.</span><span />
          </div>
          <div role="list">
            {rows.map((e, i) =>
              e.clase === "pista" ? (
                <PlRow key={e.id} t={e.pista} num={i + 1} total={rows.length} />
              ) : (
                <MomentoRow key={e.id} m={e.momento} num={i + 1} total={rows.length} />
              ),
            )}
          </div>
          {/* Moving a row is silent otherwise: the list re-renders, but nothing
              says where the song ended up. */}
          <p aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
            {reorderNotice}
          </p>
          {/* Una oración, una lectura, los anuncios: lo que pasa entre canción y
              canción. Entra al final y se arrastra a su sitio como una pista. */}
          <div style={{ padding: "10px 8px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={abrirAgregarCanciones} className="hb-s2" style={{ ...botonSecundario(38), height: 34, fontSize: "12.5px" }}>
              <ListPlus size={14} />Agregar canciones…
            </button>
            <button onClick={nuevoMomento} className="hb-s2" style={{ ...botonSecundario(38), height: 34, fontSize: "12.5px" }}>
              <Hourglass size={14} />Añadir un momento…
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 8px", color: "var(--text-3)", fontSize: "12.5px" }}>
            <ArrowUpDown size={14} />Arrastra las pistas para cambiar el orden del culto, o usa los botones de cada fila. Con el teclado: <kbd>Alt</kbd> + <kbd>↑</kbd> / <kbd>↓</kbd>.
          </div>
        </div>
      )}
    </div>
  );
}
