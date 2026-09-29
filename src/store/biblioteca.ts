import type { Densidad, Folder, GroupBy, LibState, QuickFilter, SortKey, Track } from "../lib/types";
import { cultosAfectados } from "../lib/afectados";
import { alHacerClic } from "../lib/selection";
import type { Modificadores } from "../lib/selection";
import { backend } from "../lib/backend";
import { buscaEnLetras } from "../lib/buscarLetra";
import { modulo } from "./contexto";
import type { Contexto, Get, Set } from "./contexto";
import { seleccionVigente, applyFilters } from "./selectores";
import { estadoDeLaBiblioteca } from "./reglas";

// Parte del store (#134). Ver src/store/index.ts.
// El catálogo, sus filtros, la selección y lo que se hace con las pistas.

export interface BibliotecaSlice {
  // ---- data ----
  tracks: Track[];
  folders: Folder[];
  libState: LibState;

  // ---- library filters ----
  query: string;
  /**
   * Lo último que contestó la búsqueda en las hojas (#144): para qué consulta
   * y, por id de pista, el trozo de letra donde apareció.
   *
   * Aparte de `query` porque llega después, del núcleo y con retardo: el
   * título se filtra al teclear, la letra cuando el núcleo contesta.
   */
  letras: { consulta: string; fragmentos: Record<string, string> } | null;
  qf: QuickFilter;
  ocasion: string | null;
  groupBy: GroupBy;
  densidad: Densidad;
  /**
   * Grupos plegados, por clave.
   *
   * Vive en la sesión y no en las preferencias: plegar «Himnos» es para dejar
   * de verlo *ahora*, mientras se arma un culto con lo de otra carpeta, no una
   * decisión que valga la pena recordar hasta la semana que viene.
   */
  gruposColapsados: string[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";

  // ---- selection ----
  /**
   * Rows picked in the library, for acting on several at once.
   *
   * Click order, not display order — what is done with them is put in display
   * order at the moment of doing it (see `seleccionVigente`).
   */
  selection: string[];
  /** Row a Shift-click measures its run from. */
  selAnchor: string | null;
  /** Ids being dragged out of the library, or empty. */
  dragFromLibrary: string[];
  /** Row whose context menu is open, and where to draw it. */
  rowMenu: { id: string; x: number; y: number } | null;

  onQuery: (v: string) => void;
  clearQuery: () => void;
  /** Busca ya lo escrito en las hojas. Lo llama, con retardo, quien mira `query`. */
  buscarEnLetras: () => Promise<void>;
  onQuickFilter: (q: Exclude<QuickFilter, null>) => void;
  onOcasion: (o: string) => void;
  onGroupBy: (g: GroupBy) => void;
  setDensidad: (d: Densidad) => void;
  toggleGrupo: (clave: string) => void;
  onSortHeader: (k: SortKey) => void;

  onRowClick: (id: string, mods?: Modificadores) => void;
  /** Pick every row the library is currently showing. */
  selectAllVisible: () => void;
  clearSelection: () => void;
  openRowMenu: (id: string, x: number, y: number) => void;
  closeRowMenu: () => void;
  /** Note that a drag out of the library started, carrying `ids`. */
  startLibraryDrag: (ids: string[]) => void;
  endLibraryDrag: () => void;
  /** Mark or unmark the selection as favourites. */
  bulkFav: (fav: boolean) => void;
  /** Drop the selection from the catalogue, after confirming. */
  bulkDelete: () => void;
  onFav: (id: string) => void;

  /** Show a track's file in the system file manager. */
  revealTrack: (id: string) => void;
  /** Point a track at its file's new location, keeping what it carries. */
  relocateTrack: (id: string) => void;
  /** Drop a track from the catalogue. The audio file is never touched. */
  deleteTrack: (id: string) => void;
}

export function crearBiblioteca(set: Set, get: Get, ctx: Contexto): BibliotecaSlice {
  const { toast, avisarFallo, pausarVideoSiDejaDeVerse, applySnapshot } = ctx;
  return {
    // Empty until `hydrate()` fills it from the backend — SQLite in the app,
    // the seed in the browser. Starting from the seed in the browser used to
    // be a second way in, and one that had to be kept out of the app (#135).
    tracks: [],
    folders: [],
    libState: "empty",

    query: "",
    letras: null,
    qf: null,
    ocasion: null,
    groupBy: "none",
    densidad: "comoda",
    gruposColapsados: [],
    sortKey: "titulo",
    sortDir: "asc",

    selection: [],
    selAnchor: null,
    dragFromLibrary: [],
    rowMenu: null,

    onQuery: (v) => set({ query: v }),
    clearQuery: () => set({ query: "" }),
    buscarEnLetras: async () => {
      if (modulo.letrasTimer) clearTimeout(modulo.letrasTimer);
      modulo.letrasTimer = null;
      const consulta = get().query.trim();
      // Cada búsqueda deja atrás a las que siguen en camino: si contestan
      // tarde, su respuesta es de algo que ya no está escrito.
      const turno = ++modulo.letrasGen;
      if (!buscaEnLetras(consulta)) {
        if (get().letras) set({ letras: null });
        return;
      }
      try {
        const hits = await backend().searchLyrics(consulta);
        if (turno !== modulo.letrasGen) return;
        set({ letras: { consulta, fragmentos: Object.fromEntries(hits.map((h) => [h.trackId, h.fragmento])) } });
      } catch (err) {
        // Sin aviso: la búsqueda por título, artista y álbum sigue funcionando,
        // y un aviso por tecla sería peor que la letra que no se encontró.
        console.error("search_lyrics failed", err);
      }
    },
    onQuickFilter: (q) =>
      set((s) => ({ qf: s.qf === q ? null : q, view: "biblioteca", libState: estadoDeLaBiblioteca(s) })),
    onOcasion: (o) => set((s) => ({ ocasion: s.ocasion === o ? null : o || null })),
    // Cambiar el eje deja las claves plegadas sin sentido —«f1/Clásicos» no
    // quiere decir nada cuando se agrupa por álbum—, así que se olvidan.
    onGroupBy: (g) => set({ groupBy: g, gruposColapsados: [] }),
    setDensidad: (d) => set({ densidad: d }),
    toggleGrupo: (clave) =>
      set((st) => ({
        gruposColapsados: st.gruposColapsados.includes(clave)
          ? st.gruposColapsados.filter((c) => c !== clave)
          : [...st.gruposColapsados, clave],
      })),
    onSortHeader: (k) =>
      set((s) => ({
        sortKey: k,
        sortDir: s.sortKey === k ? (s.sortDir === "asc" ? "desc" : "asc") : "asc",
      })),

    onRowClick: (id, mods) => {
      const st = get();
      const visibles = applyFilters(st).map((t) => t.id);
      const r = alHacerClic(visibles, st.selection, st.selAnchor, id, mods);
      set({ selection: r.seleccion, selAnchor: r.ancla, rowMenu: null });
      if (!r.abrirDetalle) return;
      // Moving to another track must not leave the previous one's edit in limbo.
      if (st.selId !== id) get().flushEdit();
      set({ selId: id, detailOpen: true, saveState: "idle" });
      // El panel pasa a mostrar otra pista, y con ella se va el video que
      // sonaba (#125).
      pausarVideoSiDejaDeVerse("El video se pausa al abrir otra pista en el panel");
    },

    selectAllVisible: () => {
      const visibles = applyFilters(get()).map((t) => t.id);
      set({ selection: visibles, selAnchor: visibles[0] ?? null });
    },

    clearSelection: () => set({ selection: [], selAnchor: null }),

    openRowMenu: (id, x, y) =>
      set((st) => ({
        rowMenu: { id, x, y },
        // A menu opened on a row outside the selection is about that row, so
        // the selection follows the click rather than the other way round.
        selection: st.selection.includes(id) ? st.selection : [id],
        selAnchor: st.selection.includes(id) ? st.selAnchor : id,
      })),

    closeRowMenu: () => set({ rowMenu: null }),

    startLibraryDrag: (ids) => set({ dragFromLibrary: ids }),
    endLibraryDrag: () => set({ dragFromLibrary: [] }),

    bulkFav: (fav) => {
      const ids = seleccionVigente(get());
      if (ids.length === 0) return;
      const marcadas = new Set(ids);
      set((st) => ({
        tracks: st.tracks.map((t) => (marcadas.has(t.id) ? { ...t, fav } : t)),
        rowMenu: null,
      }));
      void backend().setTracksFav(ids, fav).catch((err) => {
        console.error("set_tracks_fav failed", err);
        toast("No se pudo guardar el cambio", { tipo: "error" });
      });
    },

    bulkDelete: () => {
      const ids = seleccionVigente(get());
      if (ids.length === 0) return;
      // Qué cultos pierden algo, por su nombre. Un número suelto —«3 están en
      // alguna lista»— no deja decidir: quitar una pista del culto del domingo
      // que viene no es lo mismo que quitarla de una plantilla de hace un año.
      const cultos = cultosAfectados(ids, get().playlists, get().plOrder);
      get().askConfirm({
        title:
          ids.length === 1
            ? "¿Quitar esta pista de la biblioteca?"
            : `¿Quitar ${ids.length} pistas de la biblioteca?`,
        message: cultos
          ? `${ids.length === 1 ? "Desaparece" : "Desaparecen"} de la biblioteca de Cantoral y de ${cultos}. Se pierden sus favoritos, tempo, ocasión y la letra que tengan escrita.`
          : `${ids.length === 1 ? "Desaparece" : "Desaparecen"} de la biblioteca de Cantoral. Se pierden sus favoritos, tempo, ocasión y la letra que tengan escrita.`,
        safe: "Los archivos no se tocan. Siguen en el disco, en su carpeta, con su nombre. Si vuelves a escanear la carpeta, reaparecen.",
        confirmLabel: ids.length === 1 ? "Quitar pista" : `Quitar ${ids.length} pistas`,
        onConfirm: () => {
          set({ rowMenu: null, selection: [], selAnchor: null });
          backend()
            .deleteTracks(ids)
            .then((snap) => {
              applySnapshot(snap);
              toast(ids.length === 1 ? "Pista quitada" : `${ids.length} pistas quitadas`, {
                detalle: "Los archivos siguen en el disco.",
              });
            })
            .catch((err) => {
              console.error("delete_tracks failed", err);
              toast("No se pudieron quitar las pistas", { tipo: "error" });
            });
        },
      });
    },
    onFav: (id) => {
      const t = get().tracks.find((x) => x.id === id);
      if (!t) return;
      const nf = !t.fav;
      set((s) => ({ tracks: s.tracks.map((x) => (x.id === id ? { ...x, fav: nf } : x)) }));
      // The heart changes at once; if the core refuses, it goes back and says
      // so, rather than staying lit on screen and unlit in the database (#128).
      void backend().setTrackFav(id, nf).catch((err) => {
        console.error("set_track_fav failed", err);
        // Only if nothing has toggled it since: a second click already put it
        // where the user wants it.
        set((s) => ({
          tracks: s.tracks.map((x) => (x.id === id && x.fav === nf ? { ...x, fav: !nf } : x)),
        }));
        toast("No se pudo guardar el cambio", { tipo: "error" });
      });
    },

    revealTrack: (id) => {
      const t = get().tracks.find((x) => x.id === id);
      if (!t?.path) return;
      backend()
        .revealFile(t.path)
        .catch((err) => avisarFallo(err, "No se pudo mostrar el archivo"));
    },
    relocateTrack: (id) => {
      const t = get().tracks.find((x) => x.id === id);
      if (!t) return;
      backend()
        .relocateTrack(id)
        .then((snap) => {
          if (!snap) return;
          applySnapshot(snap);
          toast(`«${t.titulo}» vuelve a estar localizada`, {
            detalle: "Conserva su favorito y su sitio en los cultos.",
          });
        })
        .catch((err) => avisarFallo(err, String(err)));
    },
    deleteTrack: (id) => {
      const st = get();
      const t = st.tracks.find((x) => x.id === id);
      if (!t) return;
      const listas = st.playlists.filter((p) => (st.plOrder[p.id] || []).includes(id));
      st.askConfirm({
        title: "¿Quitar esta pista de la biblioteca?",
        message: `«${t.titulo}» dejará de aparecer en el catálogo.`,
        detail:
          `Se pierden su favorito, tempo, ocasión y la letra que tenga escrita.` +
          (listas.length
            ? ` También sale de ${listas.length === 1 ? "la lista" : "las listas"} ${listas
                .map((p) => `«${p.nombre}»`)
                .join(", ")}.`
            : ""),
        safe: "El archivo de audio no se borra: solo deja de estar indexado.",
        confirmLabel: "Quitar de la biblioteca",
        onConfirm: () => {
          backend()
            .deleteTrack(id)
            .then((snap) => {
              applySnapshot(snap);
              set({ detailOpen: false, selId: null });
              // Cerrar el panel aquí también se lleva el video que sonara (#125);
              // el aviso de la pausa lo tapa el de abajo, que es lo que se pidió.
              pausarVideoSiDejaDeVerse("El video se pausa al cerrar el panel");
              toast("Pista quitada de la biblioteca");
            })
            .catch((err) => {
              console.error(err);
              toast("No se pudo quitar la pista", { tipo: "error" });
            });
        },
      });
    },
  };
}
