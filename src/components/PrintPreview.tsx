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
    gap: 6,
    height: 25,
    padding: "0 9px",
    borderRadius: 6,
    border: `1px solid ${puesta ? "var(--primary)" : "var(--border-2)"}`,
    background: puesta ? "var(--primary-soft)" : "var(--surface-2)",
    color: puesta ? "var(--primary)" : "var(--text-2)",
    fontSize: 11,
    fontWeight: puesta ? 600 : 400,
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
    <Modal labelledBy="print-dialog-title" onClose={closeDialog} maxWidth={640}>
      {/* Todo lo que se puede hacer, en la fila de arriba. Antes estaba
          repartido entre una cabecera de 40 px con su icono y un pie con tres
          botones más, y había que recorrer el diálogo entero para encontrar
          «Imprimir». */}
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "11px 12px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
        <span id="print-dialog-title" style={{ fontSize: 13, fontWeight: 600 }}>Vista previa de impresión</span>
        <span title={pl.nombre} style={{ fontSize: 11, color: "var(--text-2)", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {pl.nombre}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={imprimir} className="hb-primary" style={{ height: 27, padding: "0 11px", borderRadius: 7, background: "var(--primary-fill)", color: "var(--on-primary)", fontSize: "11.5px", fontWeight: 600, display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
          <Printer size={13} />Imprimir o guardar PDF
        </button>
        <button onClick={closeDialog} className="hb-s2" style={{ height: 27, padding: "0 11px", borderRadius: 7, border: "1px solid var(--border-2)", background: "var(--surface-2)", color: "var(--text)", fontSize: "11.5px", fontWeight: 600, flex: "0 0 auto" }}>
          Cerrar
        </button>
      </div>

      {/* Qué lleva la hoja, debajo: se elige una vez y se mira el resultado,
          así que no compite con el botón de imprimir. */}
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
        <div role="group" aria-label="Qué imprimir" style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setConLetras(false)} aria-pressed={!conLetras} className="hb-s2" style={opcion(!conLetras)}>
            <FileText size={12} />Solo el repertorio
          </button>
          <button
            onClick={() => setConLetras(true)}
            aria-pressed={conLetras && disponibles}
            disabled={!disponibles}
            title={disponibles ? undefined : "Ninguna pista de esta lista tiene letra o acordes escritos"}
            className="hb-s2"
            style={{ ...opcion(conLetras && disponibles), opacity: disponibles ? 1 : 0.5, cursor: disponibles ? "pointer" : "not-allowed" }}
          >
            <Music size={12} />Con letras y acordes
          </button>
        </div>
        <div style={{ flex: 1 }} />
        {/* Guardar el archivo sigue aquí: una hoja que se manda por correo o
            por WhatsApp es otro recado que una que va al atril. */}
        <button onClick={() => { closeDialog(); exportPl(); }} className="hb-s2" style={{ height: 25, display: "flex", alignItems: "center", gap: 6, padding: "0 9px", borderRadius: 6, border: "1px solid var(--border-2)", background: "var(--surface-2)", color: "var(--text-2)", fontSize: 11 }}>
          <Download size={12} />Guardar .html
        </button>
      </div>

      <div style={{ padding: 16, background: "var(--surface-3)", maxHeight: "62vh", overflowY: "auto" }}>
        {/* The sheet is printed on white paper, so it is shown on white paper
            — the app's dark theme would be a preview of something else. */}
        <iframe
          ref={marco}
          title={`Vista previa de «${pl.nombre}»`}
          srcDoc={html}
          style={{ display: "block", width: "100%", height: "60vh", border: "1px solid var(--border-2)", borderRadius: 8, background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,.18)" }}
        />
      </div>
    </Modal>
  );
}
