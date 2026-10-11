import { type DuplicateGroup } from "../lib/api";
import { backend } from "../lib/backend";
import type { Contexto, Get, Set } from "./contexto";
import { AVISO_COPIA_AUTOMATICA } from "./reglas";

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

      get().askConfirm({
        title: "¿Fusionar estas copias?",
        message: `Se queda «${queda.titulo}» (${queda.formato}, ${queda.carpeta}). Las demás salen de la biblioteca.`,
        detail: copias.map((c) => `${c.formato} · ${c.carpeta}\n${c.path}`).join("\n\n"),
        safe:
          "Su favorito y su sitio en las listas para culto pasan a la que se queda. " +
          "Los archivos de audio no se borran del disco. " +
          AVISO_COPIA_AUTOMATICA,
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
