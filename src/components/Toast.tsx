import { X } from "lucide-react";
import { useStore, type ToastType } from "../store";

export function toastPresentation(type: ToastType) {
  if (type === "error") {
    return { color: "var(--danger)", role: "alert", ariaLive: "assertive" } as const;
  }
  if (type === "info") {
    return { color: "var(--primary)", role: "status", ariaLive: "polite" } as const;
  }
  return { color: "var(--success)", role: "status", ariaLive: "polite" } as const;
}

/**
 * El aviso de la esquina.
 *
 * Una tarjeta abajo a la derecha, no una píldora en el centro. La píldora se
 * cruzaba por delante de la barra del reproductor y de lo que se estuviera
 * mirando, y como solo cabía una línea había que meter en ella el qué y el
 * cuánto a la vez: «3 pistas agregadas a "Domingo de alabanza"». Aquí el
 * titular se lee de un vistazo y el detalle está debajo si hace falta.
 *
 * Y se puede cerrar. Un aviso que tapa algo y no se quita hasta que él quiere
 * es un aviso que estorba.
 */
export default function Toast() {
  const toast = useStore((s) => s.toast);
  const closeToast = useStore((s) => s.closeToast);
  if (!toast) return null;
  const { color, role, ariaLive } = toastPresentation(toast.type);

  return (
    <div
      role={role}
      aria-live={ariaLive}
      style={{
        position: "fixed",
        right: 14,
        // Por encima de la barra del reproductor, que mide 60.
        bottom: 72,
        zIndex: 70,
        display: "flex",
        alignItems: "flex-start",
        gap: 9,
        width: 330,
        padding: "10px 12px",
        border: "1px solid var(--border-2)",
        borderRadius: 10,
        background: "var(--surface)",
        boxShadow: "var(--sh-lg)",
        animation: "canToast .2s ease-out",
      }}
    >
      {/* Un punto del color del tipo, no un icono. A este tamaño un icono de
          16 px compite con el titular, y lo único que tiene que decir es si
          esto salió bien o mal. */}
      <span
        aria-hidden
        style={{ width: 8, height: 8, flex: "0 0 auto", borderRadius: "50%", marginTop: 5, background: color }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{toast.titulo}</span>
        {toast.detalle && (
          <span style={{ display: "block", fontSize: 11, color: "var(--text-2)", lineHeight: 1.5, marginTop: 1 }}>
            {toast.detalle}
          </span>
        )}
      </span>
      <button
        onClick={closeToast}
        aria-label="Cerrar el aviso"
        className="hb-s2t"
        style={{ flex: "0 0 auto", width: 18, height: 18, borderRadius: 5, display: "grid", placeItems: "center", color: "var(--text-3)" }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
