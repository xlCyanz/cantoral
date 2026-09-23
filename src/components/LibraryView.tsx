import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Clock, Folder, FolderPlus, Heart, Play, RefreshCw, Search, TriangleAlert, Video } from "lucide-react";
import type { CSSProperties } from "react";
import { applyFilters, buildGroups, escaneoAPantallaCompleta, seleccionVigente, useStore } from "../store";
import { SCAN_FILES } from "../lib/seed";
import { coverStyle, hasCover } from "../lib/covers";
import Empty, { emptyBtnSecondary } from "./Empty";
import { favBtnStyle, ocasionBadge, thProps } from "../lib/styles";
import { ALTOS, DESDE, altoTotal, aplanar, ventana } from "../lib/virtual";
import type { Densidad, SortKey, Track } from "../lib/types";

const GRID = "32px minmax(150px,3fr) minmax(90px,1.5fr) 104px 48px 62px 72px";

/** White glyph shown inside a cover swatch, keyed by track state. */
function CoverInner({ t, chico }: { t: Track; chico?: boolean }) {
  if (hasCover(t)) return null;
  const g = (n: number) => (chico ? Math.round(n * 0.62) : n);
  if (t.missing)
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.92)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: g(16), height: g(16) }}>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" /><path d="M12 17h.01" />
      </svg>
    );
  if (t.video)
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.92)" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ width: g(17), height: g(17) }}>
        <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
        <rect x="2" y="6" width="14" height="12" rx="2" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: g(15), height: g(15) }}>
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
const TrackRow = memo(function TrackRow({ t, num, densidad }: { t: Track; num: number; densidad: Densidad }) {
  const playing = useStore((s) => s.playerId === t.id && s.playing);
  const sel = useStore((s) => s.selId === t.id && s.detailOpen);
  const elegida = useStore((s) => s.selection.includes(t.id));
  const onRowClick = useStore((s) => s.onRowClick);
  const play = useStore((s) => s.play);
  const onFav = useStore((s) => s.onFav);
  const openRowMenu = useStore((s) => s.openRowMenu);
  const startLibraryDrag = useStore((s) => s.startLibraryDrag);
  const endLibraryDrag = useStore((s) => s.endLibraryDrag);

  const compacta = densidad === "compacta";
  // Una fila compacta no tiene sitio para el artista *y* el aviso: si hay
  // aviso, gana el aviso y el artista se va. Y entonces nada le pone tope al
  // hueco, porque recortar «Sin archiv…» sería peor que no decirlo.
  const conAviso = t.missing || t.video;
  const muestraArtista = !compacta || !conAviso;
  const rowStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: GRID,
    alignItems: "center",
    gap: 8,
    // Pinned rather than left to the content, so the windowing math above can
    // predict where every row lands without measuring the DOM.
    height: ALTOS[densidad].fila,
    boxSizing: "border-box",
    padding: compacta ? "0 10px" : "8px 10px",
    borderRadius: 11,
    cursor: "default",
    transition: "background .13s",
    // Being in the selection and being the row the detail panel is showing are
    // different things, so they look different: a fill for the first, a ring
    // for the second.
    ...(elegida ? { background: "var(--primary-soft)" } : {}),
    ...(sel ? { boxShadow: "inset 0 0 0 1px var(--primary-soft-2)" } : {}),
    ...(t.missing ? { opacity: 0.72 } : {}),
  };

  return (
    <div
      className="lib-row"
      tabIndex={0}
      aria-label={`${t.titulo}, ${t.artista}${t.tono ? `, tono ${t.tono}` : ""}, ${t.dur}${t.missing ? ", sin archivo" : ""}`}
      aria-selected={elegida}
      draggable
      onDragStart={(e) => {
        // A drag that starts on a row outside the selection carries just that
        // row; one inside it carries the whole selection.
        const st = useStore.getState();
        const ids = st.selection.includes(t.id) ? seleccionVigente(st) : [t.id];
        startLibraryDrag(ids);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onDragEnd={endLibraryDrag}
      onContextMenu={(e) => {
        e.preventDefault();
        openRowMenu(t.id, e.clientX, e.clientY);
      }}
      onClick={(e) => onRowClick(t.id, { meta: e.metaKey || e.ctrlKey, shift: e.shiftKey })}
      onDoubleClick={() => play(t.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          // Enter opens the detail panel; ⌘/Ctrl+Enter starts playback.
          if (e.metaKey || e.ctrlKey) play(t.id);
          else onRowClick(t.id, { shift: e.shiftKey });
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
              title="Reproducir"
              className="row-play"
              style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--text)", borderRadius: 7 }}
            >
              <Play size={14} fill="currentColor" stroke="none" />
            </button>
          </>
        )}
      </div>

      {/* title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={coverStyle(t, compacta ? 24 : 40)}><CoverInner t={t} chico={compacta} /></div>
        {/* Cómoda pone el artista debajo del título; compacta lo pone al lado,
            porque en 34 px no caben dos líneas y perder el artista para ganar
            filas no es un intercambio que valga la pena. */}
        <div style={{ minWidth: 0, ...(compacta ? { display: "flex", alignItems: "center", gap: 7 } : {}) }}>
          <div style={{ fontSize: compacta ? "12.5px" : 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...(compacta ? { flex: "1 1 auto", minWidth: 0 } : {}), ...(sel ? { color: "var(--primary)" } : {}) }}>
            {t.titulo}
          </div>
          {/* En una línea el título manda: el artista cede espacio primero y
              no se queda con más de un tercio de la celda. Recortar «Cristo Ya
              Resucit…» para que quepa entero «Voces de Gracia» es al revés.
              Y si la fila lleva aviso, el artista se va del todo: que falte el
              archivo importa más que quién la canta. */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, marginTop: compacta ? 0 : 1, ...(compacta ? { flex: "0 0 auto", ...(muestraArtista ? { maxWidth: "34%", overflow: "hidden" } : {}) } : {}) }}>
            {muestraArtista && (
              <span style={{ fontSize: compacta ? "11.5px" : 12, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.artista}</span>
            )}
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
      </div>
    </div>
  );
});

