// Global keyboard shortcuts. Registered once from App; every handler bails out
// while the user is typing so the bindings never eat text input.

import { useStore } from "../store";

/** True when the event targets a text field, so single-key bindings must not fire. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.closest) return false;
  return !!el.closest("input, textarea, select, [contenteditable='true']");
}

/** Shortcut reference shown in the help dialog. */
export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "Espacio", label: "Reproducir o pausar" },
  { keys: "← / →", label: "Pista anterior / siguiente" },
  { keys: "⌘/Ctrl + F", label: "Buscar en la biblioteca" },
  { keys: "⌘/Ctrl + N", label: "Nueva lista para culto" },
  { keys: "Esc", label: "Cerrar diálogo o panel" },
  { keys: "?", label: "Mostrar esta ayuda" },
];

/** Install the global bindings. Returns the matching cleanup function. */
export function registerShortcuts(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    const s = useStore.getState();
    const mod = e.metaKey || e.ctrlKey;

    // Esc closes whatever is layered on top, innermost first. Allowed while
    // typing so it also works from inside a dialog's fields.
    if (e.key === "Escape") {
      if (s.dialog) {
        e.preventDefault();
        s.closeDialog();
      } else if (s.detailOpen) {
        e.preventDefault();
        s.closeDetail();
      } else if (s.query) {
        e.preventDefault();
        s.clearQuery();
      }
      return;
    }

    if (mod && (e.key === "f" || e.key === "F")) {
      e.preventDefault();
      s.showBiblioteca();
      // The field is already mounted when the library is on screen; otherwise
      // retry once the view switch has rendered it. A timeout rather than
      // requestAnimationFrame, which never fires while the window is hidden.
      const focusSearch = () => {
        const el = document.querySelector<HTMLInputElement>("[data-search-input]");
        el?.focus();
        return !!el;
      };
      if (!focusSearch()) setTimeout(focusSearch, 0);
      return;
    }

    if (mod && (e.key === "n" || e.key === "N")) {
      e.preventDefault();
      s.newList();
      return;
    }

    // Everything below is a bare key, so never while typing or in a dialog.
    if (isTyping(e.target) || s.dialog) return;

    // `code` is layout-independent and survives input methods that leave
    // `key` empty, so accept either spelling of the space bar.
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      s.togglePlay();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      s.next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      s.prev();
    } else if (e.key === "?") {
      e.preventDefault();
      s.openHelp();
    }
  };

  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}
