import { create } from "zustand";
import type {
  Folder,
  GroupBy,
  LibState,
  Playlist,
  QuickFilter,
  SortKey,
  Theme,
  ThemeMode,
  Track,
  TrackEdit,
  View,
} from "./lib/types";

function osPrefersDark(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
/** Effective theme for a preference mode. */
function resolveTheme(mode: ThemeMode): Theme {
  return mode === "system" ? (osPrefersDark() ? "dark" : "light") : mode;
}
import { SCAN_FILES, SEED_FOLDERS, SEED_PLAYLISTS, SEED_TRACKS } from "./lib/seed";
import { playlistSheetHtml, sheetFileName } from "./lib/exportSheet";
import {
  addAndScanFolder,
  addToPlaylistCmd,
  assetUrl,
  cancelScanCmd,
  backupDatabase,
  createPlaylistCmd,
  deletePlaylistCmd,
  deleteTrackCmd,
  exportPlaylistCmd,
  getLibrary,
  getSetting,
  inspectBackup,
  isTauri,
  openExternalPath,
  pickDbFile,
  pickExportPath,
  pickFolder,
  pickMediaFile,
  pickSavePath,
  reconcileLibraryCmd,
  relocateFolderCmd,
  relocateTrackCmd,
  removeFolderCmd,
  rescanFolderCmd,
  restoreDatabaseCmd,
  setPlaylistOrderCmd,
  setSetting,
  setTrackFav,
  updatePlaylistCmd,
  updateTrackCmd,
  type Snapshot,
} from "./lib/api";

// Module-scoped timers (kept out of React/zustand state).
let scanTimer: ReturnType<typeof setInterval> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let dragId: string | null = null;
/** Action to re-run from the error state — set whenever a backend call fails. */
let lastFailedAction: (() => void) | null = null;

/**
 * A destructive action waiting to be confirmed.
 *
 * Every field is filled at the moment the user asks for the action, so the
 * dialog can name what is about to be lost with real numbers rather than a
 * generic «¿estás seguro?».
 */
export interface ConfirmRequest {
  title: string;
  /** What is about to happen, in plain words. */
  message: string;
  /** Exactly what is lost — counts, names. Rendered as a highlighted block. */
  detail?: string;
  /** Reassurance about what is *not* touched. */
  safe?: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export type ToastType = "success" | "error" | "info";
export interface ToastNotice {
  message: string;
  type: ToastType;
}

export interface CantoralState {
  // ---- data ----
  tracks: Track[];
  folders: Folder[];
  playlists: Playlist[];
  plOrder: Record<string, string[]>;
  /** Ordered track ids the transport walks through (a culto list, or the library). */
  queue: string[];

  // ---- ui / navigation ----
  theme: Theme;
  themeMode: ThemeMode;
  view: View;
  libState: LibState;

  // ---- library filters ----
  query: string;
  qf: QuickFilter;
  ocasion: string | null;
  groupBy: GroupBy;
  sortKey: SortKey;
  sortDir: "asc" | "desc";

  // ---- detail panel ----
  selId: string | null;
  detailOpen: boolean;
  edit: Record<string, TrackEdit>;
  tagDraft: string;
  saved: boolean;

  // ---- dialog / scan ----
  dialog: "addFolder" | "newList" | "editList" | "help" | null;
  scanPct: number;
  scanIdx: number;
  scanFile: string;
  /** Message from the last failed backend call, shown in the error state. */
  scanError: string | null;

  // ---- player ----
  playerId: string;
  playing: boolean;
  posSec: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: boolean;

  // ---- collections ----
  curPlaylist: string;
  openExt: boolean;
  draggingId: string | null;
  overId: string | null;

  // ---- toast ----
  toast: ToastNotice | null;

  /** Destructive action awaiting confirmation, or null. */
  confirm: ConfirmRequest | null;

  // ---- actions ----
  showBiblioteca: () => void;
  showColecciones: () => void;
  showConfig: () => void;
  onFolderClick: () => void;
  openPlaylist: (id: string) => void;
  toggleTheme: () => void;
  setThemeMode: (m: ThemeMode) => void;
  applySystemTheme: () => void;

  onQuery: (v: string) => void;
  clearQuery: () => void;
  onQuickFilter: (q: Exclude<QuickFilter, null>) => void;
  onOcasion: (o: string) => void;
  onGroupBy: (g: GroupBy) => void;
  onSortHeader: (k: SortKey) => void;

  onRowClick: (id: string) => void;
  onFav: (id: string) => void;
  onOpenExternal: (id: string) => void;

  play: (id: string, queue?: string[]) => void;
  togglePlay: () => void;
  /** Auto-advance when a track finishes (honours «repetir»). */
  advance: () => void;
  prev: () => void;
  next: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleMute: () => void;
  seekToFraction: (f: number) => void;
  setVolume: (f: number) => void;

  setEdit: (field: keyof TrackEdit, val: unknown) => void;
  onTagDraft: (v: string) => void;
  addTag: (v: string) => void;
  removeTag: (tag: string) => void;
  closeDetail: () => void;
  saveDetail: () => void;

  openAddFolder: () => void;
  openHelp: () => void;
  closeDialog: () => void;
  confirmAddFolder: () => void;
  indexFolder: (path?: string, recursive?: boolean) => void;
  startScan: () => void;
  cancelScan: () => void;
  retryError: () => void;
  hydrate: () => Promise<void>;

  playAll: () => void;
  exportPl: () => void;
  newList: () => void;
  createList: (nombre: string, fecha: string, ocasion: string) => void;
  editCurrentList: () => void;
  updateList: (nombre: string, fecha: string, ocasion: string) => void;
  addToList: (playlistId: string, trackId: string) => void;
  deleteCurrentList: () => void;
  removeFromPl: (id: string) => void;
  reorderPl: (toId: string) => void;
  setDragging: (id: string) => void;
  setOver: (id: string | null) => void;
  clearDrag: () => void;

  toggleOpenExt: () => void;
  /** Point a track at its file's new location, keeping tags and favourite. */
  relocateTrack: (id: string) => void;
  /** Drop a track from the catalogue. The audio file is never touched. */
  deleteTrack: (id: string) => void;
  /** Point a whole indexed folder at its new location. */
  relocateFolder: (id: string) => void;
  removeFolder: (id: string) => void;
  rescanFolder: (id?: string) => void;
  backup: () => void;
  restore: () => void;

  tick: () => void;
  showToast: (m: string, type?: ToastType) => void;

  askConfirm: (req: ConfirmRequest) => void;
  acceptConfirm: () => void;
  closeConfirm: () => void;
}

const initialPlOrder: Record<string, string[]> = {};
SEED_PLAYLISTS.forEach((p) => (initialPlOrder[p.id] = p.ids.slice()));

/** True in a plain browser (`pnpm dev`), where the seed stands in for the backend. */
const MOCK = !isTauri();

export const useStore = create<CantoralState>((set, get) => {
  const toast = (m: string, type: ToastType = "success") => get().showToast(m, type);

  /** Replace the catalogue from a backend snapshot, preserving the player /
   *  playlist selection when the referenced ids still exist. */
  const applySnapshot = (snap: Snapshot) => {
    const plOrder: Record<string, string[]> = {};
    snap.playlists.forEach((p) => (plOrder[p.id] = p.ids.slice()));
    // Turn cover file paths into asset:// URLs the webview can load.
    const tracks = snap.tracks.map((t) => (t.cover ? { ...t, cover: assetUrl(t.cover) } : t));
    const st = get();
    const curPlaylist = snap.playlists.some((p) => p.id === st.curPlaylist)
      ? st.curPlaylist
      : snap.playlists[0]?.id || st.curPlaylist;
    const playerId = tracks.some((t) => t.id === st.playerId)
      ? st.playerId
      : tracks[0]?.id || st.playerId;
    // Drop queued ids whose track vanished in the rescan.
    const live = new Set(tracks.map((t) => t.id));
    const queue = st.queue.filter((id) => live.has(id));
    set({ tracks, folders: snap.folders, playlists: snap.playlists, plOrder, curPlaylist, playerId, queue });
  };

  /**
   * Apply a new playlist order at once and persist it, putting the previous one
   * back if the backend refuses.
   *
   * The order used to be saved with a bare `void setPlaylistOrderCmd(...)`, so a
   * write that failed left the screen showing an order the database never got —
   * and the user found out at the next launch, when their culto had reverted.
   */
  const saveOrder = (playlistId: string, next: string[], prev: string[]) => {
    set((st) => ({ plOrder: { ...st.plOrder, [playlistId]: next } }));
    setPlaylistOrderCmd(playlistId, next).catch((err) => {
      console.error("set_playlist_order failed", err);
      set((st) => ({ plOrder: { ...st.plOrder, [playlistId]: prev } }));
      get().showToast("No se pudo guardar el orden de la lista", "error");
    });
  };

  return {
    // The seed catalogue is browser-only scaffolding. Inside Tauri the store
    // starts empty and `hydrate()` fills it from SQLite, so demo data can never
    // flash on screen nor survive a failed load.
    tracks: MOCK ? SEED_TRACKS.map((t) => ({ ...t })) : [],
    folders: MOCK ? SEED_FOLDERS.map((f) => ({ ...f })) : [],
    playlists: MOCK ? SEED_PLAYLISTS : [],
    plOrder: MOCK ? initialPlOrder : {},
    queue: [],

    themeMode: "system",
    theme: resolveTheme("system"),
    view: "biblioteca",
    libState: MOCK ? "content" : "empty",

    query: "",
    qf: null,
    ocasion: null,
    groupBy: "none",
    sortKey: "titulo",
    sortDir: "asc",

    selId: null,
    detailOpen: false,
    edit: {},
    tagDraft: "",
    saved: false,

    dialog: null,
    scanPct: 0,
    scanIdx: 0,
    scanFile: "",
    scanError: null,

    playerId: MOCK ? "t1" : "",
    playing: false,
    posSec: MOCK ? 47 : 0,
    volume: 0.72,
    muted: false,
    shuffle: false,
    repeat: false,

    curPlaylist: MOCK ? "p1" : "",
    openExt: false,
    draggingId: null,
    overId: null,

    toast: null,
    confirm: null,

    // ---------- nav ----------
    showBiblioteca: () => set({ view: "biblioteca" }),
    showColecciones: () => set({ view: "colecciones" }),
    showConfig: () => set({ view: "config" }),
    onFolderClick: () =>
      set({ view: "biblioteca", libState: "content", qf: null, ocasion: null }),
    openPlaylist: (id) => set({ view: "lista", curPlaylist: id }),
    toggleTheme: () => {
      get().setThemeMode(get().theme === "dark" ? "light" : "dark");
    },
    setThemeMode: (m) => {
      const theme = resolveTheme(m);
      set({ themeMode: m, theme });
      if (isTauri()) void setSetting("themeMode", m);
    },
    applySystemTheme: () => {
      if (get().themeMode === "system") set({ theme: osPrefersDark() ? "dark" : "light" });
    },

    // ---------- library filters ----------
    onQuery: (v) => set({ query: v }),
    clearQuery: () => set({ query: "" }),
    onQuickFilter: (q) =>
      set((s) => ({ qf: s.qf === q ? null : q, view: "biblioteca", libState: "content" })),
    onOcasion: (o) => set((s) => ({ ocasion: s.ocasion === o ? null : o || null })),
    onGroupBy: (g) => set({ groupBy: g }),
    onSortHeader: (k) =>
      set((s) => ({
        sortKey: k,
        sortDir: s.sortKey === k ? (s.sortDir === "asc" ? "desc" : "asc") : "asc",
      })),

    // ---------- rows ----------
    onRowClick: (id) => set({ selId: id, detailOpen: true, tagDraft: "", saved: false }),
    onFav: (id) => {
      const t = get().tracks.find((x) => x.id === id);
      if (!t) return;
      const nf = !t.fav;
      set((s) => ({ tracks: s.tracks.map((x) => (x.id === id ? { ...x, fav: nf } : x)) }));
      void setTrackFav(id, nf);
    },
    onOpenExternal: (id) => {
      const t = get().tracks.find((x) => x.id === id);
      if (!isTauri()) {
        toast("Abriendo en el reproductor del sistema…", "info");
        return;
      }
      if (!t?.path) {
        toast("Sin archivo para abrir", "info");
        return;
      }
      toast("Abriendo en el reproductor del sistema…", "info");
      void openExternalPath(t.path).catch((err) => {
        console.error("openExternalPath failed", err);
        toast("No se pudo abrir el archivo", "error");
      });
    },

    // ---------- player ----------
    play: (id, queue) => {
      const s = get();
      const t = s.tracks.find((x) => x.id === id);
      if (!t) return;
      if (t.missing) {
        toast("El archivo no se encuentra en el disco", "error");
        return;
      }
      // Videos always, and any track when "abrir en el sistema" is on, open in
      // the OS default player instead of the integrated one.
      if (t.video || s.openExt) {
        get().onOpenExternal(id);
        return;
      }
      // Playing from a culto list queues that list, so the transport follows the
      // service order instead of falling back to whatever the library shows.
      set({ queue: queue ?? queueForView(s), playerId: id, playing: true, posSec: 0 });
    },
    togglePlay: () => set((s) => ({ playing: !s.playing })),
    advance: () => {
      // «Repetir» loops the current track; the queue already wraps by itself.
      if (get().repeat) {
        set({ posSec: 0, playing: true });
        return;
      }
      get().next();
    },
    prev: () => {
      const s = get();
      const ids = playQueue(s);
      const i = ids.indexOf(s.playerId);
      const n = ids.length ? ids[(i - 1 + ids.length) % ids.length] : s.playerId;
      set({ playerId: n, posSec: 0 });
    },
    next: () => {
      const s = get();
      const ids = playQueue(s);
      const i = ids.indexOf(s.playerId);
      let n: string;
      if (s.shuffle && ids.length > 1) {
        do {
          n = ids[Math.floor(Math.random() * ids.length)];
        } while (n === s.playerId);
      } else {
        n = ids.length ? ids[(i + 1) % ids.length] : s.playerId;
      }
      set({ playerId: n, posSec: 0 });
    },
    toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
    toggleRepeat: () => set((s) => ({ repeat: !s.repeat })),
    toggleMute: () => set((s) => ({ muted: !s.muted })),
    seekToFraction: (f) => {
      const t = cur(get());
      if (t) set({ posSec: Math.round(Math.min(1, Math.max(0, f)) * t.durSec) });
    },
    setVolume: (f) => set({ volume: Math.min(1, Math.max(0, f)), muted: false }),

    // ---------- detail edit ----------
    setEdit: (field, val) =>
      set((s) => {
        if (!s.selId) return {};
        const curT = s.tracks.find((x) => x.id === s.selId);
        const base = s.edit[s.selId] || { tags: (curT?.tags || []).slice() };
        return {
          edit: { ...s.edit, [s.selId]: { ...base, [field]: val } },
          saved: false,
        };
      }),
    onTagDraft: (v) => set({ tagDraft: v }),
    addTag: (v) => {
      const val = v.trim();
      if (!val) return;
      const s = get();
      if (!s.selId) return;
      const curT = eff(s, s.tracks.find((x) => x.id === s.selId)!);
      const tags = (curT.tags || []).slice();
      if (!tags.includes(val)) tags.push(val);
      s.setEdit("tags", tags);
      set({ tagDraft: "" });
    },
    removeTag: (tag) => {
      const s = get();
      if (!s.selId) return;
      const curT = eff(s, s.tracks.find((x) => x.id === s.selId)!);
      s.setEdit("tags", (curT.tags || []).filter((t) => t !== tag));
    },
    closeDetail: () => set({ detailOpen: false }),
    saveDetail: () => {
      const s = get();
      if (!s.selId) return;
      const e = s.edit[s.selId];
      const base = s.tracks.find((t) => t.id === s.selId);
      if (e && base) {
        const merged = { ...base, ...e };
        set({ tracks: s.tracks.map((t) => (t.id === s.selId ? merged : t)), saved: true });
        void updateTrackCmd(merged.id, merged.tono, merged.bpm, merged.ocasion, merged.tags || []);
      } else {
        set({ saved: true });
      }
      toast("Cambios guardados");
    },

    // ---------- dialog / states ----------
    openAddFolder: () => set({ dialog: "addFolder" }),
    openHelp: () => set({ dialog: "help" }),
    closeDialog: () => set({ dialog: null }),
    confirmAddFolder: () => {
      set({ dialog: null });
      get().indexFolder();
    },
    indexFolder: (path, recursive = true) => {
      set({ dialog: null });
      if (isTauri() && path) {
        if (scanTimer) clearInterval(scanTimer);
        scanTimer = null;
        set({ view: "biblioteca", libState: "scanning", scanPct: 0, scanIdx: 0, scanFile: "" });
        addAndScanFolder(path, recursive)
          .then((snap) => {
            applySnapshot(snap);
            set({ libState: "content", scanPct: 100 });
            toast("Biblioteca actualizada");
          })
          .catch((err) => {
            console.error(err);
            lastFailedAction = () => get().indexFolder(path, recursive);
            set({ libState: "error", scanError: String(err) });
          });
      } else {
        get().startScan();
      }
    },
    startScan: () => {
      if (scanTimer) clearInterval(scanTimer);
      set({ view: "biblioteca", libState: "scanning", scanPct: 0, scanIdx: 0 });
      scanTimer = setInterval(() => {
        const p = get().scanPct + Math.random() * 7 + 3;
        if (p >= 100) {
          if (scanTimer) clearInterval(scanTimer);
          scanTimer = null;
          set({ scanPct: 100, libState: "content" });
          toast("Biblioteca actualizada");
        } else {
          set({
            scanPct: p,
            scanIdx: Math.min(SCAN_FILES.length - 1, Math.floor((p / 100) * SCAN_FILES.length)),
          });
        }
      }, 160);
    },
    cancelScan: () => {
      if (scanTimer) clearInterval(scanTimer);
      scanTimer = null;
      // Stop the backend walk too — clearing the timer only ever hid the
      // browser simulation, leaving a real scan running to completion.
      void cancelScanCmd().catch(console.error);
      set({ libState: "content" });
    },
    retryError: () => {
      set({ scanError: null });
      // In the browser there is no backend, so replay the simulated scan.
      if (isTauri()) {
        const retry = lastFailedAction;
        lastFailedAction = null;
        if (retry) retry();
        else void get().hydrate();
        return;
      }
      get().startScan();
    },
    hydrate: async () => {
      if (!isTauri()) return;
      // Belt and braces: `MOCK` is decided at module-eval time. If that ever ran
      // before Tauri injected its globals, drop the seed before the real
      // catalogue lands so demo rows can never reach the screen.
      if (MOCK) set({ tracks: [], folders: [], playlists: [], plOrder: {}, queue: [], playerId: "", curPlaylist: "", posSec: 0 });
      try {
        const snap = await getLibrary();
        if (snap) {
          applySnapshot(snap);
          set({ libState: snap.tracks.length ? "content" : "empty", scanError: null });
        }
        // Restore saved preferences.
        const [modeS, themeS, openExtS] = await Promise.all([
          getSetting("themeMode"),
          getSetting("theme"),
          getSetting("openExt"),
        ]);
        const patch: Partial<CantoralState> = {};
        const mode: ThemeMode | null =
          modeS === "light" || modeS === "dark" || modeS === "system"
            ? modeS
            : themeS === "light" || themeS === "dark"
              ? themeS // migrate legacy "theme" setting
              : null;
        if (mode) {
          patch.themeMode = mode;
          patch.theme = resolveTheme(mode);
        }
        if (openExtS != null) patch.openExt = openExtS === "1";
        if (Object.keys(patch).length) set(patch);

        // Files can disappear while the app is closed; re-check them once the
        // catalogue is on screen rather than blocking the first paint.
        void reconcileLibraryCmd()
          .then((fresh) => {
            if (fresh) applySnapshot(fresh);
          })
          .catch((err) => console.error("reconcile failed", err));
      } catch (err) {
        console.error("hydrate failed", err);
        lastFailedAction = () => void get().hydrate();
        set({ libState: "error", scanError: String(err) });
      }
    },

    // ---------- collections ----------
    playAll: () => {
      const ord = get().plOrder[get().curPlaylist] || [];
      if (ord.length) {
        get().play(ord[0], ord.slice());
        toast("Reproduciendo la lista completa");
      }
    },
    exportPl: () => {
      const s = get();
      const pl = s.playlists.find((p) => p.id === s.curPlaylist);
      const ord = s.plOrder[s.curPlaylist] || [];
      const rows = ord
        .map((id) => s.tracks.find((t) => t.id === id))
        .filter((t): t is Track => !!t)
        .map((t) => eff(s, t));
      if (!pl || rows.length === 0) {
        toast("La lista está vacía");
        return;
      }
      const html = playlistSheetHtml(pl, rows, plDur(s, ord));
      const name = sheetFileName(pl.nombre);
      if (!isTauri()) {
        // Browser fallback so the sheet is testable with `pnpm dev`.
        const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        toast("Hoja de la lista exportada");
        return;
      }
      void pickExportPath(name).then((dest) => {
        if (!dest) return;
        exportPlaylistCmd(dest, html)
          .then(() => {
            toast("Hoja de la lista exportada");
            // Opens in the default browser, where Cmd/Ctrl+P saves it as PDF.
            return openExternalPath(dest);
          })
          .catch((err) => {
            console.error(err);
            toast("No se pudo exportar la lista", "error");
          });
      });
    },
    newList: () => set({ dialog: "newList" }),
    createList: (nombre, fecha, ocasion) => {
      set({ dialog: null });
      const name = nombre.trim() || "Lista sin título";
      if (isTauri()) {
        createPlaylistCmd(name, fecha, ocasion)
          .then(async (id) => {
            const snap = await getLibrary();
            if (snap) applySnapshot(snap);
            set({ view: "lista", curPlaylist: id });
            toast("Lista creada");
          })
          .catch((err) => {
            console.error(err);
            toast("No se pudo crear la lista", "error");
          });
      } else {
        const id = "new-" + Date.now();
        const pl: Playlist = { id, nombre: name, fecha, ocasion, ids: [] };
        set((s) => ({
          playlists: [...s.playlists, pl],
          plOrder: { ...s.plOrder, [id]: [] },
          view: "lista",
          curPlaylist: id,
        }));
        toast("Lista creada");
      }
    },
    editCurrentList: () => set({ dialog: "editList" }),
    updateList: (nombre, fecha, ocasion) => {
      const id = get().curPlaylist;
      const name = nombre.trim() || "Lista sin título";
      set({ dialog: null });
      if (isTauri()) {
        updatePlaylistCmd(id, name, fecha, ocasion)
          .then((snap) => {
            applySnapshot(snap);
            toast("Lista actualizada");
          })
          .catch((err) => {
            console.error(err);
            toast("No se pudo actualizar la lista", "error");
          });
      } else {
        set((st) => ({
          playlists: st.playlists.map((p) =>
            p.id === id ? { ...p, nombre: name, fecha, ocasion } : p,
          ),
        }));
        toast("Lista actualizada");
      }
    },
    addToList: (playlistId, trackId) => {
      const cur = get().plOrder[playlistId] || [];
      if (cur.includes(trackId)) {
        toast("Ya está en la lista", "info");
        return;
      }
      const next = [...cur, trackId];
      set((s) => ({ plOrder: { ...s.plOrder, [playlistId]: next } }));
      const pl = get().playlists.find((p) => p.id === playlistId);
      toast(`Agregada a «${pl?.nombre ?? "lista"}»`);
      if (isTauri()) void addToPlaylistCmd(playlistId, trackId).then(applySnapshot).catch(console.error);
    },
    deleteCurrentList: () => {
      const st = get();
      const id = st.curPlaylist;
      const pl = st.playlists.find((p) => p.id === id);
      if (!pl) return;
      const n = (st.plOrder[id] || []).length;
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
          if (isTauri()) {
            deletePlaylistCmd(id)
              .then((snap) => {
                applySnapshot(snap);
                set({ view: "colecciones" });
                toast("Lista eliminada");
              })
              .catch((err) => {
                console.error(err);
                toast("No se pudo eliminar la lista", "error");
              });
          } else {
            set((s) => {
              const playlists = s.playlists.filter((p) => p.id !== id);
              const plOrder = { ...s.plOrder };
              delete plOrder[id];
              return { playlists, plOrder, view: "colecciones", curPlaylist: playlists[0]?.id || s.curPlaylist };
            });
            toast("Lista eliminada");
          }
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
      dragId = id;
      set({ draggingId: id });
    },
    setOver: (id) => set((s) => (id !== s.overId ? { overId: id } : {})),
    reorderPl: (toId) => {
      const from = dragId;
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
      dragId = null;
    },
    clearDrag: () => {
      set({ draggingId: null, overId: null });
      dragId = null;
    },

    // ---------- config ----------
    toggleOpenExt: () => {
      const v = !get().openExt;
      set({ openExt: v });
      if (isTauri()) void setSetting("openExt", v ? "1" : "0");
    },
    relocateTrack: (id) => {
      const t = get().tracks.find((x) => x.id === id);
      if (!t) return;
      if (!isTauri()) {
        toast("Localizar archivos solo funciona en la app de escritorio", "info");
        return;
      }
      void pickMediaFile().then((path) => {
        if (!path) return;
        relocateTrackCmd(id, path)
          .then((snap) => {
            applySnapshot(snap);
            toast(`«${t.titulo}» vuelve a estar localizada`);
          })
          .catch((err) => {
            console.error(err);
            toast(String(err), "error");
          });
      });
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
          `Se pierden sus etiquetas, favorito, tono, tempo y ocasión.` +
          (listas.length
            ? ` También sale de ${listas.length === 1 ? "la lista" : "las listas"} ${listas
                .map((p) => `«${p.nombre}»`)
                .join(", ")}.`
            : ""),
        safe: "El archivo de audio no se borra: solo deja de estar indexado.",
        confirmLabel: "Quitar de la biblioteca",
        onConfirm: () => {
          if (!isTauri()) {
            set((s) => ({ tracks: s.tracks.filter((x) => x.id !== id) }));
            toast("Pista quitada de la biblioteca");
            return;
          }
          deleteTrackCmd(id)
            .then((snap) => {
              applySnapshot(snap);
              set({ detailOpen: false, selId: null });
              toast("Pista quitada de la biblioteca");
            })
            .catch((err) => {
              console.error(err);
              toast("No se pudo quitar la pista", "error");
            });
        },
      });
    },
    relocateFolder: (id) => {
      const f = get().folders.find((x) => x.id === id);
      if (!f) return;
      if (!isTauri()) {
        toast("Mover carpetas solo funciona en la app de escritorio", "info");
        return;
      }
      void pickFolder().then((path) => {
        if (!path) return;
        relocateFolderCmd(id, path)
          .then((snap) => {
            applySnapshot(snap);
            toast(`«${f.nombre}» ahora apunta a su nueva ubicación`);
          })
          .catch((err) => {
            console.error(err);
            toast(String(err), "error");
          });
      });
    },
    removeFolder: (id) => {
      const f = get().folders.find((x) => x.id === id);
      if (!f) return;
      const n = f.count;
      get().askConfirm({
        title: "¿Quitar esta carpeta?",
        message: `«${f.nombre}» dejará de estar indexada.`,
        detail:
          n > 0
            ? `Se borrarán ${n} ${n === 1 ? "pista" : "pistas"} de la biblioteca, junto con sus etiquetas, favoritos, tono y ocasión. Eso no se puede deshacer.`
            : "La carpeta no tiene pistas indexadas.",
        safe: "Tus archivos de audio no se tocan: siguen donde están.",
        confirmLabel: "Quitar carpeta",
        onConfirm: () => {
          if (isTauri()) {
            removeFolderCmd(id)
              .then(applySnapshot)
              .then(() => toast("Carpeta quitada de la biblioteca"))
              .catch((err) => {
                console.error(err);
                toast("No se pudo quitar la carpeta", "error");
              });
          } else {
            set((s) => ({ folders: s.folders.filter((x) => x.id !== id) }));
            toast("Carpeta quitada de la biblioteca");
          }
        },
      });
    },
    rescanFolder: (id) => {
      if (isTauri() && id) {
        set({ view: "biblioteca", libState: "scanning", scanPct: 0, scanIdx: 0, scanFile: "" });
        rescanFolderCmd(id)
          .then((snap) => {
            applySnapshot(snap);
            set({ libState: "content", scanPct: 100 });
            toast("Biblioteca actualizada");
          })
          .catch((err) => {
            console.error(err);
            lastFailedAction = () => get().rescanFolder(id);
            set({ libState: "error", scanError: String(err) });
          });
      } else {
        get().startScan();
      }
    },
    backup: () => {
      if (isTauri()) {
        void pickSavePath().then((dest) => {
          if (dest) void backupDatabase(dest).then(() => toast("Copia de seguridad creada correctamente")).catch(console.error);
        });
      } else {
        toast("Copia de seguridad creada correctamente");
      }
    },
    restore: () => {
      if (!isTauri()) {
        toast("Selecciona un archivo de respaldo…", "info");
        return;
      }
      void pickDbFile().then(async (src) => {
        if (!src) return;
        // Read the backup before asking anything: a file that is not a Cantoral
        // database is rejected here, so the question is never even posed.
        let info;
        try {
          info = await inspectBackup(src);
        } catch (err) {
          console.error(err);
          toast(String(err), "error");
          return;
        }
        const st = get();
        const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
        get().askConfirm({
          title: "¿Restaurar este respaldo?",
          message: "Tu biblioteca actual se reemplaza por completo con la del respaldo.",
          detail:
            `Ahora: ${plural(st.tracks.length, "pista", "pistas")}, ` +
            `${plural(st.folders.length, "carpeta", "carpetas")} y ` +
            `${plural(st.playlists.length, "lista", "listas")}.\n` +
            `Respaldo: ${plural(info.tracks, "pista", "pistas")}, ` +
            `${plural(info.folders, "carpeta", "carpetas")} y ` +
            `${plural(info.playlists, "lista", "listas")}.`,
          safe: "Tus archivos de audio no se tocan. Si la restauración falla, la biblioteca actual vuelve intacta.",
          confirmLabel: "Restaurar",
          onConfirm: () => {
            restoreDatabaseCmd(src)
              .then((snap) => {
                applySnapshot(snap);
                set({ libState: snap.tracks.length ? "content" : "empty", scanError: null });
                toast("Base de datos restaurada");
              })
              .catch((err) => {
                console.error(err);
                toast("No se pudo restaurar la base de datos", "error");
              });
          },
        });
      });
    },

    // ---------- player tick / toast ----------
    tick: () => {
      const s = get();
      if (!s.playing) return;
      const t = cur(s);
      if (!t) return;
      // When a real audio file is loaded (Tauri), the <audio> element drives
      // posSec via timeupdate — the simulated timer only runs in the browser.
      if (isTauri() && t.path && !t.video && !t.missing) return;
      const p = s.posSec + 1;
      if (p >= t.durSec) get().advance();
      else set({ posSec: p });
    },
    askConfirm: (req) => set({ confirm: req }),
    closeConfirm: () => set({ confirm: null }),
    acceptConfirm: () => {
      const req = get().confirm;
      set({ confirm: null });
      req?.onConfirm();
    },

    showToast: (m, type = "success") => {
      if (toastTimer) clearTimeout(toastTimer);
      set({ toast: { message: m, type } });
      toastTimer = setTimeout(() => set({ toast: null }), type === "error" ? 4000 : 2200);
    },
  };
});