/** Heading that opens a group when the table is grouped. */
/**
 * The bar that heads a group.
 *
 * Clicking it folds the group away. That is for the minute you are building a
 * service out of one folder and the other three are in the way — so it lives
 * in the session and is forgotten on the next launch.
 *
 * The path under the name only shows when grouping by folder, and it is the
 * folder on disk: the name reads «Himnos / Clásicos», the path says which
 * «Himnos» that is when two drives have one.
 */
function GroupHeader({ clave, label, ruta, countLabel, colapsado, densidad }: { clave: string; label: string; ruta: string; countLabel: string; colapsado: boolean; densidad: Densidad }) {
  const toggleGrupo = useStore((s) => s.toggleGrupo);
  return (
    <button
      onClick={() => toggleGrupo(clave)}
      aria-expanded={!colapsado}
      title={colapsado ? `Desplegar «${label}»` : `Plegar «${label}»`}
      className="hb-s3"
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", height: ALTOS[densidad].grupo, boxSizing: "border-box", padding: "0 12px", background: "var(--surface-2)", borderTop: "1px solid var(--border)", textAlign: "left", transition: "background .13s" }}
    >
      <ChevronRight
        size={13}
        style={{ flex: "0 0 auto", color: "var(--text-3)", transform: colapsado ? "none" : "rotate(90deg)", transition: "transform .14s" }}
      />
      <Folder size={13} style={{ flex: "0 0 auto", color: "var(--text-3)", opacity: ruta ? 1 : 0 }} />
      <span style={{ flex: "0 0 auto", fontSize: "12.5px", fontWeight: 600 }}>{label}</span>
      {ruta && (
        <span title={ruta} style={{ minWidth: 0, fontSize: "10.5px", color: "var(--text-3)", fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {ruta}
        </span>
      )}
      <span style={{ flex: 1 }} />
      <span style={{ flex: "0 0 auto", fontSize: "10.5px", color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>{countLabel}</span>
    </button>
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

/** Botón principal de una pantalla de estado. */
const btnEstado: CSSProperties = {
  height: 34,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "0 16px",
  borderRadius: 8,
  background: "var(--primary-fill)",
  color: "var(--on-primary)",
  fontSize: "12.5px",
  fontWeight: 600,
};

/** Y el secundario, al lado. */
const btnEstadoSec: CSSProperties = {
  height: 34,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "0 14px",
  borderRadius: 8,
  border: "1px solid var(--border-2)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "12.5px",
  fontWeight: 600,
};

const marcoEstado: CSSProperties = {
  height: "100%",
  display: "grid",
  placeItems: "center",
  padding: 24,
  animation: "canFade .3s ease",
};

function EmptyState() {
  const openAddFolder = useStore((s) => s.openAddFolder);
  const openHelp = useStore((s) => s.openHelp);
  return (
    <div style={marcoEstado}>
      <div style={{ maxWidth: 360, textAlign: "center" }}>
        <div style={{ width: 54, height: 54, margin: "0 auto 14px", borderRadius: 12, border: "1px dashed var(--border-2)", display: "grid", placeItems: "center", color: "var(--text-3)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <h2 className="display" style={{ fontSize: 24, margin: "0 0 6px" }}>Todavía no hay música</h2>
        {/* Esta es la frase más importante de la app. Quien administra la
            música de una iglesia lleva años ordenándola a mano y lo que
            necesita saber, antes de dejar entrar a un programa, es que no se
            la van a desordenar. Iba al final de un párrafo largo; ahora va
            enumerada y en negrita. */}
        <p style={{ margin: "0 0 16px", fontSize: "12.5px", lineHeight: 1.6, color: "var(--text-2)" }}>
          Elige la carpeta donde guardas las pistas. Cantoral solo las lee para hacer una lista:{" "}
          <strong style={{ color: "var(--text)" }}>no mueve, no renombra y no borra ningún archivo</strong>.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={openAddFolder} className="hb-primary" style={btnEstado}>
            <FolderPlus size={15} strokeWidth={2.2} />Elegir carpeta…
          </button>
          <button onClick={openHelp} className="hb-s2" style={btnEstadoSec}>
            ¿Cómo funciona?
          </button>
        </div>
      </div>
    </div>
  );
}

function ScanningState() {
  const scanPct = useStore((s) => s.scanPct);
  const scanIdx = useStore((s) => s.scanIdx);
  const scanFile = useStore((s) => s.scanFile);
  const cancelScan = useStore((s) => s.cancelScan);
  const pct = Math.round(scanPct);
  const archivo = scanFile || SCAN_FILES[scanIdx] || "";
  return (
    <div style={marcoEstado}>
      <div style={{ width: "100%", maxWidth: 330, textAlign: "center" }}>
        <div style={{ width: 34, height: 34, margin: "0 auto 14px", border: "2px solid var(--border-2)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "canSpin 900ms linear infinite" }} />
        <h2 className="display" style={{ fontSize: 22, margin: "0 0 4px" }}>Leyendo tus carpetas</h2>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--text-2)", lineHeight: 1.55, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <span style={{ fontWeight: 600, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
          <span title={archivo} style={{ minWidth: 0, color: "var(--text-3)", fontFamily: "ui-monospace,monospace", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {archivo}
          </span>
        </p>
        <div
          role="progressbar"
          aria-label="Progreso del escaneo"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          style={{ height: 6, borderRadius: 4, background: "var(--surface-3)", overflow: "hidden", marginBottom: 12 }}
        >
          <div style={{ width: pct + "%", height: "100%", borderRadius: 4, background: "var(--primary)", transition: "width .16s linear" }} />
        </div>
        <button onClick={cancelScan} className="hb-s2" style={{ ...btnEstadoSec, height: 28, fontSize: 12, margin: "0 auto" }}>
          Cancelar el escaneo
        </button>
        <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>
          Puedes seguir usando Cantoral mientras termina. Las pistas irán apareciendo solas.
        </div>
      </div>
    </div>
  );
}

function ErrorState() {
  const scanError = useStore((s) => s.scanError);
  const retryError = useStore((s) => s.retryError);
  const showConfig = useStore((s) => s.showConfig);
  return (
    <div style={marcoEstado}>
      <div style={{ maxWidth: 380, textAlign: "center" }}>
        <div style={{ width: 44, height: 44, margin: "0 auto 14px", borderRadius: "50%", background: "var(--danger-soft)", display: "grid", placeItems: "center", color: "var(--danger)" }}>
          <TriangleAlert size={22} strokeWidth={2} />
        </div>
        <h2 className="display" style={{ fontSize: 22, margin: "0 0 6px" }}>No pudimos leer esta carpeta</h2>
        <p style={{ margin: "0 0 6px", fontSize: "12.5px", lineHeight: 1.6, color: "var(--text-2)" }}>
          La unidad puede estar desconectada o la carpeta fue movida. Verifica que esté disponible e inténtalo otra vez.
        </p>
        {/* Nada se ha perdido, y decirlo aquí importa: quien ve un error rojo
            sobre su biblioteca asume lo peor. */}
        <p style={{ margin: "0 0 16px", fontSize: "11.5px", lineHeight: 1.6, color: "var(--text-3)" }}>
          Tus pistas y tus cultos siguen donde estaban: esto solo es la carpeta que no se pudo abrir.
        </p>
        {scanError && (
          <code style={{ display: "block", fontSize: 11, color: "var(--text-3)", background: "var(--surface-2)", border: "1px solid var(--border)", padding: "6px 10px", borderRadius: 7, marginBottom: 16, textAlign: "left", overflowWrap: "anywhere" }}>
            {scanError}
          </code>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={retryError} className="hb-primary" style={btnEstado}>
            <RefreshCw size={15} strokeWidth={2.2} />Volver a intentarlo
          </button>
          <button onClick={showConfig} className="hb-s2" style={btnEstadoSec}>
            Administrar carpetas
          </button>
        </div>
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
  const total = useStore((s) => s.tracks.length);
  const densidad = useStore((s) => s.densidad);

  const plano = useMemo(() => aplanar(groups, ALTOS[densidad]), [groups, densidad]);
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
        icon={<Search size={24} />}
        title={query ? `Nada coincide con «${query}»` : "Ninguna pista pasa estos filtros"}
        // Decir dónde se buscó es la respuesta a la pregunta que se hace
        // cualquiera al ver esto: «¿lo estoy escribiendo mal, o de verdad no
        // está?». La lista de campos es la que `applyFilters` recorre.
        desc={`Se buscó en el título, el artista, el álbum, el tono, la ocasión y las etiquetas de ${total} ${total === 1 ? "pista" : "pistas"} de la biblioteca.`}
        action={
          <button onClick={() => useStore.setState({ query: "", qf: null, ocasion: null, tagFilter: [] })} className="hb-s2" style={emptyBtnSecondary}>
            Quitar la búsqueda y los filtros
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
              <GroupHeader key={`g:${f.clave}`} clave={f.clave} label={f.label} ruta={f.ruta} countLabel={f.countLabel} colapsado={f.colapsado} densidad={densidad} />
            ) : (
              <TrackRow key={f.track.id} t={f.track} num={f.num} densidad={densidad} />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

export default function LibraryView() {
  const libState = useStore((s) => s.libState);
  // A scan only takes the whole view when there is nothing behind it to show;
  // otherwise it runs in the corner and the table stays usable.
  const escaneoOcupaTodo = useStore(escaneoAPantallaCompleta);
  if (escaneoOcupaTodo) return <ScanningState />;
  if (libState === "empty") return <EmptyState />;
  if (libState === "error") return <ErrorState />;
  return <Tabla />;
}
