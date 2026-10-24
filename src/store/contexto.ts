import type { Singer, Folder, Playlist, Track } from "../lib/types";
import { assetUrl, type Parche, type Snapshot } from "../lib/api";
import { NoDisponible, backend } from "../lib/backend";
import type { StoreApi } from "zustand";
import type { CantoralState, ToastType } from "./tipos";
import { ultimoId, cur } from "./selectores";
import { aplicarParche, conservarIguales } from "../lib/reutilizar";

// Parte del store (#134). Ver src/store/index.ts.
//
// Lo que comparten los slices: los ayudantes que antes vivían en el cierre
// de `create` —avisar, aplicar lo que contesta el backend, guardar con
// retardo— y el estado de módulo que no es de nadie en particular.

export type Set = StoreApi<CantoralState>["setState"];
export type Get = StoreApi<CantoralState>["getState"];

/** Temporizadores y marcas de módulo: fuera del estado de React/zustand. */
export const modulo = {
  /** Poll that pulls in tracks a running scan has already indexed. */
  refreshTimer: null as ReturnType<typeof setTimeout> | null,
  /** Bumped on every start and stop, so a pull that outlived its run stops there. */
  refreshGen: 0,
  /** True while a catalogue pull is in flight, so they cannot pile up. */
  refreshing: false,
  toastTimer: null as ReturnType<typeof setTimeout> | null,
  dragId: null as string | null,
  /** Action to re-run from the error state — set whenever a backend call fails. */
  lastFailedAction: null as (() => void) | null,
  /** Debounce for track edits, which now write themselves. */
  saveTimer: null as ReturnType<typeof setTimeout> | null,
  /** Id of the track whose edit is waiting out the debounce, if any. */
  pendingSave: null as string | null,
  /** Debounce for writing the interface preferences back. */
  prefsTimer: null as ReturnType<typeof setTimeout> | null,
  /** Si el escaneo que está acabando lo canceló el usuario. */
  escaneoCancelado: false,

  /**
   * Deja de escuchar el progreso de la descarga.
   *
   * Fuera del store porque no es estado que nadie pinte: solo hace falta para
   * soltar el listener si la instalación falla. Si funciona, la app se reinicia
   * y no queda nada que soltar.
   */
  pararProgreso: null as (() => void) | null,
};

/** Si dos listas de carpetas dicen lo mismo, campo a campo. */
export function mismasCarpetas(a: readonly Folder[], b: readonly Folder[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i];
    return (
      x.id === y.id &&
      x.nombre === y.nombre &&
      x.ruta === y.ruta &&
      x.count === y.count &&
      x.lastScan === y.lastScan &&
      x.recursive === y.recursive
    );
  });
}

