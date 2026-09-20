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
  const scanPct = useStore((s) => s.scanPct);
  const scanIdx = useStore((s) => s.scanIdx);
  const scanFile = useStore((s) => s.scanFile);
  const cancelScan = useStore((s) => s.cancelScan);

  if (!scanning || ocupaTodo) return null;

  const pct = Math.round(scanPct);
  const archivo = scanFile || SCAN_FILES[scanIdx] || "";

  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: 104,
        zIndex: 55,
        width: 296,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 13,
        boxShadow: "var(--sh-md)",
        padding: "13px 14px 12px",
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
        <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text)" }}>Escaneando tu música…</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
          {pct}%
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Progreso del escaneo"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        style={{ height: 6, borderRadius: 4, background: "var(--surface-3)", overflow: "hidden", marginBottom: 10 }}
      >
        <div
          style={{
            width: pct + "%",
            height: "100%",
            borderRadius: 4,
            background: "linear-gradient(90deg,var(--primary),var(--primary-hover))",
            transition: "width .16s linear",
          }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          title={archivo}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 11,
            color: "var(--text-3)",
            fontFamily: "ui-monospace,monospace",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {archivo}
        </span>
        <button
          onClick={cancelScan}
          aria-label="Cancelar el escaneo"
          className="hb-s2"
          style={{
            flex: "0 0 auto",
            height: 28,
            padding: "0 11px",
            borderRadius: 8,
            border: "1px solid var(--border-2)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: "12.5px",
            fontWeight: 600,
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
