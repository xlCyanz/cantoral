import { Check } from "lucide-react";
import { useStore } from "../store";

export default function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div style={{ position: "fixed", left: "50%", bottom: 108, zIndex: 60, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 10, background: "var(--text)", color: "var(--bg)", padding: "11px 16px", borderRadius: 11, boxShadow: "var(--sh-lg)", fontSize: 13, fontWeight: 500, animation: "canToast .24s cubic-bezier(.22,1,.36,1)" }}>
      <Check size={16} strokeWidth={2.2} style={{ color: "var(--primary)" }} />
      {toast}
    </div>
  );
}