// ============================================================
// Derived selectors (pure) — used by components against a state snapshot.
// ============================================================

/** Apply the pending edit overlay for a track (matches design's eff()). */
export function eff(s: Pick<CantoralState, "edit">, t: Track): Track {
  const e = s.edit[t.id];
  return e ? { ...t, ...e } : t;
}

/** Currently loaded player track, with edits applied. */
export function cur(s: CantoralState): Track | null {
  const t = s.tracks.find((x) => x.id === s.playerId);
  return t ? eff(s, t) : null;
}

/**
 * Occasions actually present in the catalogue, for the filter chips.
 *
 * Derived rather than hardcoded so a custom occasion shows up as a filter.
 * Note that nothing currently writes `ocasion`, so outside the browser seed
 * this is empty until a way to edit track metadata exists.
 */
export function ocasiones(s: CantoralState): string[] {
  const found = new Set<string>();
  s.tracks.forEach((t) => {
    const o = eff(s, t).ocasion?.trim();
    if (o) found.add(o);
  });
  // Keep the active filter listed even if its last track just changed occasion,
  // otherwise its chip vanishes and the filter can no longer be switched off.
  if (s.ocasion) found.add(s.ocasion);
  return [...found].sort((a, b) => a.localeCompare(b, "es"));
}

/** Ids that form the play queue for the view the user pressed play in. */
export function queueForView(s: CantoralState): string[] {
  if (s.view === "lista") return (s.plOrder[s.curPlaylist] || []).slice();
  return applyFilters(s).map((t) => t.id);
}

