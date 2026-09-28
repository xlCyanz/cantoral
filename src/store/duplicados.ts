import { type DuplicateGroup, type DuplicateTrack } from "../lib/api";
import { backend } from "../lib/backend";
import type { Contexto, Get, Set } from "./contexto";

// Parte del store (#134). Ver src/store/index.ts.
// Buscar, fusionar y descartar pistas repetidas.

export interface DuplicadosSlice {
  // ---- duplicates ----
  /** Groups of tracks that look like the same song. Empty until searched. */
  duplicates: DuplicateGroup[];
  /** How many groups the user has waved off, so they can be offered back. */
  duplicatesDismissed: number;
  duplicatesState: "idle" | "buscando" | "listo";

  /** Look for tracks that are the same song. */
  findDuplicates: () => void;
  /** Fold a group's other copies into the one chosen, after confirming. */
  mergeDuplicates: (signature: string, keepId: string) => void;
  /** Mark a group as not duplicates, so it stops being offered. */
  dismissDuplicates: (signature: string) => void;
  /** Offer every dismissed group again. */
  restoreDismissedDuplicates: () => void;
}

export function crearDuplicados(set: Set, get: Get, ctx: Contexto): DuplicadosSlice {
  const { toast, applySnapshot } = ctx;
  return {

    duplicates: [],
    duplicatesDismissed: 0,
    duplicatesState: "idle",

    findDuplicates: () => {
      set({ duplicatesState: "buscando" });
      backend()
        .findDuplicates()
        .then((r) => {
          set({ duplicates: r.groups, duplicatesDismissed: r.dismissed, duplicatesState: "listo" });
        })
        .catch((err) => {
          console.error("find_duplicates failed", err);
          set({ duplicatesState: "idle" });
          toast(String(err), { tipo: "error" });
        });
    },

    mergeDuplicates: (signature, keepId) => {
      const grupo = get().duplicates.find((g) => g.signature === signature);
      const queda = grupo?.tracks.find((t) => t.id === keepId);
      if (!grupo || !queda) return;
      const copias = grupo.tracks.filter((t) => t.id !== keepId);
      if (copias.length === 0) return;

      // The core hands a sheetless survivor the sheet of the first copy that has
      // one (lowest id) and never overwrites the survivor's own. Any other copy
      // with a sheet loses it, and hand-written lyrics are the one thing here
      // the disk cannot give back — so it is said before, copy by copy (#126).
      // The duplicate report does not carry the flag; the catalogue does.
      const conHoja = (id: string) => get().tracks.find((t) => t.id === id)?.tieneHoja ?? false;
      const copiasConHoja = copias.filter((c) => conHoja(c.id)).sort((a, b) => Number(a.id) - Number(b.id));
      const heredada = conHoja(keepId) ? undefined : copiasConHoja[0];
      // By file name: the copies often share title, format and folder.
      const cual = (c: DuplicateTrack) => `«${c.path.split(/[\\/]/).pop()}» (${c.formato} · ${c.carpeta})`;
      const avisoHojas = copiasConHoja
        .filter((c) => c !== heredada)
        .map(
          (c) =>
            `La copia ${cual(c)} tiene una letra escrita que se perderá: ` +
            (heredada ? `se queda la de ${cual(heredada)}.` : "la que se queda ya tiene la suya."),
        );

      get().askConfirm({
        title: "¿Fusionar estas copias?",
        message: `Se queda «${queda.titulo}» (${queda.formato}, ${queda.carpeta}). Las demás salen de la biblioteca.`,
        detail: [...copias.map((c) => `${c.formato} · ${c.carpeta}\n${c.path}`), ...avisoHojas].join("\n\n"),
        safe:
          "Su favorito, la letra y los acordes, y su sitio en las listas para culto pasan a la que se queda. " +
          "Los archivos de audio no se borran del disco.",
        confirmLabel: "Fusionar",
        onConfirm: () => {
          const ids = copias.map((c) => c.id);
          backend()
            .mergeDuplicates(keepId, ids)
            .then((snap) => {
              applySnapshot(snap);
              toast(ids.length === 1 ? "1 copia fusionada" : `${ids.length} copias fusionadas`, {
                detalle: "Se quedó una con el favorito y su sitio en los cultos.",
              });
              // `applySnapshot` cleared the list; fill it with what is left.
              get().findDuplicates();
            })
            .catch((err) => {
              console.error("merge_duplicates failed", err);
              toast(String(err), { tipo: "error" });
            });
        },
      });
    },

    dismissDuplicates: (signature) => {
      backend()
        .dismissDuplicates(signature)
        .then((r) => {
          set({ duplicates: r.groups, duplicatesDismissed: r.dismissed });
        })
        .catch((err) => {
          console.error("dismiss_duplicates failed", err);
          toast(String(err), { tipo: "error" });
        });
    },

    restoreDismissedDuplicates: () => {
      backend()
        .restoreDismissedDuplicates()
        .then((r) => {
          set({ duplicates: r.groups, duplicatesDismissed: r.dismissed });
        })
        .catch((err) => {
          console.error("restore_dismissed_duplicates failed", err);
          toast(String(err), { tipo: "error" });
        });
    },
  };
}
