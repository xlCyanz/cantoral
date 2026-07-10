import { Clock, Folder, Heart, Library, ListMusic, Plus, Settings, TriangleAlert } from "lucide-react";
import { useStore } from "../store";
import { navCountStyle, navStyle, qfStyle } from "../lib/styles";
import type { CSSProperties } from "react";

/** The "Sistema de diseño" glyph — inlined from the design for an exact match. */
function PaletteGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, flex: "0 0 auto" }}>
      <circle cx="13.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="10.5" r="2.5" />
      <circle cx="8.5" cy="7.5" r="2.5" />
      <circle cx="6.5" cy="12.5" r="2.5" />
      <path d="M12 2a10 10 0 1 0 10 10c0-1.44-1.14-2.5-2.5-2.5H16" />
    </svg>
  );
}

const sectionLabel: CSSProperties = {
  fontSize: "10.5px",
  fontWeight: 700,
  letterSpacing: ".7px",
  textTransform: "uppercase",
  color: "var(--text-3)",
};

export default function Sidebar() {
  const view = useStore((s) => s.view);
  const qf = useStore((s) => s.qf);
  const total = useStore((s) => s.tracks.length);
  const missingCount = useStore((s) => s.tracks.filter((t) => t.missing).length);
  const plCount = useStore((s) => s.playlists.length);
  const folders = useStore((s) => s.folders);

  const showBiblioteca = useStore((s) => s.showBiblioteca);
  const showColecciones = useStore((s) => s.showColecciones);
  const showConfig = useStore((s) => s.showConfig);
  const showSistema = useStore((s) => s.showSistema);
  const onQuickFilter = useStore((s) => s.onQuickFilter);
  const onFolderClick = useStore((s) => s.onFolderClick);
  const openAddFolder = useStore((s) => s.openAddFolder);

  const libActive = view === "biblioteca";
  const colActive = view === "colecciones" || view === "lista";
  const cfgActive = view === "config";
  const sysActive = view === "sistema";

  return (
    <aside
      style={{
        width: 260,
        flex: "0 0 auto",
        background: "var(--bg-2)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px 8px" }}>
        {/* brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "6px 8px 16px" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              background: "linear-gradient(140deg,#C77A4E,#A9502E)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 4px 12px rgba(169,80,46,.32),inset 0 1px 0 rgba(255,255,255,.3)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 19, height: 19 }}>
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <div style={{ lineHeight: 1.05 }}>
            <div className="serif" style={{ fontSize: 23, letterSpacing: ".2px" }}>Cantoral</div>
            <div style={{ fontSize: "10.5px", color: "var(--text-3)", fontWeight: 500, letterSpacing: ".3px", marginTop: 1 }}>
              Música de la iglesia
            </div>
          </div>
        </div>

        {/* primary nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <button onClick={showBiblioteca} className={libActive ? undefined : "hb-s2"} style={navStyle(libActive)}>
            <Library size={18} style={{ flex: "0 0 auto" }} />
            <span style={{ flex: 1, textAlign: "left" }}>Biblioteca</span>
            <span style={navCountStyle(libActive)}>{total}</span>
          </button>
          <button onClick={showColecciones} className={colActive ? undefined : "hb-s2"} style={navStyle(colActive)}>
            <ListMusic size={18} style={{ flex: "0 0 auto" }} />
            <span style={{ flex: 1, textAlign: "left" }}>Listas para cultos</span>
            <span style={navCountStyle(colActive)}>{plCount}</span>
          </button>
        </nav>

        {/* quick filters */}
        <div style={{ ...sectionLabel, padding: "18px 8px 7px" }}>Filtros rápidos</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <button onClick={() => onQuickFilter("fav")} className={qf === "fav" ? undefined : "hb-s2"} style={qfStyle(qf === "fav")}>
            <Heart size={17} style={{ flex: "0 0 auto" }} />
            <span style={{ flex: 1, textAlign: "left" }}>Favoritas</span>
          </button>
          <button onClick={() => onQuickFilter("recent")} className={qf === "recent" ? undefined : "hb-s2"} style={qfStyle(qf === "recent")}>
            <Clock size={17} style={{ flex: "0 0 auto" }} />
            <span style={{ flex: 1, textAlign: "left" }}>Recién agregadas</span>
          </button>
          <button onClick={() => onQuickFilter("missing")} className={qf === "missing" ? undefined : "hb-s2"} style={qfStyle(qf === "missing")}>
            <TriangleAlert size={17} style={{ flex: "0 0 auto" }} />
            <span style={{ flex: 1, textAlign: "left" }}>Archivos faltantes</span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: "var(--danger-soft)", color: "var(--danger)" }}>
              {missingCount}
            </span>
          </button>
        </div>

        {/* folders */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 8px 7px" }}>
          <span style={sectionLabel}>Carpetas indexadas</span>
          <button onClick={openAddFolder} title="Agregar carpeta" className="hb-s2t" style={{ width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center", color: "var(--text-2)" }}>
            <Plus size={15} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={onFolderClick}
              className="hb-s2"
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderRadius: 9, color: "var(--text-2)", transition: "background .14s" }}
            >
              <Folder size={16} style={{ flex: "0 0 auto", color: "var(--text-3)" }} />
              <span style={{ flex: 1, textAlign: "left", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {f.nombre}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* sidebar footer */}
      <div style={{ flex: "0 0 auto", borderTop: "1px solid var(--border)", padding: "8px 12px" }}>
        <button onClick={showConfig} className={cfgActive ? undefined : "hb-s2"} style={navStyle(cfgActive)}>
          <Settings size={18} style={{ flex: "0 0 auto" }} />
          <span style={{ flex: 1, textAlign: "left" }}>Configuración</span>
        </button>
        <button onClick={showSistema} className={sysActive ? undefined : "hb-s2"} style={navStyle(sysActive)}>
          <PaletteGlyph />
          <span style={{ flex: 1, textAlign: "left" }}>Sistema de diseño</span>
        </button>
      </div>
    </aside>
  );
}
