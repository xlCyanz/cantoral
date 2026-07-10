import type { CSSProperties } from "react";
import { Database, Download, Folder, Plus, RefreshCw, X } from "lucide-react";
import { useStore } from "../store";
import type { Theme } from "../lib/types";

const h2Style: CSSProperties = { fontSize: 15, fontWeight: 700, margin: "0 0 3px" };
const pStyle: CSSProperties = { fontSize: 13, color: "var(--text-2)", margin: 0 };

function ThemeCard({ value, label }: { value: Theme; label: string }) {
  const theme = useStore((s) => s.theme);
  const setThemeTo = useStore((s) => s.setThemeTo);
  const active = theme === value;
  const dark = value === "dark";
  return (
    <button
      onClick={() => setThemeTo(value)}
      style={{ flex: 1, padding: "16px 14px", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, transition: "all .14s", cursor: "pointer", border: `1.5px solid ${active ? "var(--primary)" : "var(--border-2)"}`, background: active ? "var(--primary-soft)" : "var(--surface)", color: "var(--text)" }}
    >
      <div style={{ width: "100%", height: 52, borderRadius: 8, background: dark ? "#161311" : "#FAF7F2", border: `1px solid ${dark ? "#332B23" : "#E8E0D4"}`, display: "flex", overflow: "hidden" }}>
        <div style={{ width: 26, background: dark ? "#211B16" : "#F1EBE1", borderRight: `1px solid ${dark ? "#332B23" : "#E8E0D4"}` }} />
        <div style={{ flex: 1, padding: 7 }}>
          <div style={{ width: "60%", height: 6, borderRadius: 3, background: dark ? "#D07A4F" : "#A9502E", marginBottom: 5 }} />
          <div style={{ width: "85%", height: 5, borderRadius: 3, background: dark ? "#453A2E" : "#D9CEBE" }} />
        </div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

export default function ConfigView() {
  const s = useStore();
  const folders = s.folders;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 24px 44px" }}>
      {/* apariencia */}
      <div style={{ marginBottom: 30 }}>
        <h2 style={h2Style}>Apariencia</h2>
        <p style={{ ...pStyle, marginBottom: 14 }}>Elige cómo se ve Cantoral.</p>
        <div style={{ display: "flex", gap: 12 }}>
          <ThemeCard value="light" label="Claro" />
          <ThemeCard value="dark" label="Oscuro" />
        </div>
      </div>

      {/* carpetas */}
      <div style={{ marginBottom: 30 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h2 style={h2Style}>Carpetas indexadas</h2>
            <p style={pStyle}>Cantoral revisa estas ubicaciones. Tus archivos nunca se mueven ni se copian.</p>
          </div>
          <button onClick={s.openAddFolder} className="hb-s2" style={{ flex: "0 0 auto", height: 34, display: "flex", alignItems: "center", gap: 7, padding: "0 13px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "12.5px", fontWeight: 600 }}>
            <Plus size={14} strokeWidth={2.2} />Agregar
          </button>
        </div>
        <div style={{ border: "1px solid var(--border)", borderRadius: 13, overflow: "hidden", background: "var(--surface)" }}>
          {folders.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 14px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface-2)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                <Folder size={18} color="var(--text-2)" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "13.5px", fontWeight: 600 }}>{f.nombre}</div>
                <div style={{ fontSize: "11.5px", color: "var(--text-3)", fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.ruta}</div>
              </div>
              <span style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 500, flex: "0 0 auto" }}>{f.count} pistas</span>
              <button onClick={() => s.rescanFolder(f.id)} title="Volver a escanear" className="hb-s2t" style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", color: "var(--text-3)", flex: "0 0 auto" }}>
                <RefreshCw size={15} />
              </button>
              <button onClick={() => s.removeFolder(f.id)} title="Quitar carpeta" className="hb-danger" style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", color: "var(--text-3)", flex: "0 0 auto" }}>
                <X size={15} />
              </button>
            </div>
          ))}
          <div style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-3)", background: "var(--surface-2)" }}>
            Última actualización: hoy a las 9:14 · 239 pistas en total
          </div>
        </div>
      </div>

      {/* reproduccion */}
      <div style={{ marginBottom: 30 }}>
        <h2 style={{ ...h2Style, marginBottom: 12 }}>Reproducción</h2>
        <label onClick={s.toggleOpenExt} style={{ display: "flex", alignItems: "center", gap: 14, padding: 15, border: "1px solid var(--border)", borderRadius: 13, background: "var(--surface)", cursor: "pointer" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "13.5px", fontWeight: 600 }}>Abrir siempre en el reproductor del sistema</div>
            <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginTop: 2 }}>Al pulsar reproducir, usa la app predeterminada del sistema en vez del reproductor integrado.</div>
          </div>
          <div style={{ width: 42, height: 24, borderRadius: 20, padding: 2, transition: "background .16s", flex: "0 0 auto", cursor: "pointer", background: s.openExt ? "var(--primary)" : "var(--border-2)" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "transform .16s", transform: `translateX(${s.openExt ? "18px" : "0px"})` }} />
          </div>
        </label>
      </div>

      {/* base de datos */}
      <div style={{ marginBottom: 30 }}>
        <h2 style={h2Style}>Base de datos</h2>
        <p style={{ ...pStyle, marginBottom: 12 }}>Tu catálogo, listas y etiquetas se guardan en una base local. Haz copias periódicas.</p>
        <div style={{ border: "1px solid var(--border)", borderRadius: 13, background: "var(--surface)", padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--success-soft)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <Database size={20} color="var(--success)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "13.5px", fontWeight: 600 }}>cantoral.db</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", fontFamily: "ui-monospace,monospace" }}>C:\Users\Alabanza\AppData\Cantoral · 4.2 MB</div>
          </div>
          <button onClick={s.restore} className="hb-s2" style={{ flex: "0 0 auto", height: 36, padding: "0 14px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "12.5px", fontWeight: 600 }}>Restaurar…</button>
          <button onClick={s.backup} className="hb-primary" style={{ flex: "0 0 auto", height: 36, display: "flex", alignItems: "center", gap: 7, padding: "0 14px", borderRadius: 9, background: "var(--primary)", color: "var(--on-primary)", fontSize: "12.5px", fontWeight: 600 }}>
            <Download size={14} />Crear copia
          </button>
        </div>
      </div>

      <div style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12, paddingTop: 8 }}>
        Cantoral 1.0 · Hecho con cuidado para el ministerio de alabanza
      </div>
    </div>
  );
}
