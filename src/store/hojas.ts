import { type Sheet } from "../lib/api";
import { backend } from "../lib/backend";
import { soloPistas } from "../lib/momentos";
import type { SaveState } from "./tipos";
import type { Contexto, Get, Set } from "./contexto";

// Parte del store (#134). Ver src/store/index.ts.
// Letras y acordes: el editor.

export interface HojasSlice {
  // ---- lyrics and chords ----
  /**
   * Sheets already fetched, by track id.
   *
   * A cache rather than part of the catalogue: the snapshot travels whole and
   * has no business carrying a few thousand songs' worth of text.
   */
  sheets: Record<string, Sheet>;
  /** Track whose sheet is open in the editor, or null. */
  sheetDialog: string | null;
  /** How the sheet being edited is doing, reusing the panel's own states. */
  sheetState: SaveState;

  /** Fetch one track's sheet if it is not already in hand. */
  loadSheet: (id: string) => void;
  /** Fetch the sheets of a whole list, for the export. */
  loadSheets: (ids: string[]) => Promise<void>;
  /** Open the sheet editor on a track. */
  openSheetEditor: (id: string) => void;
  closeSheetEditor: () => void;
  /** Change one half of the open sheet. It writes itself, debounced. */
  setSheet: (campo: "letra" | "acordes", valor: string) => void;
  /** Write a sheet still waiting out the debounce, right now. */
  flushSheet: () => void;
}

export function crearHojas(set: Set, get: Get, ctx: Contexto): HojasSlice {
  const { toast, writePendingSheet, scheduleSheetSave } = ctx;
  return {

    sheets: {},
    sheetDialog: null,
    sheetState: "idle",

    loadSheet: (id) => {
      if (get().sheets[id]) return;
      backend()
        .getTrackSheet(id)
        .then((hoja) => {
          set((st) => ({ sheets: { ...st.sheets, [id]: hoja } }));
        })
        .catch((err) => {
          console.error("get_track_sheet failed", err);
          toast("No se pudo leer la letra de esta pista", { tipo: "error" });
        });
    },

    loadSheets: async (ids) => {
      // Un momento del culto no tiene hoja (#145), y su id no es de pista: el
      // núcleo no sabría qué hacer con él.
      const faltan = soloPistas(ids).filter((id) => !get().sheets[id]);
      if (faltan.length === 0) return;
      // Tracks with nothing written do not come back, so they are seeded empty
      // here — otherwise every view of them would ask again.
      const vacias = Object.fromEntries(
        faltan.map((id) => [id, { trackId: id, letra: "", acordes: "" }] as const),
      );
      try {
        const hojas = await backend().getSheets(faltan);
        const traidas = Object.fromEntries(hojas.map((h) => [h.trackId, h] as const));
        set((st) => ({ sheets: { ...st.sheets, ...vacias, ...traidas } }));
      } catch (err) {
        console.error("get_sheets failed", err);
        toast("No se pudieron leer las letras de esta lista", { tipo: "error" });
      }
    },

    openSheetEditor: (id) => {
      get().loadSheet(id);
      set({ sheetDialog: id, sheetState: "idle" });
    },

    closeSheetEditor: () => {
      writePendingSheet();
      set({ sheetDialog: null });
    },

    setSheet: (campo, valor) => {
      const id = get().sheetDialog;
      if (!id) return;
      const actual = get().sheets[id] ?? { trackId: id, letra: "", acordes: "" };
      const siguiente = { ...actual, [campo]: valor };
      set((st) => ({
        sheets: { ...st.sheets, [id]: siguiente },
        // The catalogue only carries whether there is a sheet, so it is kept in
        // step here rather than waiting for the next snapshot.
        tracks: st.tracks.map((t) =>
          t.id === id
            ? { ...t, tieneHoja: !!(siguiente.letra.trim() || siguiente.acordes.trim()) }
            : t,
        ),
        sheetState: "saving",
      }));
      scheduleSheetSave(id);
    },

    flushSheet: () => writePendingSheet(),
  };
}
