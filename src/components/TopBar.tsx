import { ChevronDown, ChevronLeft, FolderPlus, ListFilter, Rows3, Rows4, Search, Tag, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useRef } from "react";
import { applyFilters, etiquetas, ocasiones, seleccionVigente, useStore } from "../store";
import SelectionBar from "./SelectionBar";
import { chipStyle, ocupadoStyle, segmento } from "../lib/styles";
import { encabezadoBiblioteca } from "../lib/encabezado";
import { useArrastrarFila } from "../lib/arrastrarFila";
import type { Densidad, GroupBy } from "../lib/types";

const titleMap: Record<string, string> = {
  colecciones: "Listas para cultos",
  config: "Configuración",
  proyeccion: "Proyección",
};

export default function TopBar() {
  // Field by field: the player writes `posSec` several times a second, and a
  // bar that read the whole store would re-filter the library along with it.
  const view = useStore((s) => s.view);
  const query = useStore((s) => s.query);
  const ocasion = useStore((s) => s.ocasion);
  const groupBy = useStore((s) => s.groupBy);
  const libState = useStore((s) => s.libState);
  const scanning = useStore((s) => s.scanning);
  const listaTitulo = useStore((s) => s.playlists.find((p) => p.id === s.curPlaylist)?.nombre ?? "");
  // `applyFilters` and `ocasiones` remember their last result, so calling them
  // here costs nothing beyond what the library view already paid.
  const total = useStore((s) => applyFilters(s).length);
  const indexadas = useStore((s) => s.tracks.length);
  const qf = useStore((s) => s.qf);
  const ocs = useStore(ocasiones);
  const tags = useStore(etiquetas);
  const tagFilter = useStore((s) => s.tagFilter);
  const haySeleccion = useStore((s) => seleccionVigente(s).length > 0);

  const onQuery = useStore((s) => s.onQuery);
  const clearQuery = useStore((s) => s.clearQuery);
  const showColecciones = useStore((s) => s.showColecciones);
  const openAddFolder = useStore((s) => s.openAddFolder);
  const onOcasion = useStore((s) => s.onOcasion);
  const onTagFilter = useStore((s) => s.onTagFilter);
  const onGroupBy = useStore((s) => s.onGroupBy);
  const densidad = useStore((s) => s.densidad);
  const setDensidad = useStore((s) => s.setDensidad);

  const filaFiltros = useRef<HTMLDivElement>(null);
  useArrastrarFila(filaFiltros);

  const showSearch = view === "biblioteca";
  // La biblioteca es la única vista cuyo nombre no cabía en la barra: ese
  // hueco lo ocupa el buscador. Va en su propia fila, con el recuento debajo.
  const encabezado = encabezadoBiblioteca(qf, total, indexadas, groupBy, !!query.trim());
  const isLista = view === "lista";
  const pageTitle = isLista ? listaTitulo : titleMap[view] || "";
  const showFilterBar = view === "biblioteca" && libState === "content";

  // Occasions come from the catalogue itself; a lone «Todas» chip would be
  // noise, so the row only appears once there is something to filter by.
  const chips = showFilterBar && ocs.length ? [{ value: "", label: "Todas" }, ...ocs.map((o) => ({ value: o, label: o }))] : [];

  return (
    <header
      style={{
        flex: "0 0 auto",
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        position: "relative",
        zIndex: 5,
      }}
    >
      {showSearch && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, padding: "16px 20px 0" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="display" style={{ fontSize: 26, lineHeight: 1.1, margin: "0 0 2px" }}>{encabezado.titulo}</h1>
            <div style={{ fontSize: "11.5px", color: "var(--text-2)" }}>{encabezado.subtitulo}</div>
          </div>
        </div>
      )}

      <div style={{ height: 60, display: "flex", alignItems: "center", gap: 14, padding: "0 20px" }}>
        {showSearch ? (
          <div style={{ flex: "1 1 0", minWidth: 0, maxWidth: 440, position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={17} style={{ position: "absolute", left: 13, color: "var(--text-3)", pointerEvents: "none" }} />
            <input
              data-search-input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Buscar por título, artista, tono o etiqueta…"
              className="in-focus"
              style={{
                width: "100%",
                height: 38,
                border: "1px solid var(--border-2)",
                background: "var(--surface)",
                borderRadius: 10,
                padding: "0 34px 0 38px",
                fontSize: "13.5px",
                outline: "none",
                transition: "border-color .14s,box-shadow .14s",
              }}
            />
            {query && (
              <button
                onClick={clearQuery}
                title="Limpiar"
                className="hb-s2t"
                style={{ position: "absolute", right: 9, width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center", color: "var(--text-3)" }}
              >
                <X size={13} strokeWidth={2.2} />
              </button>
            )}
          </div>
        ) : (
          <div style={{ flex: "0 1 auto", display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {isLista && (
              <button
                onClick={showColecciones}
                className="hb-s2t"
                style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", color: "var(--text-2)", border: "1px solid var(--border)" }}
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <h1 className="display" style={{ fontSize: 21, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {pageTitle}
            </h1>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* add folder */}
        <button
          onClick={openAddFolder}
          disabled={scanning}
          title={scanning ? "Hay un escaneo en curso" : undefined}
          className="hb-primary hb-active"
          style={{
            ...ocupadoStyle(scanning),
            height: 38,
            flex: "0 0 auto",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 15px",
            borderRadius: 10,
            background: "var(--primary-fill)",
            color: "var(--on-primary)",
            fontSize: "13.5px",
            fontWeight: 600,
            boxShadow: "var(--sh-sm)",
            transition: "background .14s,transform .08s",
          }}
        >
          <FolderPlus size={16} strokeWidth={2.2} />
          Agregar carpeta
        </button>
      </div>

      {/* filter bar — o la barra de selección, que se queda con la fila
          entera: mientras hay algo elegido, lo que toca es actuar sobre eso y
          no volver a filtrar. */}
      {showFilterBar && (
        <div style={{ height: 52, display: "flex", alignItems: "center", gap: 12, padding: "0 20px", borderTop: "1px solid var(--border)" }}>
          {haySeleccion && <SelectionBar />}
          {!haySeleccion && (
          <div ref={filaFiltros} className="fila-arrastrable" style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", flex: 1, paddingBottom: 1 }}>
            {chips.map((c) => {
              const active = c.value ? ocasion === c.value : !ocasion;
              return (
                <button key={c.value || "all"} onClick={() => onOcasion(c.value)} style={chipStyle(active)}>
                  {c.label}
                </button>
              );
            })}

            {/* Tags share the row with the occasions, behind a divider: they
                are a different axis — several can be on at once, and they
                narrow together. */}
            {showFilterBar && tags.length > 0 && (
              <>
                {chips.length > 0 && (
                  <span style={{ flex: "0 0 auto", width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
                )}
                {tags.map((t) => {
                  const activa = tagFilter.includes(t.nombre);
                  return (
                    <button
                      key={t.nombre}
                      onClick={() => onTagFilter(t.nombre)}
                      aria-pressed={activa}
                      title={activa ? `Quitar el filtro «${t.nombre}»` : `Filtrar por «${t.nombre}»`}
                      style={{ ...chipStyle(activa), display: "inline-flex", alignItems: "center", gap: 6, paddingLeft: 10 }}
                    >
                      <Tag size={12} strokeWidth={2.2} />
                      {t.nombre}
                      <span style={{ fontSize: 11, opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>{t.cuenta}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
          )}
          {!haySeleccion && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <ListFilter size={14} style={{ position: "absolute", left: 10, color: "var(--text-3)", pointerEvents: "none" }} />
              <select
                value={groupBy}
                onChange={(e) => onGroupBy(e.target.value as GroupBy)}
                style={selectStyle}
              >
                <option value="none">Sin agrupar</option>
                <option value="ocasion">Agrupar: Ocasión</option>
                <option value="album">Agrupar: Álbum</option>
                <option value="carpeta">Agrupar: Carpeta</option>
              </select>
              <ChevronDown size={13} style={{ position: "absolute", right: 9, color: "var(--text-3)", pointerEvents: "none" }} />
            </div>
            {/* Dos densidades, no un deslizador: son dos situaciones distintas
                —preparar el culto y sostener el atril el domingo—, no un
                gradiente donde hay que encontrar el punto. */}
            <div style={{ display: "flex", alignItems: "center", flex: "0 0 auto", height: 34, border: "1px solid var(--border-2)", background: "var(--surface)", borderRadius: 9, overflow: "hidden" }}>
              {DENSIDADES.map((d, i) => (
                <button
                  key={d.valor}
                  onClick={() => setDensidad(d.valor)}
                  aria-pressed={densidad === d.valor}
                  title={d.titulo}
                  className={densidad === d.valor ? undefined : "hb-s2t"}
                  style={segmento(densidad === d.valor, i === 0)}
                >
                  {d.icono}
                </button>
              ))}
            </div>
          </div>
          )}
        </div>
      )}
    </header>
  );
}

/** Las dos densidades, con el icono que dice cuántas filas caben. */
const DENSIDADES: { valor: Densidad; titulo: string; icono: ReactNode }[] = [
  { valor: "comoda", titulo: "Cómoda — para preparar", icono: <Rows3 size={15} /> },
  { valor: "compacta", titulo: "Compacta — para el domingo", icono: <Rows4 size={15} /> },
];

const selectStyle: CSSProperties = {
  appearance: "none",
  height: 34,
  border: "1px solid var(--border-2)",
  background: "var(--surface)",
  borderRadius: 9,
  padding: "0 28px 0 30px",
  fontSize: "12.5px",
  fontWeight: 500,
  color: "var(--text)",
  outline: "none",
  cursor: "pointer",
};
