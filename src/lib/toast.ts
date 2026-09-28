import type { ToastType } from "../store";

/**
 * Colour and live-region settings for each kind of toast.
 *
 * An error must reach a screen reader even when nobody is looking at the
 * corner, hence `alert` and `assertive`; the rest are `status` and `polite`
 * so they do not cut off whatever is being read. Kept out of Toast.tsx so that
 * file only exports components (fast refresh).
 */
export function toastPresentation(type: ToastType) {
  if (type === "error") {
    return { color: "var(--danger)", role: "alert", ariaLive: "assertive" } as const;
  }
  if (type === "info") {
    return { color: "var(--primary)", role: "status", ariaLive: "polite" } as const;
  }
  return { color: "var(--success)", role: "status", ariaLive: "polite" } as const;
}
