import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

/** What `Tab` is allowed to land on inside a dialog. */
const ENFOCABLES = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** The focusable controls of a container, in tab order. */
export function enfocables(caja: HTMLElement): HTMLElement[] {
  return [...caja.querySelectorAll<HTMLElement>(ENFOCABLES)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Which control `Tab` should move to, when the move has to wrap.
 *
 * Returns `null` when the browser's own behaviour is already right — that is,
 * everywhere except the two edges of the dialog, where `Tab` would otherwise
 * walk out into the page behind it.
 */
export function siguienteFoco(
  lista: readonly HTMLElement[],
  activo: Element | null,
  haciaAtras: boolean,
): HTMLElement | null {
  if (lista.length === 0) return null;
  const primero = lista[0];
  const ultimo = lista[lista.length - 1];
  // Focus that escaped the dialog — or never entered it — comes back in.
  if (!activo || !lista.includes(activo as HTMLElement)) return haciaAtras ? ultimo : primero;
  if (haciaAtras && activo === primero) return ultimo;
  if (!haciaAtras && activo === ultimo) return primero;
  return null;
}

/**
 * The shell every dialog shares: the overlay, the box, and the focus.
 *
 * `aria-modal="true"` promises a screen reader that everything behind is
 * inert. Until now the DOM said otherwise — `Tab` walked straight out into the
 * page under the overlay, and closing the dialog left the focus nowhere. This
 * keeps that promise: focus goes in on open, `Tab` cycles inside, and on close
 * it returns to whatever opened the dialog.
 *
 * Esc is not handled here; it belongs to the global shortcuts, which already
 * know the order the layers close in.
 */
export default function Modal({
  labelledBy,
  describedBy,
  role = "dialog",
  onClose,
  children,
  maxWidth = 520,
  boxStyle,
  overlayStyle,
  overlayZ = 40,
}: {
  /** Id of the element naming the dialog, for `aria-labelledby`. */
  labelledBy: string;
  /** Id of the element that says what is about to happen, for a confirmation. */
  describedBy?: string;
  /** `alertdialog` for something the user must answer before moving on. */
  role?: "dialog" | "alertdialog";
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
  boxStyle?: CSSProperties;
  overlayStyle?: CSSProperties;
  overlayZ?: number;
}) {
  const caja = useRef<HTMLDivElement>(null);
  // Captured while rendering, not in the effect: a dialog whose own control
  // carries `autoFocus` — the confirmation starts on «Cancelar» — has already
  // taken the focus by the time effects run, and what got saved as «where the
  // focus came from» was that button. On close it pointed at a node that was
  // being removed, so the focus fell to the body.
  const [previo] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null),
  );

  useEffect(() => {
    const dentro = caja.current;
    if (dentro && !dentro.contains(document.activeElement)) {
      // A dialog that focuses something itself — the confirmation starts on
      // «Cancelar» on purpose — keeps its own choice.
      enfocables(dentro)[0]?.focus();
    }

    const alTabular = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !caja.current) return;
      const destino = siguienteFoco(enfocables(caja.current), document.activeElement, e.shiftKey);
      if (destino) {
        e.preventDefault();
        destino.focus();
      }
    };
    // Capture, so the dialog decides before anything underneath reacts.
    document.addEventListener("keydown", alTabular, true);
    return () => {
      document.removeEventListener("keydown", alTabular, true);
      // Back to whatever opened this, unless it is gone from the page.
      if (previo && document.contains(previo)) previo.focus();
    };
    // `previo` comes from a lazy `useState`, so it never changes: listing it
    // satisfies the rule without ever re-running the effect.
  }, [previo]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: overlayZ, background: "rgba(25,18,12,.42)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: 24, animation: "canOverlay .18s ease", ...overlayStyle }}
    >
      <div
        ref={caja}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, boxShadow: "var(--sh-lg)", overflow: "hidden", animation: "canDialog .24s cubic-bezier(.22,1,.36,1)", ...boxStyle }}
      >
        {children}
      </div>
    </div>
  );
}
