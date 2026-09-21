import { Check, FileInput, Search, TriangleAlert } from "lucide-react";
import { useStore } from "../store";
import { formatearFecha } from "../lib/fechas";
import type { PistaCompartida } from "../lib/compartir";
import Modal from "./Modal";

/** `252` → `"4:12"`, for a duration that only exists inside the file. */
function reloj(seg: number): string {
  if (!seg) return "";
  const m = Math.floor(seg / 60);
  return `${m}:${String(Math.round(seg) % 60).padStart(2, "0")}`;
}

const seccion = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".5px",
  textTransform: "uppercase",
  color: "var(--text-3)",
  margin: "0 0 8px",
  display: "flex",
  alignItems: "center",
  gap: 7,
} as const;

const fila = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "6px 0",
  fontSize: "12.5px",
  minWidth: 0,
} as const;

function Titulo({ p }: { p: PistaCompartida }) {
  return (
    <span style={{ minWidth: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {p.titulo}
      {p.artista && <span style={{ color: "var(--text-3)" }}> · {p.artista}</span>}
    </span>
  );
}

/**
 * What a shared list matched against this catalogue, before anything is made.
 *
 * The screen is the feature: importing blind would leave a service list that
 * looks complete and is not. Nothing is created until the button below is
 * pressed, and what could not be found is named rather than counted, so it can
 * be added by hand.
 */
export default function ImportListDialog() {
  const abierto = useStore((s) => s.dialog === "importList");
  const previo = useStore((s) => s.importPreview);
  const closeDialog = useStore((s) => s.closeDialog);
  const confirmImport = useStore((s) => s.confirmImport);

  if (!abierto || !previo) return null;

  const { archivo, resultado } = previo;
  const { encontradas, faltantes } = resultado;
  const total = archivo.pistas.length;
  const nada = encontradas.length === 0;
  const fecha = formatearFecha(archivo.lista.fecha);

  return (
    <Modal labelledBy="import-dialog-title" onClose={closeDialog} maxWidth={540}>
      <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 13 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--primary-soft)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
          <FileInput size={21} color="var(--primary)" />
        </div>
        <div style={{ minWidth: 0 }}>
          <h2 id="import-dialog-title" style={{ fontSize: 18, fontWeight: 700, margin: "0 0 2px" }}>
            Importar «{archivo.lista.nombre}»
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>
            {encontradas.length} de {total} {total === 1 ? "pista está" : "pistas están"} en esta biblioteca
            {archivo.lista.ocasion && ` · ${archivo.lista.ocasion}`}
            {fecha && ` · ${fecha}`}
          </p>
        </div>
      </div>

      <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 18, maxHeight: "46vh", overflowY: "auto" }}>
        {encontradas.length > 0 && (
          <div>
            <p style={seccion}>
              <Check size={13} color="var(--primary)" />Se encontraron {encontradas.length}
            </p>
            {encontradas.map(({ pista, por }, i) => (
              <div key={`${pista.titulo}-${i}`} style={fila}>
                <Titulo p={pista} />
                {/* Which of the two routes found it: by file name, or by what
                    the track says it is. Worth showing — the second one is the
                    one that can be wrong. */}
                <span style={{ flex: "0 0 auto", fontSize: 10.5, fontWeight: 600, color: "var(--text-3)", background: "var(--surface-2)", padding: "2px 7px", borderRadius: 6 }}>
                  {por === "archivo" ? "mismo archivo" : "mismo título y duración"}
                </span>
              </div>
            ))}
          </div>
        )}

        {faltantes.length > 0 && (
          <div>
            <p style={seccion}>
              <TriangleAlert size={13} color="var(--danger)" />No están aquí: {faltantes.length}
            </p>
            {faltantes.map((p, i) => (
              <div key={`${p.titulo}-${i}`} style={fila}>
                <Titulo p={p} />
                <span style={{ flex: "0 0 auto", color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>{reloj(p.durSec)}</span>
              </div>
            ))}
            <p style={{ fontSize: 11.5, color: "var(--text-3)", margin: "8px 0 0", lineHeight: 1.5 }}>
              La lista se crea sin ellas. Agrega esos archivos a tu biblioteca y vuelve a importar,
              o añádelos a mano después.
            </p>
          </div>
        )}

        {nada && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 10, background: "var(--surface-2)" }}>
            <Search size={16} style={{ flex: "0 0 auto", marginTop: 1, color: "var(--text-3)" }} />
            <p style={{ fontSize: "12.5px", color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
              Ninguna de estas pistas está en esta biblioteca, así que no hay lista que crear.
              Indexa la carpeta con esta música y vuelve a importar el archivo.
            </p>
          </div>
        )}
      </div>

      <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--surface-2)" }}>
        <button onClick={closeDialog} className="hb-s3" style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "13.5px", fontWeight: 600 }}>
          Cancelar
        </button>
        <button
          onClick={confirmImport}
          disabled={nada}
          className="hb-primary"
          style={{ height: 40, padding: "0 18px", borderRadius: 10, background: "var(--primary)", color: "var(--on-primary)", fontSize: "13.5px", fontWeight: 600, boxShadow: "var(--sh-sm)", opacity: nada ? 0.55 : 1, cursor: nada ? "not-allowed" : "pointer" }}
        >
          {faltantes.length > 0 ? `Crear con ${encontradas.length}` : "Crear la lista"}
        </button>
      </div>
    </Modal>
  );
}