/** Live play queue, minus ids whose track disappeared. Falls back to the library. */
export function playQueue(s: CantoralState): string[] {
  const ids = new Set(s.tracks.map((t) => t.id));
  const live = s.queue.filter((id) => ids.has(id));
  return live.length ? live : applyFilters(s).map((t) => t.id);
}

/** Filter + sort the library exactly like the design's applyFilters(). */
export function applyFilters(s: CantoralState): Track[] {
  let list = s.tracks.map((t) => eff(s, t));
  if (s.qf === "fav") list = list.filter((t) => t.fav);
  else if (s.qf === "missing") list = list.filter((t) => t.missing);
  else if (s.qf === "recent") list = list.slice().sort((a, b) => b.added - a.added).slice(0, 8);
  if (s.ocasion) list = list.filter((t) => t.ocasion === s.ocasion);
  if (s.query) {
    const q = s.query.toLowerCase();
    list = list.filter((t) =>
      [t.titulo, t.artista, t.album, t.tono, t.ocasion, (t.tags || []).join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }
  if (s.qf !== "recent") {
    const dir = s.sortDir === "asc" ? 1 : -1;
    const k = s.sortKey;
    list.sort((a, b) => {
      let av: string | number = a[k as keyof Track] as never;
      let bv: string | number = b[k as keyof Track] as never;
      if (k === "dur") {
        av = a.durSec;
        bv = b.durSec;
      }
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "es") * dir;
    });
  }
  return list;
}

export interface Group {
  showHeader: boolean;
  label?: string;
  countLabel?: string;
  tracks: { track: Track; num: number }[];
}

/** Group + number the filtered list like buildGroups(). */
export function buildGroups(s: CantoralState, list: Track[]): Group[] {
  if (s.groupBy === "none" || s.qf === "recent") {
    return [{ showHeader: false, tracks: list.map((track, i) => ({ track, num: i + 1 })) }];
  }
  const key = s.groupBy;
  const map = new Map<string, Track[]>();
  list.forEach((t) => {
    const g = (t[key as keyof Track] as string) || "—";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(t);
  });
  const keys = [...map.keys()].sort((a, b) => String(a).localeCompare(String(b), "es"));
  let n = 0;
  return keys.map((g) => {
    const arr = map.get(g)!.map((track) => ({ track, num: ++n }));
    return {
      showHeader: true,
      label: g,
      countLabel: arr.length + (arr.length === 1 ? " pista" : " pistas"),
      tracks: arr,
    };
  });
}

/** Total playlist duration label, e.g. "23 min". */
export function plDur(s: CantoralState, ids: string[]): string {
  const total = ids.reduce((a, id) => {
    const t = s.tracks.find((x) => x.id === id);
    return a + (t ? t.durSec : 0);
  }, 0);
  return Math.round(total / 60) + " min";
}
