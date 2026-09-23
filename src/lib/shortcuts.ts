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
  { keys: "⌘/Ctrl + A", label: "Seleccionar todo lo que muestra la biblioteca" },
  { keys: "A", label: "Agregar a un culto lo que esté elegido" },
  { keys: "Mayús / ⌘ + clic", label: "Elegir un tramo o sumar pistas a la selección" },
  { keys: "Esc", label: "Cerrar diálogo o panel, o cortar la proyección" },
  { keys: "↑ / ↓", label: "Canción anterior / siguiente en modo culto" },
  { keys: "+ / −", label: "Subir o bajar el tono en modo culto" },
  { keys: "B", label: "Dejar el proyector en negro" },
  { keys: "→", label: "Pasar al siguiente elemento proyectado" },
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
      // The confirmation sits on top of everything else, so it closes first.
      if (s.confirm) {
        e.preventDefault();
        s.closeConfirm();
      } else if (s.sheetDialog) {
        e.preventDefault();
        s.closeSheetEditor();
      } else if (s.serviceOpen) {
        e.preventDefault();
        s.closeService();
      } else if (s.dialog) {
        e.preventDefault();
        s.closeDialog();
      } else if (s.detailOpen && !s.detailFijado) {
        // Fijado, el panel aguanta el Esc. Etiquetando pista por pista, que se
        // cierre al pulsar Esc para salir de un campo es perder el sitio.
        e.preventDefault();
        s.closeDetail();
      } else if (s.rowMenu) {
        e.preventDefault();
        s.closeRowMenu();
      } else if (s.proyectando) {
        // Con la salida abierta, Esc la corta. Va aquí y no antes porque un
        // diálogo encima sigue siendo lo más interno; y va antes que la
        // selección y la búsqueda porque, en medio de un culto, Esc quiere
        // decir «quita eso de la pantalla grande» y no «deselecciona».
        e.preventDefault();
        s.alternarProyeccion();
      } else if (s.selection.length) {
        e.preventDefault();
        s.clearSelection();
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

    if (mod && (e.key === "a" || e.key === "A")) {
      // Only in the library, and never while typing — where ⌘A means «select
      // this text» and taking it would be infuriating.
      if (isTyping(e.target) || s.view !== "biblioteca" || s.dialog || s.confirm || s.sheetDialog) return;
      e.preventDefault();
      s.selectAllVisible();
      return;
    }

    if (mod && (e.key === "n" || e.key === "N")) {
      e.preventDefault();
      if (!s.confirm) s.newList();
      return;
    }

    // Everything below is a bare key, so never while typing or in a dialog —
    // pressing space to pause must not reach through a confirmation.
    if (isTyping(e.target) || s.dialog || s.confirm || s.sheetDialog) return;

    // The service view takes the arrows while it is up: on the stand they walk
    // the list being sung, not the play queue behind it. Space is left alone,
    // because starting the track is exactly what it is wanted for.
    if (s.serviceOpen) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        s.serviceGo(1);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        s.serviceGo(-1);
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        s.transposeService(1);
        return;
      }
      if (e.key === "-") {
        e.preventDefault();
        s.transposeService(-1);
        return;
      }
    }

    // La vista de proyección se queda con las teclas de la barra de abajo
    // mientras está delante: `B` para el negro y `→` para pasar al siguiente
    // del culto. `→` a secas significaría «siguiente pista de la cola de
    // reproducción», que no es lo que ve la congregación y sería la peor
    // sorpresa posible estando en vivo.
    if (s.view === "proyeccion" && s.proyectando) {
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        s.proyeccionNegro();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        s.proyeccionSiguiente();
        return;
      }
    }

    // `A` a secas abre el único sitio desde el que se agrega a un culto. Sin
    // modificador porque es lo que más se repite armando un domingo, y la
    // acción no decide nada por su cuenta: abre el diálogo, que dice cuántas
    // pistas va a mover antes de que se elija a dónde. Si no hay nada elegido
    // ni nada abierto en el panel, `openAddToList` no hace nada.
    if (e.key === "a" || e.key === "A") {
      e.preventDefault();
      s.openAddToList();
      return;
    }

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