/** Si dos listas de cantantes dicen lo mismo, campo a campo. */
export function sameSingers(a: readonly Singer[], b: readonly Singer[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((x, i) => x.id === b[i].id && x.nombre === b[i].nombre);
}

export function crearContexto(set: Set, get: Get) {
  const toast = (titulo: string, opciones?: { detalle?: string; tipo?: ToastType }) =>
    get().showToast(titulo, opciones);

  /**
   * Lo que se dice cuando el backend no pudo.
   *
   * Un `NoDisponible` es el navegador diciendo que eso no lo sabe hacer —no hay
   * disco que mostrar—: un aviso, no un error. Todo lo demás es un fallo.
   */
  const avisarFallo = (err: unknown, titulo: string, detalle?: string) => {
    if (err instanceof NoDisponible) {
      toast(err.message, { tipo: "info" });
      return;
    }
    console.error(err);
    toast(titulo, { tipo: "error", detalle });
  };

  /**
   * El `<video>` solo existe dentro del panel de detalle y mostrando la pista
   * que suena (#125). Si un cambio de vista lo deja fuera, el elemento se
   * desmonta o pierde el `src` y el video se calla — y el transporte no puede
   * seguir diciendo «reproduciendo». Se pausa y se dice por qué, en vez de
   * dejar la barra mintiendo sobre un video que ya no suena.
   */
  const pausarVideoSiDejaDeVerse = (aviso: string) => {
    const st = get();
    const t = cur(st);
    if (!st.playing || !t?.video) return;
    if (st.detailOpen && st.selId === st.playerId) return;
    // En el proyector se sigue viendo, con el panel abierto o sin él.
    if (st.proyeccionPista === st.playerId) return;
    set({ playing: false });
    toast(aviso);
  };

  /** Turn cover file paths into asset:// URLs the webview can load. */
  const conCaratula = (tracks: Track[]): Track[] =>
    tracks.map((t) => (t.cover ? { ...t, cover: assetUrl(t.cover) } : t));

  /** The lists and their order, keeping the open one if it still exists. */
  const listasDe = (playlists: Playlist[]) => {
    const plOrder: Record<string, string[]> = {};
    playlists.forEach((p) => (plOrder[p.id] = p.ids.slice()));
    const actual = get().curPlaylist;
    const curPlaylist = playlists.some((p) => p.id === actual) ? actual : playlists[0]?.id || actual;
    return { playlists, plOrder, curPlaylist };
  };

  /**
   * Replace only the lists, from what a change to a list answered with.
   *
   * The catalogue is left alone —same array, same identity—, so nothing that
   * reads the tracks recomputes because a culto got one more song (#136).
   */
  const applyPlaylists = (playlists: Playlist[]) => set(listasDe(playlists));

  /**
   * Poner un catálogo nuevo, preservando el reproductor y la cola cuando sus
   * pistas siguen ahí. Las carpetas y las listas, solo si vienen.
   */
  const ponerCatalogo = (tracks: Track[], folders: Folder[] | null, playlists: Playlist[] | null) => {
    const st = get();
    const playerId = tracks.some((t) => t.id === st.playerId)
      ? st.playerId
      : tracks[0]?.id || st.playerId;
    // Drop queued ids whose track vanished in the rescan.
    const live = new Set(tracks.map((t) => t.id));
    const queue = st.queue.filter((id) => live.has(id));
    set({
      tracks,
      ...(folders && !mismasCarpetas(st.folders, folders) ? { folders } : {}),
      ...(playlists ? listasDe(playlists) : {}),
      playerId,
      queue,
      // Any list of duplicates was computed against the catalogue that just
      // got replaced. Offering the user a choice about tracks that may no
      // longer exist is worse than asking them to search again.
      duplicates: [],
      duplicatesState: "idle",
    });
  };

  /** Replace the catalogue from a backend snapshot, preserving the player /
   *  playlist selection when the referenced ids still exist. */
  const applySnapshot = (snap: Snapshot) => {
    // Las pistas y las carpetas que llegan iguales se quedan con el objeto que
    // ya había: así sobreviven las filas memorizadas, la caché de la búsqueda
    // y el orden de la tabla. Ver `conservarIguales`.
    const tracks = conservarIguales(get().tracks, conCaratula(snap.tracks));
    ponerCatalogo(tracks, snap.folders, snap.playlists);
    // Los cantantes siempre vienen con la instantánea; si llegan iguales no
    // hay que escribirlos, para no despertar a quienes solo miran la lista.
    if (!sameSingers(get().singers, snap.singers)) {
      set({ singers: snap.singers });
    }
  };

  /**
   * Aplicar lo que contesta una acción sobre unas pistas: quitar, reubicar,
   * fusionar, quitar o reapuntar una carpeta.
   *
   * Llega solo lo que cambió (ver `Parche`), y solo eso se toca: las demás
   * pistas siguen siendo los mismos objetos, sin pasar por la comparación de
   * todo el catálogo que hace `applySnapshot`. Lo demás —el reproductor, la
   * cola, la lista de duplicados— queda igual que tras una instantánea.
   */
  const applyParche = (p: Parche) => {
    const tracks = aplicarParche(get().tracks, p.quitadas, conCaratula(p.cambiadas));
    ponerCatalogo(tracks, p.folders, p.playlists);
  };

  /**
   * Apuntar qué archivos aparecieron o desaparecieron, sin otra instantánea.
   *
   * Es lo que contesta la reconciliación del arranque. Antes contestaba con el
   * catálogo entero y se aplicaba encima del que acababa de llegar: dos
   * instantáneas completas para abrir la app, la segunda casi siempre igual a
   * la primera. Solo cambia `missing`, que no mueve las cuentas de las
   * carpetas —cuentan todas sus pistas, estén o no—, así que lo demás se queda.
   */
  const marcarFaltantes = (cambiados: readonly { id: string; missing: boolean }[]) => {
    if (cambiados.length === 0) return;
    const porId = new Map(cambiados.map((c) => [c.id, c.missing]));
    const antes = get().tracks;
    let alguna = false;
    const tracks = antes.map((t) => {
      const missing = porId.get(t.id);
      if (missing === undefined || missing === t.missing) return t;
      alguna = true;
      return { ...t, missing };
    });
    if (alguna) set({ tracks });
  };

  /**
   * Apuntar las carátulas que la pasada única del núcleo acaba de reducir.
   *
   * Llegan antes de que se borren los archivos viejos, así que la fila cambia
   * de imagen sin quedarse un momento en blanco. Solo las pistas que cambian
   * son objetos nuevos; el resto del catálogo se queda como estaba.
   */
  const cambiarCaratulas = (lote: readonly { id: string; cover: string }[]) => {
    if (lote.length === 0) return;
    const porId = new Map(lote.map((c) => [c.id, assetUrl(c.cover)]));
    let alguna = false;
    const tracks = get().tracks.map((t) => {
      const cover = porId.get(t.id);
      if (cover === undefined || cover === t.cover) return t;
      alguna = true;
      return { ...t, cover };
    });
    if (alguna) set({ tracks });
  };

  /** How often what a scan has indexed is pulled in while it runs. */
  const REFRESCO_MS = 2000;
  /** The longest the live refresh waits while nothing new is coming in. */
  const REFRESCO_MAX_MS = 8000;

  /**
   * Pull in what a running scan has indexed so far.
   *
   * The backend was built for exactly this — the scan runs on its own
   * connection and commits in batches of 200 — so what it has indexed so far is
   * already readable. Without this the library would sit frozen at whatever it
   * held when the scan started and only catch up at the very end.
   *
   * Only what is new, by id: ids only grow, so «after the last one I have» is
   * exactly what the scan added. It used to be the whole catalogue every two
   * seconds, each pull bigger than the last, while the disk and the tag reader
   * already had the machine busy (#136). What a rescan changes in tracks that
   * already existed —and what it drops— arrives with the snapshot the scan
   * ends with. When a pull comes back empty the next one waits longer.
   */
  const startLiveRefresh = () => {
    if (modulo.refreshTimer) return;
    const gen = ++modulo.refreshGen;
    const programar = (ms: number) => {
      if (gen === modulo.refreshGen) modulo.refreshTimer = setTimeout(() => void refrescar(ms), ms);
    };
    const refrescar = async (espera: number) => {
      // Never on top of an edit still waiting out its debounce: the pull would
      // overwrite what is being typed with the value the backend has not been
      // told about yet.
      if (modulo.refreshing || modulo.pendingSave) return programar(espera);
      modulo.refreshing = true;
      let siguiente = espera;
      try {
        const desde = ultimoId(get().tracks);
        const nuevo = await backend().getTracksSince(String(desde));
        // What arrives after the scan ended is stale by definition — the final
        // snapshot has already landed.
        if (!get().scanning) return;
        const tengo = new Set(get().tracks.map((t) => t.id));
        const nuevas = conCaratula(nuevo.tracks.filter((t) => !tengo.has(t.id)));
        // Mientras el escaneo sigue sin traer nada nuevo, las carpetas
        // llegan iguales una y otra vez. Escribirlas igual despertaría a todos
        // los suscriptores del store cada pocos segundos para nada.
        const carpetasIguales = mismasCarpetas(get().folders, nuevo.folders);
        if (nuevas.length || !carpetasIguales) {
          set((st) => ({
            ...(carpetasIguales ? {} : { folders: nuevo.folders }),
            ...(nuevas.length ? { tracks: [...st.tracks, ...nuevas] } : {}),
          }));
        }
        // As soon as there is something to show, the library shows it: the
        // full-view scan card is only for having nothing at all.
        if (get().tracks.length && get().libState !== "content") set({ libState: "content" });
        siguiente = nuevas.length ? REFRESCO_MS : Math.min(espera * 2, REFRESCO_MAX_MS);
      } catch (err) {
        console.error("live refresh failed", err);
      } finally {
        modulo.refreshing = false;
      }
      // Stopped —or stopped and started again— while this pull was out: this
      // run is over, and `programar` knows it.
      programar(siguiente);
    };
    programar(REFRESCO_MS);
  };

  const stopLiveRefresh = () => {
    modulo.refreshGen++;
    if (modulo.refreshTimer) clearTimeout(modulo.refreshTimer);
    modulo.refreshTimer = null;
  };

  /**
   * Write the track that is waiting out the debounce.
   *
   * Reads the values straight from the catalogue rather than from a copy taken
   * when the edit was made, so whatever the user ended up with is what gets
   * stored — including keystrokes that landed after the timer was set.
   */
  const writePendingEdit = () => {
    const id = modulo.pendingSave;
    modulo.pendingSave = null;
    if (!id) return;
    const t = get().tracks.find((x) => x.id === id);
    if (!t) return;

    backend()
      .updateTrack(t.id, t.artista)
      .then(() => {
        // Only report success for the track still on screen; a stale reply from
        // a track the user has moved on from must not relabel this one.
        if (get().selId === id) set({ saveState: "saved" });
      })
      .catch((err) => {
        console.error("update_track failed", err);
        // The typed value is kept: yanking it back mid-edit would lose work for
        // a failure the user can do nothing about. The footer says so instead.
        if (get().selId === id) set({ saveState: "error" });
        get().showToast("No se pudieron guardar los cambios", { tipo: "error" });
      });
  };

  /** Push the write out by a beat, so a burst of typing is one round trip. */
  const scheduleSave = (id: string) => {
    // Moving to another track writes the previous one before taking its place.
    if (modulo.pendingSave && modulo.pendingSave !== id) writePendingEdit();
    modulo.pendingSave = id;
    if (modulo.saveTimer) clearTimeout(modulo.saveTimer);
    modulo.saveTimer = setTimeout(() => {
      modulo.saveTimer = null;
      writePendingEdit();
    }, 600);
  };

  /**
   * Apply a new playlist order at once and persist it, putting the previous one
   * back if the backend refuses.
   *
   * The order used to be saved with a bare `void setPlaylistOrder(...)`, so a
   * write that failed left the screen showing an order the database never got —
   * and the user found out at the next launch, when their culto had reverted.
   */
  const saveOrder = (playlistId: string, next: string[], prev: string[]) => {
    set((st) => ({ plOrder: { ...st.plOrder, [playlistId]: next } }));
    tocarCulto(playlistId);
    backend().setPlaylistOrder(playlistId, next).catch((err) => {
      console.error("set_playlist_order failed", err);
      set((st) => ({ plOrder: { ...st.plOrder, [playlistId]: prev } }));
      get().showToast("No se pudo guardar el orden de la lista", { tipo: "error" });
    });
  };

  /**
   * Apuntar que alguien acaba de abrir o cambiar un culto.
   *
   * Es lo que ordena la lista de cultos, que no tienen fecha: lo que se está
   * preparando es lo último que se tocó. Sube arriba en el acto y se guarda
   * para la próxima vez.
   *
   * Donde la acción devuelve una instantánea del núcleo, esto va **después** de
   * aplicarla: la instantánea sale antes de que el toque se escriba, y
   * aplicarla después lo devolvería a su sitio.
   */
  const tocarCulto = (id: string) => {
    if (!id) return;
    const ahora = new Date().toISOString();
    set((st) => ({ playlists: st.playlists.map((p) => (p.id === id ? { ...p, tocada: ahora } : p)) }));
    backend().touchPlaylist(id).catch((err) => console.error("touch_playlist failed", err));
  };

  return { toast, avisarFallo, pausarVideoSiDejaDeVerse, conCaratula, listasDe, applyPlaylists, applySnapshot, applyParche, marcarFaltantes, cambiarCaratulas, REFRESCO_MS, REFRESCO_MAX_MS, startLiveRefresh, stopLiveRefresh, writePendingEdit, scheduleSave, saveOrder, tocarCulto };
}

export type Contexto = ReturnType<typeof crearContexto>;
