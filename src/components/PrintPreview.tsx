import { useMemo, useRef } from "react";
import { Download, FileText, Music, Printer } from "lucide-react";
import { filasDeLista, plDur, useStore } from "../store";
import { hayLetras, playlistSheetHtml } from "../lib/exportSheet";
import Modal from "./Modal";

/** Nothing to hand `playlistSheetHtml` when the lyrics are left out. */
const SIN_HOJAS = {};

const opcion = (puesta: boolean) =>
  ({
    display: "flex",
    alignItems: "center",
    gap: 7,
    height: 32,
    padding: "0 12px",
    borderRadius: 8,
    border: `1px solid ${puesta ? "var(--primary)" : "var(--border-2)"}`,
    background: puesta ? "var(--primary-soft)" : "var(--surface)",
    color: puesta ? "var(--primary)" : "var(--text-2)",
    fontSize: "12.5px",
    fontWeight: 600,
  }) as const;

/**
 * The sheet as it will come out of the printer.
 *
 * Rendered from the same `playlistSheetHtml` the export writes — not a second
 * layout that would drift from it — inside an `srcdoc` iframe, which is
 * same-origin and so can be printed directly.
 *
 * There is one button for printing, not the two the issue proposed: the
 * system's print dialog *is* where a PDF is saved, on macOS and on Windows
 * alike, so a «Guardar PDF» button would open the same dialog and merely claim
 * to do something else.
 */
export default function PrintPreview() {
  const abierto = useStore((s) => s.dialog === "printPreview");
  const closeDialog = useStore((s) => s.closeDialog);
  const exportPl = useStore((s) => s.exportPl);
  const pl = useStore((s) => s.playlists.find((p) => p.id === s.curPlaylist));
  const rows = useStore(filasDeLista);
  const sheets = useStore((s) => s.sheets);
  const duracion = useStore((s) => plDur(s, s.plOrder[s.curPlaylist] || []));
  const conLetras = useStore((s) => s.printWithLyrics);
  const setConLetras = useStore((s) => s.setPrintWithLyrics);
  const marco = useRef<HTMLIFrameElement>(null);

  const disponibles = useMemo(() => hayLetras(rows, sheets), [rows, sheets]);
  const html = useMemo(
    () =>
      pl ? playlistSheetHtml(pl, rows, duracion, conLetras && disponibles ? sheets : SIN_HOJAS) : "",
    [pl, rows, duracion, conLetras, disponibles, sheets],
  );

  if (!abierto || !pl) return null;

  const imprimir = () => {
    const ventana = marco.current?.contentWindow;
    if (!ventana) return;
    // Focus first: an unfocused frame prints the page around it in some
    // engines, which here would be the app's own window.
    ventana.focus();
    ventana.print();
  };

  return (
    <Modal labelledBy="print-dialog-title" onClose={closeDialog} maxWidth={860}>
      <div style={{ padding: "18px 22px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: "var(--primary-soft)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
          <Printer size={20} color="var(--primary)" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 id="print-dialog-title" style={{ fontSize: 17, fontWeight: 700, margin: "0 0 2px" }}>
            Imprimir «{pl.nombre}»
          </h2>
          <p style={{ fontSize: "12.5px", color: "var(--text-2)", margin: 0 }}>
            Así queda la hoja. En el diálogo del sistema puedes elegir tu impresora o «Guardar como PDF».
          </p>
        </div>
        <div role="group" aria-label="Qué imprimir" style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
          <button onClick={() => setConLetras(false)} aria-pressed={!conLetras} className="hb-s2" style={opcion(!conLetras)}>
            <FileText size={14} />Solo el repertorio
          </button>
          <button
            onClick={() => setConLetras(true)}
            aria-pressed={conLetras && disponibles}
            disabled={!disponibles}
            title={disponibles ? undefined : "Ninguna pista de esta lista tiene letra o acordes escritos"}
            className="hb-s2"
            style={{ ...opcion(conLetras && disponibles), opacity: disponibles ? 1 : 0.5, cursor: disponibles ? "pointer" : "not-allowed" }}
          >
            <Music size={14} />Con letras y acordes
          </button>
        </div>
      </div>

      <div style={{ padding: 18, background: "var(--surface-2)", maxHeight: "58vh", overflowY: "auto" }}>
        {/* The sheet is printed on white paper, so it is shown on white paper
            — the app's dark theme would be a preview of something else. */}
        <iframe
          ref={marco}
          title={`Vista previa de «${pl.nombre}»`}
          srcDoc={html}
          style={{ display: "block", width: "100%", height: "62vh", border: "1px solid var(--border-2)", borderRadius: 10, background: "#fff" }}
        />
      </div>

      <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--surface-2)", flexWrap: "wrap" }}>
        {/* Exporting the file is still here: a sheet sent by mail or WhatsApp
            is a different errand from one that goes to the music stand. */}
        <button onClick={() => { closeDialog(); exportPl(); }} className="hb-s3" style={{ height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 14px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "13px", fontWeight: 600 }}>
          <Download size={15} />Guardar como archivo .html
        </button>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={closeDialog} className="hb-s3" style={{ height: 38, padding: "0 16px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "13px", fontWeight: 600 }}>
            Cerrar
          </button>
          <button onClick={imprimir} className="hb-primary" style={{ height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderRadius: 10, background: "var(--primary-fill)", color: "var(--on-primary)", fontSize: "13px", fontWeight: 600, boxShadow: "var(--sh-sm)" }}>
            <Printer size={15} />Imprimir o guardar PDF
          </button>
        </div>
      </div>
    </Modal>
  );
}
