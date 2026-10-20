import type { Playlist } from "../lib/types";
import { backend } from "../lib/backend";
import { modulo } from "./contexto";
import type { Contexto, Get, Set } from "./contexto";
import { filasDeLista, pistasParaAgregar, seleccionVigente } from "./selectores";

// Parte del store (#134). Ver src/store/index.ts.
// Las listas de canciones: crearlas y ordenarlas.

export interface CultosSlice {
  playlists: Playlist[];
  plOrder: Record<string, string[]>;
  /**
   * A shared playlist file that has been read and matched, waiting for the
   * user to look at what was found before anything is created.
   */

  // ---- collections ----
  curPlaylist: string;
  draggingId: string | null;
  overId: string | null;
  /**
   * What just happened to the order, for a screen reader.
   *
   * Moving a row with the keyboard is silent otherwise: the list re-renders,
   * but nothing says where the song ended up.
   */
  reorderNotice: string;
  openPlaylist: (id: string) => void;

  /** Append the selection to a list, in the order it is shown. */
  agregarPistas: (playlistId: string, ids: readonly string[]) => void;
  bulkAddToPlaylist: (playlistId: string) => void;

  playAll: () => void;
  /** Show the sheet as it will be printed, before anything leaves the app. */
  newList: () => void;
  createList: (nombre: string) => void;
  editCurrentList: () => void;
  updateList: (nombre: string) => void;
  openAddToList: () => void;
  addToListConfirm: (playlistId: string) => void;
  /**
   * Abrir, desde el culto abierto, el diálogo que elige varias canciones de la
   * biblioteca de una vez. La dirección contraria a «Agregar a una lista».
   */
  abrirAgregarCanciones: () => void;
  /** Agregar al final del culto abierto lo elegido en ese diálogo, y cerrarlo. */
  agregarAlCultoAbierto: (ids: readonly string[]) => void;
  deleteCurrentList: () => void;
  /** Copy a list with its whole order and open the copy. */
  duplicateList: (id: string) => void;
  /** Copy the open list. */
  duplicateCurrentList: () => void;
  removeFromPl: (id: string) => void;
  reorderPl: (toId: string) => void;
  /** Move a track up or down the open list. The keyboard's way in. */
  moveInPlaylist: (id: string, delta: number) => void;
  setDragging: (id: string) => void;
  setOver: (id: string | null) => void;
  clearDrag: () => void;
}

