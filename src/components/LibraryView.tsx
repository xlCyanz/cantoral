import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Clock, FolderPlus, Heart, Play, RefreshCw, Search, SquareArrowOutUpRight, TriangleAlert, Video } from "lucide-react";
import type { CSSProperties } from "react";
import { applyFilters, buildGroups, useStore } from "../store";
import { SCAN_FILES } from "../lib/seed";
import { coverStyle, hasCover } from "../lib/covers";
import Empty, { emptyBtnSecondary } from "./Empty";
import { favBtnStyle, ocasionBadge, thProps } from "../lib/styles";
import { ALTO_FILA, ALTO_GRUPO, DESDE, altoTotal, aplanar, ventana } from "../lib/virtual";
import type { SortKey, Track } from "../lib/types";

const GRID = "32px minmax(150px,3fr) minmax(90px,1.5fr) 104px 48px 62px 72px";

/** White glyph shown inside a cover swatch, keyed by track state. */
function CoverInner({ t }: { t: Track }) {
  if (hasCover(t)) return null;
  if (t.missing)
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.92)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" /><path d="M12 17h.01" />
      </svg>
    );
  if (t.video)
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.92)" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
        <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
        <rect x="2" y="6" width="14" height="12" rx="2" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function Equalizer() {
  const bar: CSSProperties = { width: 3, height: 14, background: "var(--primary)", borderRadius: 2, transformOrigin: "bottom" };
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 15 }}>
      <span style={{ ...bar, animation: "canEq .9s ease-in-out infinite" }} />
      <span style={{ ...bar, animation: "canEq .9s ease-in-out .3s infinite" }} />
      <span style={{ ...bar, animation: "canEq .9s ease-in-out .6s infinite" }} />
    </div>
  );
}

/**
 * One row of the library.
 *
 * There is an instance per pista, so it subscribes to the two booleans it
 * actually reacts to instead of the whole store — the player writes `posSec`
 * several times a second, and a row that reads the store wholesale repaints
 * the entire table along with it. Actions are read through the store too, but
 * they are created once and never replaced, so they never cause a render.
 */
