import { ChevronDown, ChevronLeft, FolderPlus, ListFilter, Moon, Search, Sun, X } from "lucide-react";
import type { CSSProperties } from "react";
import { applyFilters, useStore } from "../store";
import { OCASIONES } from "../lib/seed";
import { chipStyle } from "../lib/styles";
import type { GroupBy } from "../lib/types";

const titleMap: Record<string, string> = {
  colecciones: "Listas para cultos",
  config: "Configuración",
  sistema: "Sistema de diseño",
};

export default function TopBar() {
  const s = useStore();
  const { view, query, ocasion, groupBy, libState, theme } = s;

  const showSearch = view === "biblioteca";
  const isLista = view === "lista";
  const pageTitle = isLista
    ? s.playlists.find((p) => p.id === s.curPlaylist)?.nombre || ""
    : titleMap[view] || "";
  const showFilterBar = view === "biblioteca" && libState === "content";
  const list = showFilterBar ? applyFilters(s) : [];

  const chips = [{ value: "", label: "Todas" }, ...OCASIONES.map((o) => ({ value: o, label: o }))];

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
      <div style={{ height: 60, display: "flex", alignItems: "center", gap: 14, padding: "0 20px" }}>
        {showSearch ? (
          <div style={{ flex: "1 1 0", minWidth: 0, maxWidth: 440, position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={17} style={{ position: "absolute", left: 13, color: "var(--text-3)", pointerEvents: "none" }} />
            <input
              value={query}
              onChange={(e) => s.onQuery(e.target.value)}
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
                onClick={s.clearQuery}
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
                onClick={s.showColecciones}
                className="hb-s2t"
                style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", color: "var(--text-2)", border: "1px solid var(--border)" }}
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <h1 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.2px", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {pageTitle}
            </h1>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* theme toggle */}
        <button
          onClick={s.toggleTheme}
          title="Cambiar tema"
          className="hb-s2t"
          style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", display: "grid", placeItems: "center", color: "var(--text-2)", transition: "background .14s,color .14s" }}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* add folder */}
        <button
          onClick={s.openAddFolder}
          className="hb-primary hb-active"
          style={{
            height: 38,
            flex: "0 0 auto",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 15px",
            borderRadius: 10,
            background: "var(--primary)",
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

      {/* filter bar */}
      {showFilterBar && (
        <div style={{ height: 52, display: "flex", alignItems: "center", gap: 12, padding: "0 20px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", flex: 1, paddingBottom: 1 }}>
            {chips.map((c) => {
              const active = c.value ? ocasion === c.value : !ocasion;
              return (
                <button key={c.value || "all"} onClick={() => s.onOcasion(c.value)} style={chipStyle(active)}>
                  {c.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <ListFilter size={14} style={{ position: "absolute", left: 10, color: "var(--text-3)", pointerEvents: "none" }} />
              <select
                value={groupBy}
                onChange={(e) => s.onGroupBy(e.target.value as GroupBy)}
                style={selectStyle}
              >
                <option value="none">Sin agrupar</option>
                <option value="ocasion">Agrupar: Ocasión</option>
                <option value="album">Agrupar: Álbum</option>
                <option value="carpeta">Agrupar: Carpeta</option>
              </select>
              <ChevronDown size={13} style={{ position: "absolute", right: 9, color: "var(--text-3)", pointerEvents: "none" }} />
            </div>
            <div style={{ fontSize: "12.5px", color: "var(--text-3)", fontWeight: 500, whiteSpace: "nowrap", paddingLeft: 2 }}>
              {list.length + (list.length === 1 ? " canción" : " canciones")}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

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
