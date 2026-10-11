import type { Playlist, TipoMomento } from "../lib/types";
import { armarArchivoDeCulto, emparejar, nombreDeArchivo, ordenDelImportado } from "../lib/compartir";
import type { ArchivoDeLista } from "../lib/compartir";
import { esMomento, soloPistas } from "../lib/momentos";
import { backend } from "../lib/backend";
import type { ImportPreview } from "./tipos";
import { modulo } from "./contexto";
import type { Contexto, Get, Set } from "./contexto";
import { elementosDeLista, momentosPorId, pistasParaAgregar, seleccionVigente } from "./selectores";

// Parte del store (#134). Ver src/store/index.ts.
// Las listas para cultos: crearlas, ordenarlas, compartirlas e imprimirlas.

export interface CultosSlice {
  playlists: Playlist[];
  plOrder: Record<string, string[]>;
  /**
   * A shared playlist file that has been read and matched, waiting for the
   * user to look at what was found before anything is created.
   */
  importPreview: ImportPreview | null;

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
  exportPl: () => void;
  /** Show the sheet as it will be printed, before anything leaves the app. */
  openPrintPreview: () => void;
  newList: () => void;
  /** `desde` is the id of the template whose order the new list starts from. */
  createList: (nombre: string, desde?: string) => void;
  editCurrentList: () => void;
  updateList: (nombre: string) => void;
  openAddToList: () => void;
  addToListConfirm: (playlistId: string) => void;
  /**
   * Abrir, desde el culto abierto, el diálogo que elige varias canciones de la
   * biblioteca de una vez. La dirección contraria a «Agregar a un culto».
   */
  abrirAgregarCanciones: () => void;
  /** Agregar al final del culto abierto lo elegido en ese diálogo, y cerrarlo. */
  agregarAlCultoAbierto: (ids: readonly string[]) => void;
  deleteCurrentList: () => void;
  /** Copy a list with its whole order and open the copy. */
  duplicateList: (id: string) => void;
  /** Copy the open list. */
  duplicateCurrentList: () => void;
  /** Keep the open list as a starting point for new ones, or stop doing so. */
  toggleCurrentTemplate: () => void;
  /** Write the open list as a file another installation can import. */
  shareCurrentList: () => void;
  /** Read a shared list and show what it matched, without creating anything. */
  importList: () => void;
  /** Create the list the import preview describes. */
  confirmImport: () => void;
  /**
   * Qué momento está abriendo el diálogo de momentos: su id para cambiarlo,
   * `null` para añadir uno nuevo al final del culto abierto (#145).
   */
  momentoEditado: string | null;
  /** Abrir el diálogo para añadir un momento sin música al culto abierto. */
  nuevoMomento: () => void;
  /** Abrir el diálogo sobre un momento que ya está en el culto. */
  editarMomento: (id: string) => void;
  /** Guardar lo que dice el diálogo: el momento nuevo o el cambio. */
  guardarMomento: (tipo: TipoMomento, titulo: string, texto: string) => void;
  removeFromPl: (id: string) => void;
  reorderPl: (toId: string) => void;
  /** Move a track up or down the open list. The keyboard's way in. */
  moveInPlaylist: (id: string, delta: number) => void;
  setDragging: (id: string) => void;
  setOver: (id: string | null) => void;
  clearDrag: () => void;
}