const TrackRow = memo(function TrackRow({ t, num }: { t: Track; num: number }) {
  const playing = useStore((s) => s.playerId === t.id && s.playing);
  const sel = useStore((s) => s.selId === t.id && s.detailOpen);
  const onRowClick = useStore((s) => s.onRowClick);
  const play = useStore((s) => s.play);
  const onFav = useStore((s) => s.onFav);
  const onOpenExternal = useStore((s) => s.onOpenExternal);

  const rowStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: GRID,
    alignItems: "center",
    gap: 8,
    // Pinned rather than left to the content, so the windowing math above can
    // predict where every row lands without measuring the DOM.
    height: ALTO_FILA,
    boxSizing: "border-box",
    padding: "8px 10px",
    borderRadius: 11,
    cursor: "default",
    transition: "background .13s",
    ...(sel ? { background: "var(--primary-soft)", boxShadow: "inset 0 0 0 1px var(--primary-soft-2)" } : {}),
    ...(t.missing ? { opacity: 0.72 } : {}),
  };

  return (
    <div
      className="lib-row"
      tabIndex={0}
      aria-label={`${t.titulo}, ${t.artista}${t.tono ? `, tono ${t.tono}` : ""}, ${t.dur}${t.missing ? ", sin archivo" : ""}`}
      aria-selected={sel}
      onClick={() => onRowClick(t.id)}
      onDoubleClick={() => play(t.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          // Enter opens the detail panel; ⌘/Ctrl+Enter starts playback.
          if (e.metaKey || e.ctrlKey) play(t.id);
          else onRowClick(t.id);
        }
      }}
      style={rowStyle}
    >
      {/* index / play */}
      <div style={{ width: 32, height: 34, display: "grid", placeItems: "center", position: "relative" }}>
        {playing ? (
          <Equalizer />
        ) : (
          <>
            <span style={{ fontSize: "12.5px", color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>{num}</span>
            <button
              onClick={(e) => { e.stopPropagation(); play(t.id); }}
              title={t.video ? "Abrir en el reproductor del sistema" : "Reproducir"}
              className="row-play"
              style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--text)", borderRadius: 7 }}
            >
              {t.video ? <SquareArrowOutUpRight size={13} /> : <Play size={14} fill="currentColor" stroke="none" />}
            </button>
          </>
        )}
      </div>

      {/* title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={coverStyle(t, 40)}><CoverInner t={t} /></div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...(sel ? { color: "var(--primary)" } : {}) }}>
            {t.titulo}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
            <span style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.artista}</span>
            {t.missing && (
              <span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 3, fontSize: "10.5px", fontWeight: 600, color: "var(--danger)", background: "var(--danger-soft)", padding: "1px 6px", borderRadius: 5 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" style={{ width: 10, height: 10 }}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                Sin archivo
              </span>
            )}
            {t.video && (
              <span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 3, fontSize: "10.5px", fontWeight: 600, color: "var(--text-2)", background: "var(--surface-3)", padding: "1px 6px", borderRadius: 5 }}>
                <Video size={11} />Video
              </span>
            )}
          </div>
        </div>
      </div>

      {/* album */}
      <div style={{ fontSize: "12.5px", color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.album}</div>
      {/* ocasion */}
      <div><span style={ocasionBadge}>{t.ocasion}</span></div>
      {/* tono */}
      <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{t.tono}</div>
      {/* dur */}
      <div style={{ fontSize: "12.5px", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{t.dur}</div>
      {/* actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
        <button onClick={(e) => { e.stopPropagation(); onFav(t.id); }} title="Favorita" aria-label={t.fav ? `Quitar «${t.titulo}» de favoritas` : `Marcar «${t.titulo}» como favorita`} aria-pressed={t.fav} className="hb-s3" style={favBtnStyle(t.fav)}>
          <Heart size={15} fill={t.fav ? "currentColor" : "none"} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onOpenExternal(t.id); }} title="Abrir en el reproductor del sistema" aria-label={`Abrir «${t.titulo}» en el reproductor del sistema`} className="hb-s3t" style={{ width: 28, height: 28, borderRadius: 7, display: "grid", placeItems: "center", color: "var(--text-3)" }}>
          <SquareArrowOutUpRight size={14} />
        </button>
      </div>
    </div>
  );
});

/** Heading that opens a group when the table is grouped. */
function GroupHeader({ label, countLabel }: { label: string; countLabel: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, height: ALTO_GRUPO, boxSizing: "border-box", padding: "16px 12px 7px" }}>
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".2px" }}>{label}</span>
      <span style={{ fontSize: "11.5px", color: "var(--text-3)", fontWeight: 500 }}>{countLabel}</span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

function ColumnHeader() {
  const sortKey = useStore((s) => s.sortKey);
  const sortDir = useStore((s) => s.sortDir);
  const onSortHeader = useStore((s) => s.onSortHeader);
  const cols: { key: SortKey; label: string; icon?: boolean }[] = [
    { key: "titulo", label: "Título" },
    { key: "album", label: "Álbum" },
    { key: "ocasion", label: "Ocasión" },
    { key: "tono", label: "Tono" },
    { key: "dur", label: "", icon: true },
  ];
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: GRID, alignItems: "center", gap: 8, padding: "10px 10px 9px", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", fontWeight: 600 }}>#</span>
      {cols.map((c) => {
        const { style, arrow } = thProps(c.key, sortKey, sortDir);
        return (
          <button
            key={c.key}
            onClick={() => onSortHeader(c.key)}
            aria-label={`Ordenar por ${c.label || "duración"}${
              sortKey === c.key ? (sortDir === "asc" ? ", ascendente" : ", descendente") : ""
            }`}
            style={style}
          >
            {c.icon ? <Clock size={14} /> : c.label} {arrow}
          </button>
        );
      })}
      <span />
    </div>
  );
}

function EmptyState() {
  const openAddFolder = useStore((s) => s.openAddFolder);
  const openHelp = useStore((s) => s.openHelp);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 40, animation: "canFade .3s ease" }}>
      <div style={{ width: 104, height: 104, borderRadius: "50%", background: "var(--primary-soft)", display: "grid", placeItems: "center", marginBottom: 26, position: "relative" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: 46, height: 46 }}>
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
        <div style={{ position: "absolute", bottom: -2, right: -2, width: 38, height: 38, borderRadius: "50%", background: "var(--primary)", display: "grid", placeItems: "center", border: "3px solid var(--bg)", boxShadow: "var(--sh-sm)" }}>
          <FolderPlus size={18} color="var(--on-primary)" strokeWidth={2.2} />
        </div>
      </div>
      <h2 className="serif" style={{ fontSize: 32, margin: "0 0 10px" }}>Tu biblioteca está vacía</h2>
      <p style={{ fontSize: "14.5px", color: "var(--text-2)", maxWidth: 420, lineHeight: 1.55, margin: "0 0 26px" }}>
        Agrega una carpeta con tus pistas y coros. Cantoral la revisará y organizará tu música automáticamente, sin mover ni copiar tus archivos.
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={openAddFolder} className="hb-primary" style={{ height: 44, display: "flex", alignItems: "center", gap: 9, padding: "0 20px", borderRadius: 11, background: "var(--primary)", color: "var(--on-primary)", fontSize: 14, fontWeight: 600, boxShadow: "var(--sh-sm)", transition: "background .14s" }}>
          <FolderPlus size={18} strokeWidth={2.2} />Agregar carpeta de música
        </button>
        <button onClick={openHelp} className="hb-s2" style={{ height: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 18px", borderRadius: 11, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: 14, fontWeight: 600, transition: "background .14s" }}>
          ¿Cómo funciona?
        </button>
      </div>
    </div>
  );
}

function ScanningState() {
  const scanPct = useStore((s) => s.scanPct);
  const scanIdx = useStore((s) => s.scanIdx);
  const scanFile = useStore((s) => s.scanFile);
  const cancelScan = useStore((s) => s.cancelScan);
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 40, animation: "canFade .3s ease" }}>
      <div style={{ width: "100%", maxWidth: 460, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, boxShadow: "var(--sh-md)", padding: "30px 30px 26px", textAlign: "center" }}>
        <div style={{ width: 66, height: 66, margin: "0 auto 20px", position: "relative", display: "grid", placeItems: "center" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--border-2)" strokeWidth={2} style={{ width: 66, height: 66, position: "absolute" }}><circle cx="12" cy="12" r="10" /></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" style={{ width: 66, height: 66, position: "absolute", animation: "canSpin 1s linear infinite" }}><path d="M12 2a10 10 0 0 1 10 10" /></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /></svg>
        </div>
        <h2 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 6px" }}>Escaneando tu música…</h2>
        <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 22px" }}>Indexando metadatos. Puedes seguir usando la app mientras tanto.</p>
        <div
          role="progressbar"
          aria-label="Progreso del escaneo"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(scanPct)}
          style={{ height: 9, borderRadius: 6, background: "var(--surface-3)", overflow: "hidden", marginBottom: 11 }}
        >
          <div style={{ width: scanPct + "%", height: "100%", borderRadius: 6, background: "linear-gradient(90deg,var(--primary),var(--primary-hover))", transition: "width .16s linear" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-2)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", flex: "0 0 auto", animation: "canScanPulse 1s ease-in-out infinite" }} />
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "ui-monospace,monospace", fontSize: 11 }}>{scanFile || SCAN_FILES[scanIdx] || ""}</span>
          </span>
          <span style={{ flex: "0 0 auto", fontWeight: 600, color: "var(--text)", fontVariantNumeric: "tabular-nums", paddingLeft: 12 }}>{Math.round(scanPct)}%</span>
        </div>
        <button onClick={cancelScan} className="hb-s2" style={{ marginTop: 22, height: 36, padding: "0 16px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: 13, fontWeight: 600 }}>Cancelar</button>
      </div>
    </div>
  );
}

