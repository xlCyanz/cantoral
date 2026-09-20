import { Check, Info, TriangleAlert } from "lucide-react";
import { useStore, type ToastType } from "../store";

export function toastPresentation(type: ToastType) {
  if (type === "error") {
    return { icon: "warning", color: "var(--danger)", role: "alert", ariaLive: "assertive" } as const;
  }
  if (type === "info") {
    return { icon: "info", color: "var(--text-2)", role: "status", ariaLive: "polite" } as const;
  }
  return { icon: "success", color: "var(--success)", role: "status", ariaLive: "polite" } as const;
}

export default function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  const presentation = toastPresentation(toast.type);
  const Icon = presentation.icon === "warning" ? TriangleAlert : presentation.icon === "info" ? Info : Check;
  return (
    <div role={presentation.role} aria-live={presentation.ariaLive} style={{ position: "fixed", left: "50%", bottom: 108, zIndex: 60, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 10, background: "var(--text)", color: "var(--bg)", padding: "11px 16px", borderRadius: 11, boxShadow: "var(--sh-lg)", fontSize: 13, fontWeight: 500, animation: "canToast .24s cubic-bezier(.22,1,.36,1)" }}>
      <Icon size={16} strokeWidth={2.2} style={{ color: presentation.color }} />
      {toast.message}
    </div>
  );
}
