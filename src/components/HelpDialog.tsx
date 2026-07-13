import type { ReactNode } from "react";
import { Database, FolderPlus, HelpCircle, ListMusic, Play, Search, Tag } from "lucide-react";
import { useStore } from "../store";

const STEPS: { icon: ReactNode; title: string; desc: string }[] = [
  { icon: <FolderPlus size={19} />, title: "Agrega tu música", desc: "Pulsa «Agregar carpeta» y elige dónde están tus pistas y coros. Cantoral los indexa sin moverlos ni copiarlos." },
  { icon: <Search size={19} />, title: "Explora la biblioteca", desc: "Busca por título, artista, tono o etiqueta; filtra por ocasión y ordena o agrupa la lista." },
  { icon: <Tag size={19} />, title: "Etiqueta y organiza", desc: "Abre una pista para agregarle etiquetas y localizarla más rápido." },
  { icon: <ListMusic size={19} />, title: "Arma listas para cultos", desc: "Crea una lista, agrega pistas desde su detalle y reordénalas arrastrando." },
  { icon: <Play size={19} />, title: "Reproduce", desc: "Escucha dentro de la app, o ábrela en el reproductor predeterminado del sistema. Los videos se abren fuera." },
  { icon: <Database size={19} />, title: "Respalda", desc: "En Configuración → Base de datos puedes crear una copia y restaurarla cuando quieras." },
];

export default function HelpDialog() {
  const open = useStore((s) => s.dialog === "help");
  const closeDialog = useStore((s) => s.closeDialog);
  if (!open) return null;

  return (
    <div onClick={closeDialog} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(25,18,12,.42)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: 24, animation: "canOverlay .18s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 540, maxHeight: "82vh", display: "flex", flexDirection: "column", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, boxShadow: "var(--sh-lg)", overflow: "hidden", animation: "canDialog .24s cubic-bezier(.22,1,.36,1)" }}>
        <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 13, flex: "0 0 auto" }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--primary-soft)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <HelpCircle size={21} color="var(--primary)" />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 2px" }}>¿Cómo funciona Cantoral?</h2>
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>Todo local, sin mover tus archivos.</p>
          </div>
        </div>

        <div style={{ padding: "8px 12px", overflowY: "auto", flex: 1 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "12px" }}>
              <div style={{ position: "relative", width: 40, height: 40, flex: "0 0 auto", borderRadius: 11, background: "var(--surface-2)", display: "grid", placeItems: "center", color: "var(--primary)" }}>
                {s.icon}
                <span style={{ position: "absolute", top: -6, left: -6, width: 20, height: 20, borderRadius: "50%", background: "var(--primary)", color: "var(--on-primary)", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center", border: "2px solid var(--surface)" }}>{i + 1}</span>
              </div>
              <div style={{ minWidth: 0, paddingTop: 1 }}>
                <div style={{ fontSize: "13.5px", fontWeight: 600 }}>{s.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.45, marginTop: 2 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", background: "var(--surface-2)", flex: "0 0 auto" }}>
          <button onClick={closeDialog} className="hb-primary" style={{ height: 40, padding: "0 20px", borderRadius: 10, background: "var(--primary)", color: "var(--on-primary)", fontSize: "13.5px", fontWeight: 600, boxShadow: "var(--sh-sm)" }}>Entendido</button>
        </div>
      </div>
    </div>
  );
}
