import type { CSSProperties, ReactNode } from "react";
import { Check, Save, TriangleAlert, X } from "lucide-react";
import { useStore } from "../store";
import type { SaveState } from "../store";
import { parseHoja } from "../lib/chords";
import Modal from "./Modal";

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "11.5px",
  fontWeight: 600,
  color: "var(--text-2)",
  marginBottom: 5,
};

const areaStyle: CSSProperties = {
  width: "100%",
  height: 300,
  resize: "vertical",
  border: "1px solid var(--border-2)",
  background: "var(--surface-2)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: "13px",
  lineHeight: 1.6,
  fontFamily: "ui-monospace,monospace",
  color: "var(--text)",
  outline: "none",
};

/** What the footer says for each phase of a sheet writing itself. */
const ESTADO: Record<SaveState, { icono: ReactNode; texto: string; color: string }> = {
  idle: { icono: <Save size={14} color="var(--text-3)" />, texto: "Los cambios se guardan solos", color: "var(--text-3)" },
  saving: { icono: <Save size={14} color="var(--text-2)" />, texto: "Guardando…", color: "var(--text-2)" },
  saved: { icono: <Check size={15} strokeWidth={2.6} color="var(--success)" />, texto: "Guardado", color: "var(--success)" },
  error: { icono: <TriangleAlert size={15} color="var(--danger)" />, texto: "No se pudo guardar", color: "var(--danger)" },
};

/**
 * Chords over the words, as they will be read.
 *
 * Shown beside the editor because ChordPro is written inline — `[Sol]Sublime` —
 * and what matters is which syllable the chord lands on, which the source line
 * does not show.
 */
export function Vista({ acordes, escala = 1 }: { acordes: string; escala?: number }) {
  const lineas = parseHoja(acordes);
  return (
    <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 13 * escala, lineHeight: 1.35 }}>
      {lineas.map((linea, i) => {
        if (linea.tipo === "vacia") return <div key={i} style={{ height: 14 * escala }} />;
        if (linea.tipo === "seccion") {
          return (
            <div
              key={i}
              style={{
                fontFamily: "inherit",
                fontSize: 11.5 * escala,
                fontWeight: 700,
                letterSpacing: ".5px",
                textTransform: "uppercase",
                color: "var(--primary)",
                margin: `${14 * escala}px 0 ${4 * escala}px`,
              }}
            >
              {linea.etiqueta}
            </div>
          );
        }
        return (
          <div key={i} style={{ display: "flex", flexWrap: "wrap", marginBottom: 2 * escala }}>
            {linea.segmentos.map((seg, j) => (
              <span key={j} style={{ display: "inline-block", whiteSpace: "pre" }}>
                <span style={{ display: "block", fontWeight: 700, color: "var(--primary)", minHeight: "1.3em" }}>
                  {seg.acorde}
                </span>
                <span style={{ display: "block" }}>{seg.texto}</span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Editor for a track's lyrics and chords. */
export default function SheetDialog() {
  const id = useStore((s) => s.sheetDialog);
  const hoja = useStore((s) => (s.sheetDialog ? s.sheets[s.sheetDialog] : undefined));
  const pista = useStore((s) => s.tracks.find((t) => t.id === s.sheetDialog));
  const estado = useStore((s) => s.sheetState);
  const setSheet = useStore((s) => s.setSheet);
  const closeSheetEditor = useStore((s) => s.closeSheetEditor);

  if (!id || !pista) return null;
  const letra = hoja?.letra ?? "";
  const acordes = hoja?.acordes ?? "";

  return (
    <Modal
      labelledBy="sheet-title"
      onClose={closeSheetEditor}
      maxWidth={940}
      overlayZ={45}
      boxStyle={{ maxHeight: "100%", display: "flex", flexDirection: "column" }}
    >
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 12, padding: "16px 18px 14px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ minWidth: 0 }}>
          <h2 id="sheet-title" style={{ fontSize: "16.5px", fontWeight: 700, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Letra y acordes · {pista.titulo}
          </h2>
          <p style={{ fontSize: "12.5px", color: "var(--text-2)", margin: "3px 0 0" }}>
            Los acordes van entre corchetes, pegados a la sílaba donde caen:{" "}
            <code style={{ fontFamily: "ui-monospace,monospace" }}>[Sol]Sublime [Do]gracia</code>. Una línea
            como <code style={{ fontFamily: "ui-monospace,monospace" }}>{"{Coro}"}</code> hace un encabezado.
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={closeSheetEditor} title="Cerrar" className="hb-s2t" style={{ flex: "0 0 auto", width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", color: "var(--text-2)" }}>
          <X size={17} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 18px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label htmlFor="hoja-acordes" style={labelStyle}>Acordes (ChordPro)</label>
            <textarea
              id="hoja-acordes"
              value={acordes}
              onChange={(e) => setSheet("acordes", e.target.value)}
              placeholder={"{Estrofa}\n[Sol]Cantaré de tu [Do]amor por [Sol]siempre"}
              className="in-focus"
              style={areaStyle}
            />
          </div>
          <div>
            <label htmlFor="hoja-letra" style={labelStyle}>Letra sola</label>
            <textarea
              id="hoja-letra"
              value={letra}
              onChange={(e) => setSheet("letra", e.target.value)}
              placeholder={"Para proyectar o leer sin acordes."}
              className="in-focus"
              style={areaStyle}
            />
          </div>
        </div>

        {acordes.trim() && (
          <div style={{ marginTop: 16 }}>
            <span style={labelStyle}>Cómo se verá</span>
            <div style={{ border: "1px solid var(--border)", borderRadius: 11, background: "var(--surface-2)", padding: "12px 14px", overflowX: "auto" }}>
              <Vista acordes={acordes} />
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
        {ESTADO[estado].icono}
        <span aria-live="polite" style={{ fontSize: "12.5px", fontWeight: estado === "idle" ? 400 : 600, color: ESTADO[estado].color }}>
          {ESTADO[estado].texto}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={closeSheetEditor} className="hb-s2" style={{ height: 36, padding: "0 16px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "13.5px", fontWeight: 600 }}>
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