function ErrorState() {
  const scanError = useStore((s) => s.scanError);
  const retryError = useStore((s) => s.retryError);
  const showConfig = useStore((s) => s.showConfig);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 40, animation: "canFade .3s ease" }}>
      <div style={{ width: 96, height: 96, borderRadius: "50%", background: "var(--danger-soft)", display: "grid", placeItems: "center", marginBottom: 24 }}>
        <TriangleAlert size={44} color="var(--danger)" strokeWidth={1.7} />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 10px" }}>No pudimos leer esta carpeta</h2>
      <p style={{ fontSize: 14, color: "var(--text-2)", maxWidth: 430, lineHeight: 1.55, margin: "0 0 8px" }}>
        La unidad puede estar desconectada o la carpeta fue movida. Verifica que esté disponible e inténtalo otra vez.
      </p>
      {scanError && (
        <code style={{ fontSize: 12, color: "var(--text-3)", background: "var(--surface-2)", border: "1px solid var(--border)", padding: "5px 11px", borderRadius: 8, maxWidth: 460, textAlign: "left", overflowWrap: "anywhere" }}>{scanError}</code>
      )}
      <div style={{ display: "flex", gap: 12, marginTop: 26 }}>
        <button onClick={retryError} className="hb-primary" style={{ height: 44, display: "flex", alignItems: "center", gap: 9, padding: "0 20px", borderRadius: 11, background: "var(--primary)", color: "var(--on-primary)", fontSize: 14, fontWeight: 600, boxShadow: "var(--sh-sm)", transition: "background .14s" }}>
          <RefreshCw size={17} strokeWidth={2.2} />Reintentar
        </button>
        <button onClick={showConfig} className="hb-s2" style={{ height: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 18px", borderRadius: 11, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: 14, fontWeight: 600, transition: "background .14s" }}>
          Administrar carpetas
        </button>
      </div>
    </div>
  );
}

