import { escaneoAPantallaCompleta, useStore } from "../store";
import { SCAN_FILES } from "../lib/seed";

/**
 * Scan progress as a card in the corner, so the library stays usable.
 *
 * The full-view card in `LibraryView` is kept for the one case where it is
 * honest — a first scan with nothing behind it — and `escaneoAPantallaCompleta`
 * decides which of the two is showing, so they can never both appear.
 */
export default function ScanProgress() {
  const scanning = useStore((s) => s.scanning);
  const ocupaTodo = useStore(escaneoAPantallaCompleta);
  const oculta = useStore((s) => s.tarjetaEscaneoOculta);
  const scanPct = useStore((s) => s.scanPct);
  const scanIdx = useStore((s) => s.scanIdx);
  const scanFile = useStore((s) => s.scanFile);
  const cancelScan = useStore((s) => s.cancelScan);
  const ocultar = useStore((s) => s.ocultarTarjetaEscaneo);

  if (!scanning || ocupaTodo || oculta) return null;

  const pct = Math.round(scanPct);
  const archivo = scanFile || SCAN_FILES[scanIdx] || "";

  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: 104,
        zIndex: 55,
        width: 262,
        background: "var(--surface)",
        border: "1px solid var(--border-2)",
        borderRadius: 10,
        boxShadow: "var(--sh-md)",
        padding: "11px 12px",
        animation: "canToast .24s cubic-bezier(.22,1,.36,1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2.4}
          strokeLinecap="round"
          style={{ width: 15, height: 15, flex: "0 0 auto", animation: "canSpin 1s linear infinite" }}
        >
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
        {/* «Añadiendo pistas nuevas» y no «Escaneando»: esta tarjeta solo
            sale cuando ya hay una biblioteca detrás, así que lo que está
            pasando es que se suma a lo que ya había. */}
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>Añadiendo pistas nuevas</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
          {pct}%
        </span>
        {/* Esconder no es cancelar. Son dos cosas distintas y cada una tiene
            su botón: seguir trabajando sin la tarjeta delante, o parar el
            escaneo. Vuelve a salir en el siguiente. */}
        <button
          onClick={ocultar}
          title="Esconder esta tarjeta (el escaneo sigue)"
          aria-label="Esconder esta tarjeta; el escaneo sigue"
          className="hb-text"
          style={{ flex: "0 0 auto", width: 18, height: 18, display: "grid", placeItems: "center", borderRadius: 5, color: "var(--text-3)", fontSize: 11 }}
        >
          ✕
        </button>
      </div>

      <div
        role="progressbar"
        aria-label="Progreso del escaneo"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        style={{ height: 5, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden", marginBottom: 8 }}
      >
        <div
          style={{
            width: pct + "%",
            height: "100%",
            borderRadius: 3,
            background: "var(--primary)",
            transition: "width .16s linear",
          }}
        />
      </div>

      <div
        title={archivo}
        style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 8 }}
      >
        {archivo}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={cancelScan}
          aria-label="Cancelar el escaneo"
          className="hb-s2"
          style={{
            flex: "0 0 auto",
            height: 24,
            padding: "0 9px",
            borderRadius: 6,
            border: "1px solid var(--border-2)",
            background: "var(--surface-2)",
            color: "var(--text)",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          Cancelar
        </button>
        <span style={{ minWidth: 0, fontSize: "10.5px", color: "var(--text-3)", lineHeight: 1.35 }}>
          Sigue usando la app: aparecen solas.
        </span>
      </div>
    </div>
  );
}
