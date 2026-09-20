import { TriangleAlert } from "lucide-react";
import { useStore } from "../store";

/**
 * Confirmation for the actions that cannot be undone: removing an indexed
 * folder, deleting a service list and restoring the database.
 *
 * The request carries real numbers (see `askConfirm` callers), so the dialog
 * names what is about to be lost instead of asking a generic «¿estás seguro?»
 * that everyone learns to click through.
 *
 * «Cancelar» is focused on open, so Enter or Space right after the dialog
 * appears backs out rather than confirming.
 */
export default function ConfirmDialog() {
  const req = useStore((s) => s.confirm);
  const accept = useStore((s) => s.acceptConfirm);
  const close = useStore((s) => s.closeConfirm);
  if (!req) return null;

  return (
    <div
      onClick={close}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(25,18,12,.5)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: 24, animation: "canOverlay .18s ease" }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, boxShadow: "var(--sh-lg)", overflow: "hidden", animation: "canDialog .24s cubic-bezier(.22,1,.36,1)" }}
      >
        <div style={{ padding: "22px 24px 18px", display: "flex", alignItems: "flex-start", gap: 13 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--danger-soft)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <TriangleAlert size={21} color="var(--danger)" strokeWidth={2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 id="confirm-title" style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>{req.title}</h2>
            <p id="confirm-body" style={{ fontSize: "13.5px", color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>{req.message}</p>
          </div>
        </div>

        <div style={{ padding: "0 24px 4px", display: "flex", flexDirection: "column", gap: 10 }}>
          {req.detail && (
            <div style={{ background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid var(--danger)", borderRadius: 11, padding: "11px 13px", fontSize: "12.5px", fontWeight: 500, lineHeight: 1.45, whiteSpace: "pre-line" }}>
              {req.detail}
            </div>
          )}
          {req.safe && (
            <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.45 }}>{req.safe}</p>
          )}
        </div>

        <div style={{ padding: "18px 24px 16px", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            autoFocus
            onClick={close}
            className="hb-s3"
            style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "13.5px", fontWeight: 600 }}
          >
            Cancelar
          </button>
          <button
            onClick={accept}
            className="hb-danger-solid"
            style={{ height: 40, padding: "0 18px", borderRadius: 10, background: "var(--danger)", color: "var(--on-danger)", fontSize: "13.5px", fontWeight: 600, boxShadow: "var(--sh-sm)", transition: "filter .14s" }}
          >
            {req.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