/** Nearest ancestor that actually scrolls — the view's `<main>`, in practice. */
function contenedorConScroll(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const desborde = getComputedStyle(p).overflowY;
    if (desborde === "auto" || desborde === "scroll") return p;
  }
  return null;
}

/**
 * The table itself.
 *
 * Split off from the view so the state screens above can return early without
 * the windowing hooks having to run for them.
 */
function Tabla() {
  const list = useStore(applyFilters);
  // Both selectors hand back the same array as long as nothing they read
  // changed, so this only re-runs when the library really is different.
  const groups = useStore((s) => buildGroups(s, list));
  const query = useStore((s) => s.query);

  const plano = useMemo(() => aplanar(groups), [groups]);
  const ventanear = plano.filas.length >= DESDE;

  const hueco = useRef<HTMLDivElement>(null);
  // Enough rows to fill any viewport on the first paint; the effect below
  // corrects the range as soon as the real geometry is known.
  const [rango, setRango] = useState({ desde: 0, hasta: 40 });

  useEffect(() => {
    if (!ventanear) return;
    const caja = hueco.current;
    const scroller = caja && contenedorConScroll(caja);
    if (!caja || !scroller) {
      // Without a scrolling ancestor there is no offset to read, so the table
      // falls back to mounting whole rather than showing a sliver of rows over
      // an expanse of nothing.
      setRango({ desde: 0, hasta: plano.filas.length });
      return;
    }
    const medir = () => {
      const c = scroller.getBoundingClientRect();
      const f = caja.getBoundingClientRect();
      const r = ventana(plano, c.top - f.top, scroller.clientHeight);
      // Only a range that actually moved is worth a render — a scroll of a few
      // pixels usually leaves the same rows on screen.
      setRango((previo) => (previo.desde === r.desde && previo.hasta === r.hasta ? previo : r));
    };
    medir();
    scroller.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => {
      scroller.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
  }, [ventanear, plano]);

  if (list.length === 0) {
    return (
      <Empty
        icon={<Search size={40} />}
        title="Sin resultados"
        desc={query ? `No encontramos nada para «${query}».` : "Ninguna canción coincide con este filtro."}
        action={
          <button onClick={() => useStore.setState({ query: "", qf: null, ocasion: null })} className="hb-s2" style={emptyBtnSecondary}>
            Limpiar filtros
          </button>
        }
      />
    );
  }

  // Windowing is off both below the threshold and when the range covers the
  // whole table, which is what the fallback above leaves behind.
  const recortado = ventanear && rango.hasta - rango.desde < plano.filas.length;
  const visibles = recortado ? plano.filas.slice(rango.desde, rango.hasta) : plano.filas;

  return (
    <div style={{ padding: "6px 16px 22px" }}>
      <ColumnHeader />
      {/* Holds the scrollbar open for the rows that are not mounted. */}
      <div ref={hueco} style={recortado ? { height: altoTotal(plano) } : undefined}>
        <div style={recortado ? { transform: `translateY(${plano.offsets[rango.desde]}px)` } : undefined}>
          {visibles.map((f) =>
            f.tipo === "grupo" ? (
              <GroupHeader key={`g:${f.label}`} label={f.label} countLabel={f.countLabel} />
            ) : (
              <TrackRow key={f.track.id} t={f.track} num={f.num} />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

export default function LibraryView() {
  const libState = useStore((s) => s.libState);
  if (libState === "empty") return <EmptyState />;
  if (libState === "scanning") return <ScanningState />;
  if (libState === "error") return <ErrorState />;
  return <Tabla />;
}