export function crearCultos(set: Set, get: Get, ctx: Contexto): CultosSlice {
  const { toast, avisarFallo, applyPlaylists, escribirHoja, saveOrder, tocarCulto } = ctx;
  return {
    playlists: [],
    plOrder: {},
    importPreview: null,
    momentoEditado: null,

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
          detalle: n === 1 ? "1 pista, al final del culto." : `${n} pistas, al final del culto.`,
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
      // Los momentos no suenan: «Reproducir todo» pasa de largo (#145).
      const ord = soloPistas(get().plOrder[get().curPlaylist] || []);
      if (ord.length) {
        get().play(ord[0], ord.slice());
        toast("Reproduciendo la lista completa");
      }
    },
    exportPl: () => {
      const s = get();
      const pl = s.playlists.find((p) => p.id === s.curPlaylist);
      const ord = s.plOrder[s.curPlaylist] || [];
      // El culto entero, momentos incluidos: la hoja los enseña en su sitio.
      const rows = elementosDeLista(s);
      if (!pl || rows.length === 0) {
        toast("La lista está vacía");
        return;
      }
      escribirHoja(pl, rows, ord);
    },
    openPrintPreview: () => {
      const s = get();
      const hay = elementosDeLista(s).length > 0;
      if (!s.playlists.some((p) => p.id === s.curPlaylist) || !hay) {
        toast("La lista está vacía");
        return;
      }
      set({ dialog: "printPreview" });
    },
    newList: () => set({ dialog: "newList" }),
    createList: (nombre, desde) => {
      set({ dialog: null });
      const name = nombre.trim() || "Lista sin título";
      backend()
        .createPlaylist(name, desde)
        .then(async (id) => {
          applyPlaylists(await backend().getPlaylists());
          set({ view: "lista", curPlaylist: id });
          toast(desde ? "Lista creada desde la plantilla" : "Lista creada");
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
    shareCurrentList: () => {
      const s = get();
      const pl = s.playlists.find((p) => p.id === s.curPlaylist);
      const rows = elementosDeLista(s);
      if (!pl) return;
      if (rows.length === 0) {
        toast("La lista está vacía");
        return;
      }
      const json = JSON.stringify(armarArchivoDeCulto(pl, rows), null, 2);
      const name = nombreDeArchivo(pl.nombre);
      backend()
        .saveSharedList(name, json)
        .then((guardada) => {
          if (guardada) toast("Lista exportada para otra instalación");
        })
        .catch((err) => avisarFallo(err, "No se pudo exportar la lista"));
    },
    importList: () => {
      // Read and match before anything is created: the screen that follows is
      // the whole point, and it cannot say «faltan dos» after the fact.
      const mostrar = (archivo: ArchivoDeLista) => {
        const resultado = emparejar(archivo.pistas, get().tracks);
        set({ importPreview: { archivo, resultado }, dialog: "importList" });
      };
      backend()
        .openSharedList()
        .then((archivo) => {
          if (archivo) mostrar(archivo);
        })
        .catch((err) => {
          console.error(err);
          toast(String(err), { tipo: "error" });
        });
    },
    confirmImport: () => {
      const previo = get().importPreview;
      if (!previo) return;
      const momentos = previo.archivo.momentos ?? [];
      if (previo.resultado.encontradas.length === 0) return;
      const { nombre } = previo.archivo.lista;
      set({ dialog: null, importPreview: null });
      const aviso = () => {
        const faltan = previo.resultado.faltantes.length;
        toast("Lista importada", {
          detalle:
            faltan === 0
              ? undefined
              : `${faltan} ${faltan === 1 ? "pista no está" : "pistas no están"} en esta biblioteca.`,
          tipo: faltan === 0 ? "success" : "info",
        });
      };
      backend()
        .createPlaylist(nombre)
        .then(async (id) => {
          // Los momentos se crean primero, uno a uno —cada uno entra al final—,
          // y después el orden los pone en su sitio entre las pistas.
          const creados: { trasPistas: number; id: string }[] = [];
          for (const m of momentos) {
            const listas = await backend().addPlaylistMomento(id, m.tipo, m.titulo, m.texto);
            const ids = listas.find((p) => p.id === id)?.ids ?? [];
            const nuevo = ids[ids.length - 1];
            if (nuevo && esMomento(nuevo)) creados.push({ trasPistas: m.trasPistas, id: nuevo });
          }
          const orden = ordenDelImportado(previo.archivo.pistas, previo.resultado.encontradas, creados);
          await backend().setPlaylistOrder(id, orden);
          applyPlaylists(await backend().getPlaylists());
          set({ view: "lista", curPlaylist: id });
          aviso();
        })
        .catch((err) => {
          console.error(err);
          toast("No se pudo importar la lista", { tipo: "error" });
        });
    },
    toggleCurrentTemplate: () => {
      const st = get();
      const id = st.curPlaylist;
      const pl = st.playlists.find((p) => p.id === id);
      if (!pl) return;
      const plantilla = !pl.plantilla;
      const aviso = plantilla ? "Guardada como plantilla" : "Ya no es una plantilla";
      backend()
        .setPlaylistTemplate(id, plantilla)
        .then((listas) => {
          applyPlaylists(listas);
          toast(aviso);
        })
        .catch((err) => {
          console.error(err);
          toast("No se pudo cambiar la plantilla", { tipo: "error" });
        });
    },
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
      const n = soloPistas(st.plOrder[id] || []).length;
      st.askConfirm({
        title: "¿Eliminar esta lista?",
        message: `«${pl.nombre}» se borrará de las listas para cultos.`,
        detail:
          n > 0
            ? `La lista tiene ${n} ${n === 1 ? "pista" : "pistas"} en su orden de culto. Ese orden se pierde y no se puede deshacer.`
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
    nuevoMomento: () => set({ dialog: "momento", momentoEditado: null }),
    editarMomento: (id) => set({ dialog: "momento", momentoEditado: id }),
    guardarMomento: (tipo, titulo, texto) => {
      const limpio = titulo.trim();
      if (!limpio) return;
      const editado = get().momentoEditado;
      const pid = get().curPlaylist;
      set({ dialog: null, momentoEditado: null });
      const pedido = editado
        ? backend().updatePlaylistMomento(editado, tipo, limpio, texto)
        : backend().addPlaylistMomento(pid, tipo, limpio, texto);
      pedido
        .then((listas) => {
          applyPlaylists(listas);
          tocarCulto(pid);
          toast(editado ? "Momento actualizado" : `«${limpio}» añadido al culto`, {
            detalle: editado ? undefined : "Al final del orden. Arrástralo a su sitio.",
          });
        })
        .catch((err) => {
          console.error(editado ? "update_playlist_momento failed" : "add_playlist_momento failed", err);
          toast(editado ? "No se pudo cambiar el momento" : "No se pudo añadir el momento", { tipo: "error" });
        });
    },
    removeFromPl: (id) => {
      const cur2 = get().curPlaylist;
      const prev = get().plOrder[cur2] || [];
      const next = prev.filter((x) => x !== id);
      // Quitar un momento lo borra: no está en la biblioteca, solo en este
      // culto. El orden que se guarda sin él es lo que se lo dice al núcleo.
      saveOrder(cur2, next, prev);
      toast(esMomento(id) ? "Momento quitado del culto" : "Quitada de la lista");
    },
    setDragging: (id) => {
      modulo.dragId = id;
      set({ draggingId: id });
    },
    setOver: (id) => set((s) => (id !== s.overId ? { overId: id } : {})),
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
      const titulo = esMomento(id)
        ? (momentosPorId(get().playlists).get(id)?.titulo ?? "El momento")
        : (get().tracks.find((t) => t.id === id)?.titulo ?? "La pista");
      set({ reorderNotice: `«${titulo}», posición ${hasta + 1} de ${next.length}` });
    },
    clearDrag: () => {
      set({ draggingId: null, overId: null });
      modulo.dragId = null;
    },
  };
}
