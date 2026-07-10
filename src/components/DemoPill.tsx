import { useStore } from "../store";
import { demoBtnStyle } from "../lib/styles";
import type { DemoKind } from "../lib/types";

const kinds: { kind: DemoKind; label: string; title: string }[] = [
  { kind: "content", label: "Contenido", title: "Con contenido" },
  { kind: "empty", label: "Vacío", title: "Primera vez / vacío" },
  { kind: "scanning", label: "Escaneo", title: "Escaneando" },
  { kind: "error", label: "Error", title: "Error de carpeta" },
];

/** Review helper from the design: quickly switch the library between states. */
export default function DemoPill() {
  const libState = useStore((s) => s.libState);
  const onDemo = useStore((s) => s.onDemo);
  return (
    <div style={{ position: "fixed", left: 276, bottom: 100, zIndex: 30, display: "flex", alignItems: "center", gap: 8, padding: "5px 6px 5px 12px", border: "1px dashed var(--border-2)", borderRadius: 12, background: "var(--surface)", boxShadow: "var(--sh-md)" }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", color: "var(--text-3)", textTransform: "uppercase" }}>Demo</span>
      <div style={{ display: "flex", gap: 2 }}>
        {kinds.map((k) => (
          <button key={k.kind} onClick={() => onDemo(k.kind)} title={k.title} style={demoBtnStyle(libState === k.kind)}>
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
