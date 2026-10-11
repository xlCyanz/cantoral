import type { TrackEdit } from "../lib/types";
import type { SaveState } from "./tipos";
import { modulo } from "./contexto";
import type { Contexto, Get, Set } from "./contexto";

// Parte del store (#134). Ver src/store/index.ts.
// El panel de detalle y la edición de una pista, que se guarda sola.

export interface DetalleSlice {
  // ---- detail panel ----
  selId: string | null;
  detailOpen: boolean;
  /** How the selected track's edit is doing. Edits write themselves. */
  saveState: SaveState;

  /** Change one field of the selected track. It writes itself, debounced. */
  setEdit: (field: keyof TrackEdit, val: string) => void;
  closeDetail: () => void;
  /**
   * Si el panel de detalle aguanta un `Esc`.
   *
   * Vive en la sesión: es un modo de trabajo de un rato —estoy repasando la
   * biblioteca pista por pista y no quiero que se me cierre el panel— y no una
   * decisión que valga la pena recordar hasta la semana que viene.
   */
  detailFijado: boolean;
  toggleDetailFijado: () => void;
  /** Write an edit still waiting out the debounce, right now. */
  flushEdit: () => void;
}

export function crearDetalle(set: Set, get: Get, ctx: Contexto): DetalleSlice {
  const { pausarVideoSiDejaDeVerse, writePendingEdit, scheduleSave } = ctx;
  return {
    detailFijado: false,

    selId: null,
    detailOpen: false,
    saveState: "idle",

    setEdit: (field, val) => {
      const id = get().selId;
      if (!id) return;
      // Straight into the catalogue. There is no pending-edit overlay any more,
      // so nothing can be shown as though it were stored while it is not.
      set((s) => ({
        tracks: s.tracks.map((t) => (t.id === id ? { ...t, [field]: val } : t)),
        saveState: "saving",
      }));
      scheduleSave(id);
    },
    toggleDetailFijado: () => set((st) => ({ detailFijado: !st.detailFijado })),

    closeDetail: () => {
      // Nothing may stay waiting out the debounce once the panel is gone.
      get().flushEdit();
      set({ detailOpen: false });
      // Por el botón o por Esc: el video vive en el panel y se va con él (#125).
      pausarVideoSiDejaDeVerse("El video se pausa al cerrar el panel");
    },
    flushEdit: () => {
      if (modulo.saveTimer) clearTimeout(modulo.saveTimer);
      modulo.saveTimer = null;
      writePendingEdit();
    },
  };
}