export function crearCultos(set: Set, get: Get, ctx: Contexto): CultosSlice {
  const { toast, applyPlaylists, saveOrder, tocarCulto } = ctx;
  return {
    playlists: [],
    plOrder: {},

    curPlaylist: "",
    draggingId: null,
    overId: null,
    reorderNotice: "",
    openPlaylist: (id) => {
      set({ view: "lista", curPlaylist: id });
      tocarCulto(id);
    },

    // Todo lo que agrega pistas a una lista pasa por aquí: el diálogo, y los
    // dos sitios donde se puede soltar un arrastre. Antes había dos acciones
    // con dos comportamientos —una para una pista, otra para la selección— y
    // la de una pista decía «Ya está en la lista» mientras la otra se callaba.
    agregarPistas: (playlistId, ids) => {
      if (ids.length === 0) return;
      const nombre = get().playlists.find((p) => p.id === playlistId)?.nombre ?? "la lista";
      const hecho = (n: number) => {
        set({ rowMenu: null });
        // Cero es un resultado, no un fallo: significa que ya estaban todas, y
        // decir «0 pistas agregadas» sería contarlo como si algo hubiera ido
        // mal.
        if (n === 0) {
          toast(ids.length === 1 ? `Ya estaba en «${nombre}»` : `Ya estaban todas en «${nombre}»`, { tipo: "info" });
          return;
        }
        tocarCulto(playlistId);
        toast(`Agregadas a «${nombre}»`, {
          detalle: n === 1 ? "1 pista, al final de la lista." : `${n} pistas, al final de la lista.`,
        });
      };
      const yaEstaban = (get().plOrder[playlistId] || []).length;
      backend()
        .addTracksToPlaylist(playlistId, [...ids])
        .then((listas) => {
          applyPlaylists(listas);
          hecho((get().plOrder[playlistId] || []).length - yaEstaban);
        })
        .catch((err) => {
          console.error("add_tracks_to_playlist failed", err);
          toast("No se pudieron agregar las pistas", { tipo: "error" });
        });
    },

    bulkAddToPlaylist: (playlistId) => get().agregarPistas(playlistId, seleccionVigente(get())),

    /**
     * Abre el único sitio desde el que se agrega a un culto.
     *
     * No abre nada si no hay qué agregar: un diálogo vacío con un «Cancelar»
     * es peor que no responder al atajo.
     */
    openAddToList: () => {
      if (pistasParaAgregar(get()).length === 0) return;
      set({ dialog: "addToList", rowMenu: null });
    },

    addToListConfirm: (playlistId) => {
      const ids = pistasParaAgregar(get());
      get().agregarPistas(playlistId, ids);
      // La selección se deshace al terminar: lo que se quería hacer con ella
      // ya está hecho, y dejarla puesta deja la fila de herramientas ocupada
      // por una barra que ya no tiene trabajo.
      set({ dialog: null, selection: [], selAnchor: null });
    },

    abrirAgregarCanciones: () => {
      if (!get().playlists.some((p) => p.id === get().curPlaylist)) return;
      set({ dialog: "agregarCanciones", rowMenu: null });
    },

    agregarAlCultoAbierto: (ids) => {
      set({ dialog: null });
      // `agregarPistas` ya avisa de cuántas entraron y no repite las que
      // estaban; la selección de la biblioteca no se toca, porque esto no
      // salió de ella.
      get().agregarPistas(get().curPlaylist, ids);
    },

    playAll: () => {
      const ord = filasDeLista(get()).map((t) => t.id);
      if (ord.length) {
        get().play(ord[0], ord.slice());
        toast("Reproduciendo la lista completa");
      }
    },
    newList: () => set({ dialog: "newList" }),
    createList: (nombre) => {
      set({ dialog: null });
      const name = nombre.trim() || "Lista sin título";
      backend()
        .createPlaylist(name)
        .then(async (id) => {
          applyPlaylists(await backend().getPlaylists());
          set({ view: "lista", curPlaylist: id });
          toast("Lista creada");
        })
        .catch((err) => {
          console.error(err);
          toast("No se pudo crear la lista", { tipo: "error" });
        });
    },
    duplicateList: (id) => {
      const st = get();
      const pl = st.playlists.find((p) => p.id === id);
      if (!pl) return;
      backend()
        .duplicatePlaylist(id)
        .then(async (nuevo) => {
          applyPlaylists(await backend().getPlaylists());
          set({ view: "lista", curPlaylist: nuevo });
          toast("Lista duplicada");
        })
        .catch((err) => {
          console.error(err);
          toast("No se pudo duplicar la lista", { tipo: "error" });
        });
    },
    duplicateCurrentList: () => get().duplicateList(get().curPlaylist),
    editCurrentList: () => set({ dialog: "editList" }),
    updateList: (nombre) => {
      const id = get().curPlaylist;
      const name = nombre.trim() || "Lista sin título";
      set({ dialog: null });
      backend()
        .updatePlaylist(id, name)
        .then((listas) => {
          applyPlaylists(listas);
          tocarCulto(id);
          toast("Lista actualizada");
        })
        .catch((err) => {
          console.error(err);
          toast("No se pudo actualizar la lista", { tipo: "error" });
        });
    },
    deleteCurrentList: () => {
      const st = get();
      const id = st.curPlaylist;
      const pl = st.playlists.find((p) => p.id === id);
      if (!pl) return;
      const n = (st.plOrder[id] || []).length;
      st.askConfirm({
        title: "¿Eliminar esta lista?",
        message: `«${pl.nombre}» se borrará de las listas de canciones.`,
        detail:
          n > 0
            ? `La lista tiene ${n} ${n === 1 ? "pista" : "pistas"} en su orden. Ese orden se pierde y no se puede deshacer.`
            : "La lista está vacía.",
        safe: "Las pistas siguen en tu biblioteca; solo se borra la lista.",
        confirmLabel: "Eliminar lista",
        onConfirm: () => {
          backend()
            .deletePlaylist(id)
            .then((listas) => {
              applyPlaylists(listas);
              set({ view: "colecciones" });
              toast("Lista eliminada");
            })
            .catch((err) => {
              console.error(err);
              toast("No se pudo eliminar la lista", { tipo: "error" });
            });
        },
      });
    },
    removeFromPl: (id) => {
      const cur2 = get().curPlaylist;
      const prev = get().plOrder[cur2] || [];
      const next = prev.filter((x) => x !== id);
      saveOrder(cur2, next, prev);
      toast("Quitada de la lista");
    },
    setDragging: (id) => {
      modulo.dragId = id;
      set({ draggingId: id });
    },
    // `s` y no `{}` cuando no cambia: `{}` sigue siendo un estado nuevo y
    // despertaría a todo el store en cada `dragover`, decenas de veces por segundo.
    setOver: (id) => set((s) => (id !== s.overId ? { overId: id } : s)),
    reorderPl: (toId) => {
      const from = modulo.dragId;
      const cur2 = get().curPlaylist;
      if (from && toId && from !== toId) {
        const arr = (get().plOrder[cur2] || []).slice();
        const fi = arr.indexOf(from);
        const ti = arr.indexOf(toId);
        if (fi > -1 && ti > -1) {
          const prev = (get().plOrder[cur2] || []).slice();
          arr.splice(fi, 1);
          arr.splice(ti, 0, from);
          saveOrder(cur2, arr, prev);
        }
      }
      set({ draggingId: null, overId: null });
      modulo.dragId = null;
    },
    moveInPlaylist: (id, delta) => {
      const pid = get().curPlaylist;
      const prev = (get().plOrder[pid] || []).slice();
      const desde = prev.indexOf(id);
      const hasta = desde + delta;
      // Silently at the ends: the buttons are disabled there, and a keypress
      // that cannot move anything should do nothing rather than wrap around.
      if (desde < 0 || hasta < 0 || hasta >= prev.length) return;
      const next = prev.slice();
      next.splice(desde, 1);
      next.splice(hasta, 0, id);
      saveOrder(pid, next, prev);
      const titulo = get().tracks.find((t) => t.id === id)?.titulo ?? "La pista";
      set({ reorderNotice: `«${titulo}», posición ${hasta + 1} de ${next.length}` });
    },
    clearDrag: () => {
      set({ draggingId: null, overId: null });
      modulo.dragId = null;
    },
  };
}
