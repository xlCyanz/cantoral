import { useEffect, useState } from "react";
import { Music2 } from "lucide-react";
import { isMacOS, isTauri, watchMaximized, winClose, winMinimize, winToggleMaximize } from "../lib/api";

const ctrlBtn = { width: 46, height: 34, display: "grid", placeItems: "center", color: "var(--text-2)" } as const;

/** Cross-platform title bar.
 *  - macOS: window uses native traffic lights (titleBarStyle=Overlay); we only
 *    draw the brand and leave room on the left for the lights.
 *  - Windows/Linux: frameless window — we draw the min / maximize / close
 *    controls and handle double-click-to-maximize + drag ourselves. */
export default function TitleBar() {
  const nativeMac = isTauri() && isMacOS();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let un: (() => void) | undefined;
    void watchMaximized(setMaximized).then((u) => (un = u));
    return () => un?.();
  }, []);

  return (
    <div
      data-tauri-drag-region
      onDoubleClick={nativeMac ? undefined : () => void winToggleMaximize()}
      style={{
        height: 34,
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--bg-2)",
        borderBottom: "1px solid var(--border)",
        padding: nativeMac ? "0 12px 0 78px" : "0 4px 0 12px",
        userSelect: "none",
      }}
    >
      <div data-tauri-drag-region style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 5,
            background: "linear-gradient(140deg,#C77A4E,#A9502E)",
            display: "grid",
            placeItems: "center",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.25)",
            pointerEvents: "none",
          }}
        >
          <Music2 size={10} color="#fff" strokeWidth={2.4} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".2px", color: "var(--text-2)", pointerEvents: "none" }}>
          Cantoral
        </span>
      </div>

      {!nativeMac && (
        <div style={{ display: "flex", alignItems: "center" }}>
          <button onClick={() => void winMinimize()} className="hb-s2" title="Minimizar" style={ctrlBtn}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 12, height: 12 }}>
              <path d="M4 12h16" />
            </svg>
          </button>
          <button onClick={() => void winToggleMaximize()} className="hb-s2" title={maximized ? "Restaurar" : "Maximizar"} style={ctrlBtn}>
            {maximized ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 12, height: 12 }}>
                <rect x="4" y="8" width="12" height="12" rx="1.6" />
                <path d="M8 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 11, height: 11 }}>
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            )}
          </button>
          <button onClick={() => void winClose()} className="hb-close" title="Cerrar" style={ctrlBtn}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 12, height: 12 }}>
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
