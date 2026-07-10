import type { CSSProperties } from "react";
import { Search } from "lucide-react";

const sectionHead: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".6px",
  textTransform: "uppercase",
  color: "var(--text-3)",
  paddingBottom: 8,
  borderBottom: "1px solid var(--border)",
};

const swatches: { name: string; bg: string; hex: string; ring?: boolean }[] = [
  { name: "Primario", bg: "var(--primary)", hex: "#A9502E · #D07A4F" },
  { name: "Primario suave", bg: "var(--primary-soft)", hex: "#F4E7DF · #33251C" },
  { name: "Fondo", bg: "var(--bg)", hex: "#FAF7F2 · #161311", ring: true },
  { name: "Superficie", bg: "var(--surface)", hex: "#FFFFFF · #211B16", ring: true },
  { name: "Superficie 2", bg: "var(--surface-2)", hex: "#F6F1EA · #2B241D", ring: true },
  { name: "Texto", bg: "var(--text)", hex: "#221D18 · #F2EBE0" },
  { name: "Éxito", bg: "var(--success)", hex: "#3D7B54 · #63A87D" },
  { name: "Advertencia", bg: "var(--warning)", hex: "#8F6413 · #D6A343" },
  { name: "Error", bg: "var(--danger)", hex: "#B8412F · #E0715E" },
];

const hexStyle: CSSProperties = { fontSize: 10, color: "var(--text-3)", fontFamily: "ui-monospace,monospace", marginTop: 2 };

export default function DesignSystemView() {
  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 24px 48px" }}>
      <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, margin: "0 0 6px", maxWidth: 620 }}>
        El lenguaje visual de Cantoral: cálido, tranquilo y legible para listas largas. Cambia el tema arriba a la derecha para ver ambos modos. Los valores muestran <strong style={{ color: "var(--text)" }}>claro · oscuro</strong>.
      </p>

      {/* colors */}
      <div style={{ ...sectionHead, margin: "30px 0 12px" }}>Paleta de color</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
        {swatches.map((sw) => (
          <div key={sw.name} style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
            <div style={{ height: 60, background: sw.bg, ...(sw.ring ? { boxShadow: "inset 0 0 0 1px var(--border)" } : {}) }} />
            <div style={{ padding: "9px 11px" }}>
              <div style={{ fontSize: "12.5px", fontWeight: 600 }}>{sw.name}</div>
              <div style={hexStyle}>{sw.hex}</div>
            </div>
          </div>
        ))}
      </div>

      {/* typography */}
      <div style={{ ...sectionHead, margin: "34px 0 14px" }}>Tipografía</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface)", padding: 20 }}>
          <div className="serif" style={{ fontSize: 40, lineHeight: 1, marginBottom: 6 }}>Cantoral</div>
          <div style={{ fontSize: 12, color: "var(--text-2)" }}>Instrument Serif — títulos de portada y estados vacíos</div>
        </div>
        <div style={{ border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface)", padding: 20, display: "flex", flexDirection: "column", gap: 11, justifyContent: "center" }}>
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.3px" }}>Título 24/700</span>
          <span style={{ fontSize: 18, fontWeight: 600 }}>Subtítulo 18/600</span>
          <span style={{ fontSize: 14 }}>Cuerpo 14/400 — Hanken Grotesk</span>
          <span style={{ fontSize: "12.5px", color: "var(--text-2)" }}>Secundario 13/400</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: "var(--text-3)" }}>Etiqueta 11/700</span>
        </div>
      </div>

      {/* spacing / radii / shadows */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 22, marginTop: 22 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 12 }}>Espaciado · base 4</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[8, 12, 16, 24, 32].map((n) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: n, height: 14, background: "var(--primary)", borderRadius: 2 }} />
                <span style={{ fontSize: "11.5px", color: "var(--text-2)" }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 12 }}>Radios</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {[6, 8, 11, 15].map((r) => (
              <div key={r} style={{ width: 52, height: 52, background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: r, display: "grid", placeItems: "end center", fontSize: 10, color: "var(--text-2)", paddingBottom: 4 }}>{r}</div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 12 }}>Sombras</div>
          <div style={{ display: "flex", gap: 12 }}>
            {(["sm", "md", "lg"] as const).map((sh) => (
              <div key={sh} style={{ flex: 1, height: 52, background: "var(--surface)", borderRadius: 10, boxShadow: `var(--sh-${sh})`, display: "grid", placeItems: "center", fontSize: "10.5px", color: "var(--text-2)" }}>{sh}</div>
            ))}
          </div>
        </div>
      </div>

      {/* components */}
      <div style={{ ...sectionHead, margin: "34px 0 14px" }}>Componentes</div>
      <div style={{ border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface)", padding: 22, display: "flex", flexWrap: "wrap", gap: 26, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={{ height: 38, padding: "0 16px", borderRadius: 10, background: "var(--primary)", color: "var(--on-primary)", fontSize: "13.5px", fontWeight: 600 }}>Primario</button>
          <button style={{ height: 38, padding: "0 16px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "13.5px", fontWeight: 600 }}>Secundario</button>
          <button style={{ height: 38, padding: "0 12px", borderRadius: 10, background: "none", color: "var(--text-2)", fontSize: "13.5px", fontWeight: 600 }}>Fantasma</button>
        </div>
        <div style={{ width: 1, height: 34, background: "var(--border)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "11.5px", fontWeight: 600, padding: "3px 10px", borderRadius: 7, background: "var(--surface-3)", color: "var(--text-2)" }}>Adoración</span>
          <span style={{ fontSize: "11.5px", fontWeight: 600, padding: "3px 10px", borderRadius: 7, background: "var(--primary)", color: "var(--on-primary)" }}>Activo</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "11.5px", fontWeight: 600, padding: "3px 9px", borderRadius: 7, background: "var(--danger-soft)", color: "var(--danger)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" style={{ width: 10, height: 10 }}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>Sin archivo
          </span>
        </div>
        <div style={{ width: 1, height: 34, background: "var(--border)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ height: 38, width: 170, display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border-2)", background: "var(--surface-2)", borderRadius: 10, padding: "0 12px", fontSize: 13, color: "var(--text-3)" }}>
            <Search size={15} />Buscar…
          </div>
          <div style={{ width: 42, height: 24, borderRadius: 20, background: "var(--primary)", padding: 2, display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
