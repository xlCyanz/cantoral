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
import { SCAN_FILES, SEED_FOLDERS, SEED_PLAYLISTS, SEED_TRACKS, seedDuplicates } from "./lib/seed";
import { playlistSheetHtml, sheetFileName } from "./lib/exportSheet";
import { PREF_FIELDS, UI_PREFS_KEY, parsePrefs, resolveView, serialisePrefs } from "./lib/uiPrefs";
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
  dismissDuplicatesCmd,
  findDuplicatesCmd,
  inspectBackup,
  isTauri,
  mergeDuplicatesCmd,
  restoreDismissedDuplicatesCmd,
  openExternalPath,
  pickDbFile,
  pickExportPath,
  pickFolder,
  pickMediaFile,
  pickSavePath,
  reconcileLibraryCmd,
  revealFile,
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
  type DuplicateGroup,
  type Snapshot,
} from "./lib/api";

// Module-scoped timers (kept out of React/zustand state).
let scanTimer: ReturnType<typeof setInterval> | null = null;
/** Poll that pulls in tracks a running scan has already indexed. */
let refreshTimer: ReturnType<typeof setInterval> | null = null;
/** True while a catalogue pull is in flight, so they cannot pile up. */
let refreshing = false;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let dragId: string | null = null;
/** Action to re-run from the error state — set whenever a backend call fails. */
let lastFailedAction: (() => void) | null = null;
/** Debounce for track edits, which now write themselves. */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** Id of the track whose edit is waiting out the debounce, if any. */
let pendingSave: string | null = null;
/** Debounce for writing the interface preferences back. */
let prefsTimer: ReturnType<typeof setTimeout> | null = null;

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

/** Lifecycle of an edit that saves itself. */
export type SaveState = "idle" | "saving" | "saved" | "error";

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
  tagDraft: string;
  /** How the selected track's edit is doing. Edits write themselves. */
  saveState: SaveState;

  // ---- dialog / scan ----
  dialog: "addFolder" | "newList" | "editList" | "help" | null;
  /**
   * Whether a scan is walking the disk right now.
   *
   * Deliberately separate from `libState`: a scan runs *alongside* the library
   * instead of replacing it, so the catalogue stays searchable while its
   * folders are being indexed.
   */
  scanning: boolean;
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

  // ---- duplicates ----
  /** Groups of tracks that look like the same song. Empty until searched. */
  duplicates: DuplicateGroup[];
  /** How many groups the user has waved off, so they can be offered back. */
  duplicatesDismissed: number;
  duplicatesState: "idle" | "buscando" | "listo";

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

  /** Change one field of the selected track. It writes itself, debounced. */
  setEdit: (field: keyof TrackEdit, val: unknown) => void;
  onTagDraft: (v: string) => void;
  addTag: (v: string) => void;
  removeTag: (tag: string) => void;
  closeDetail: () => void;
  /** Write an edit still waiting out the debounce, right now. */
  flushEdit: () => void;

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
  /** Show a track's file in the system file manager. */
  revealTrack: (id: string) => void;
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

  /** Look for tracks that are the same song. */
  findDuplicates: () => void;
  /** Fold a group's other copies into the one chosen, after confirming. */
  mergeDuplicates: (signature: string, keepId: string) => void;
  /** Mark a group as not duplicates, so it stops being offered. */
  dismissDuplicates: (signature: string) => void;
  /** Offer every dismissed group again. */
  restoreDismissedDuplicates: () => void;

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
    set({
      tracks,
      folders: snap.folders,
      playlists: snap.playlists,
      plOrder,
      curPlaylist,
      playerId,
      queue,
      // Any list of duplicates was computed against the catalogue that just
      // got replaced. Offering the user a choice about tracks that may no
      // longer exist is worse than asking them to search again.
      duplicates: [],
      duplicatesState: "idle",
    });
  };

  /** How often the catalogue is pulled in while a scan is running. */
  const REFRESCO_MS = 2000;

  /**
   * Pull the catalogue periodically while a scan walks the disk.
   *
   * The backend was built for exactly this — the scan runs on its own
   * connection and commits in batches of 200 — so what it has indexed so far is
   * already readable. Without this the library would sit frozen at whatever it
   * held when the scan started and only catch up at the very end.
   */
  const startLiveRefresh = () => {
    if (refreshTimer || !isTauri()) return;
    refreshTimer = setInterval(() => {
      // Never while a pull is already out, and never on top of an edit still
      // waiting out its debounce: the snapshot would overwrite what is being
      // typed with the value the backend has not been told about yet.
      if (refreshing || pendingSave) return;
      refreshing = true;
      void getLibrary()
        .then((snap) => {
          // A snapshot that arrives after the scan ended is stale by
          // definition — the final one has already landed.
          if (!snap || !get().scanning) return;
          applySnapshot(snap);
          // As soon as there is something to show, the library shows it: the
          // full-view scan card is only for having nothing at all.
          if (snap.tracks.length) set({ libState: "content" });
        })
        .catch((err) => console.error("live refresh failed", err))
        .finally(() => {
          refreshing = false;
        });
    }, REFRESCO_MS);
  };

  const stopLiveRefresh = () => {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
  };

  /**
   * Write the track that is waiting out the debounce.
   *
   * Reads the values straight from the catalogue rather than from a copy taken
   * when the edit was made, so whatever the user ended up with is what gets
   * stored — including keystrokes that landed after the timer was set.
   */
  const writePendingEdit = () => {
    const id = pendingSave;
    pendingSave = null;
    if (!id) return;
    const t = get().tracks.find((x) => x.id === id);
    if (!t) return;

    updateTrackCmd(t.id, t.tono, t.bpm, t.ocasion, t.tags || [])
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
        get().showToast("No se pudieron guardar los cambios", "error");
      });
  };

  /** Push the write out by a beat, so a burst of typing is one round trip. */
  const scheduleSave = (id: string) => {
    // Moving to another track writes the previous one before taking its place.
    if (pendingSave && pendingSave !== id) writePendingEdit();
    pendingSave = id;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      writePendingEdit();
    }, 600);
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
    tagDraft: "",
    saveState: "idle",

    dialog: null,
    scanning: false,
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

    duplicates: [],
    duplicatesDismissed: 0,
    duplicatesState: "idle",

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
    onRowClick: (id) => {
      // Moving to another track must not leave the previous one's edit in limbo.
      if (get().selId !== id) get().flushEdit();
      set({ selId: id, detailOpen: true, tagDraft: "", saveState: "idle" });
    },
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
    onTagDraft: (v) => set({ tagDraft: v }),
    addTag: (v) => {
      const val = v.trim();
      if (!val) return;
      const s = get();
      if (!s.selId) return;
      const curT = s.tracks.find((x) => x.id === s.selId);
      const tags = (curT?.tags || []).slice();
      if (!tags.includes(val)) tags.push(val);
      s.setEdit("tags", tags);
      set({ tagDraft: "" });
    },
    removeTag: (tag) => {
      const s = get();
      if (!s.selId) return;
      const curT = s.tracks.find((x) => x.id === s.selId);
      s.setEdit("tags", (curT?.tags || []).filter((t) => t !== tag));
    },
    closeDetail: () => {
      // Nothing may stay waiting out the debounce once the panel is gone.
      get().flushEdit();
      set({ detailOpen: false });
    },
    flushEdit: () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      writePendingEdit();
    },

    // ---------- dialog / states ----------
    openAddFolder: () => {
      // The buttons that get here are disabled while a scan runs, but the
      // store is where the rule actually lives — only one scan at a time, and
      // the dialog's only outcome is starting one.
      if (get().scanning) {
        toast("Espera a que termine el escaneo en curso", "info");
        return;
      }
      set({ dialog: "addFolder" });
    },
    openHelp: () => set({ dialog: "help" }),
    closeDialog: () => set({ dialog: null }),
    confirmAddFolder: () => {
      set({ dialog: null });
      get().indexFolder();
    },
    indexFolder: (path, recursive = true) => {
      set({ dialog: null });
      // The backend refuses a second scan outright, and an error screen is a
      // harsh answer to what is usually a double click.
      if (get().scanning) {
        toast("Espera a que termine el escaneo en curso", "info");
        return;
      }
      if (isTauri() && path) {
        if (scanTimer) clearInterval(scanTimer);
        scanTimer = null;
        // The view does move to the library here — the user just asked for a
        // folder from the add dialog, so that is where they expect to land.
        // What it no longer does is *replace* the library with the scan.
        set({ view: "biblioteca", scanning: true, scanPct: 0, scanIdx: 0, scanFile: "" });
        startLiveRefresh();
        addAndScanFolder(path, recursive)
          .then((snap) => {
            applySnapshot(snap);
            set({ scanning: false, libState: snap.tracks.length ? "content" : "empty", scanPct: 100 });
            toast("Biblioteca actualizada");
          })
          .catch((err) => {
            console.error(err);
            lastFailedAction = () => get().indexFolder(path, recursive);
            set({ scanning: false, libState: "error", scanError: String(err) });
          })
          .finally(stopLiveRefresh);
      } else {
        set({ view: "biblioteca" });
        get().startScan();
      }
    },
    // Browser stand-in for a real scan. It deliberately does not touch `view`:
    // it stands in for both adding a folder and re-scanning one, and only the
    // first of those has any business moving the user.
    startScan: () => {
      if (scanTimer) clearInterval(scanTimer);
      set({ scanning: true, scanPct: 0, scanIdx: 0 });
      scanTimer = setInterval(() => {
        const p = get().scanPct + Math.random() * 7 + 3;
        if (p >= 100) {
          if (scanTimer) clearInterval(scanTimer);
          scanTimer = null;
          set({ scanPct: 100, scanning: false, libState: "content" });
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
      stopLiveRefresh();
      // Stop the backend walk too — clearing the timer only ever hid the
      // browser simulation, leaving a real scan running to completion.
      void cancelScanCmd().catch(console.error);
      // `libState` is left alone: whatever the library was showing is still
      // what it holds. A cancelled first scan goes back to the empty state on
      // its own, because nothing was ever indexed.
      set({ scanning: false });
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
        const [modeS, themeS, openExtS, uiS] = await Promise.all([
          getSetting("themeMode"),
          getSetting("theme"),
          getSetting("openExt"),
          getSetting(UI_PREFS_KEY),
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
        // The rest of the interface: volume, transport, sorting, grouping and
        // where the user was. Only the fields that survived validation, over
        // whatever the defaults are, and settled against the lists that exist.
        const prefs = parsePrefs(uiS);
        Object.assign(patch, prefs, resolveView(prefs, snap?.playlists ?? get().playlists));
        if (Object.keys(patch).length) {
          set(patch);
          // Nothing read at startup is worth writing back, and `applySnapshot`
          // ran a moment ago and may already have queued a write of a
          // `curPlaylist` it picked on its own. What was just restored is the
          // newer truth, so whatever is queued goes.
          if (prefsTimer) {
            clearTimeout(prefsTimer);
            prefsTimer = null;
          }
        }

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
        .filter((t): t is Track => !!t);
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
    revealTrack: (id) => {
      const t = get().tracks.find((x) => x.id === id);
      if (!t?.path) return;
      if (!isTauri()) {
        toast("Mostrar el archivo solo funciona en la app de escritorio", "info");
        return;
      }
      revealFile(t.path).catch((err) => {
        console.error("revealItemInDir failed", err);
        toast("No se pudo mostrar el archivo", "error");
      });
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
      if (get().scanning) {
        toast("Espera a que termine el escaneo en curso", "info");
        return;
      }
      if (isTauri() && id) {
        // No `view` here on purpose. A re-scan is started from Configuración,
        // and yanking the user out of the screen they are working on is the
        // whole complaint this change exists to fix.
        set({ scanning: true, scanPct: 0, scanIdx: 0, scanFile: "" });
        startLiveRefresh();
        rescanFolderCmd(id)
          .then((snap) => {
            applySnapshot(snap);
            set({ scanning: false, libState: snap.tracks.length ? "content" : "empty", scanPct: 100 });
            toast("Biblioteca actualizada");
          })
          .catch((err) => {
            console.error(err);
            lastFailedAction = () => get().rescanFolder(id);
            set({ scanning: false, libState: "error", scanError: String(err) });
          })
          .finally(stopLiveRefresh);
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
    // ---------- duplicates ----------
    findDuplicates: () => {
      set({ duplicatesState: "buscando" });
      if (!isTauri()) {
        // Fixture, not a search: the real grouping reads file sizes and lengths
        // the browser mock does not have.
        set({ duplicates: seedDuplicates(), duplicatesDismissed: 0, duplicatesState: "listo" });
        return;
      }
      findDuplicatesCmd()
        .then((r) => {
          if (r) set({ duplicates: r.groups, duplicatesDismissed: r.dismissed, duplicatesState: "listo" });
        })
        .catch((err) => {
          console.error("find_duplicates failed", err);
          set({ duplicatesState: "idle" });
          toast(String(err), "error");
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
          "Sus etiquetas, su favorito y su sitio en las listas para culto pasan a la que se queda. " +
          "Los archivos de audio no se borran del disco.",
        confirmLabel: "Fusionar",
        onConfirm: () => {
          const ids = copias.map((c) => c.id);
          if (!isTauri()) {
            // Browser stand-in: the same visible outcome, none of the SQL.
            set((st) => {
              const fuera = new Set(ids);
              const etiquetas = new Set<string>();
              let fav = false;
              st.tracks.forEach((t) => {
                if (t.id === keepId || fuera.has(t.id)) {
                  (t.tags || []).forEach((x) => etiquetas.add(x));
                  fav = fav || t.fav;
                }
              });
              // Lists follow the survivor, and a list that held two copies
              // ends up with the song once, not twice.
              const plOrder: Record<string, string[]> = {};
              Object.entries(st.plOrder).forEach(([pid, orden]) => {
                const visto = new Set<string>();
                const nuevo: string[] = [];
                orden.forEach((id) => {
                  const destino = fuera.has(id) ? keepId : id;
                  if (visto.has(destino)) return;
                  visto.add(destino);
                  nuevo.push(destino);
                });
                plOrder[pid] = nuevo;
              });
              return {
                tracks: st.tracks
                  .filter((t) => !fuera.has(t.id))
                  .map((t) => (t.id === keepId ? { ...t, tags: [...etiquetas].sort(), fav } : t)),
                plOrder,
                duplicates: st.duplicates.filter((g) => g.signature !== signature),
              };
            });
            toast(ids.length === 1 ? "1 copia fusionada" : `${ids.length} copias fusionadas`);
            return;
          }
          mergeDuplicatesCmd(keepId, ids)
            .then((snap) => {
              if (snap) applySnapshot(snap);
              toast(ids.length === 1 ? "1 copia fusionada" : `${ids.length} copias fusionadas`);
              // `applySnapshot` cleared the list; fill it with what is left.
              get().findDuplicates();
            })
            .catch((err) => {
              console.error("merge_duplicates failed", err);
              toast(String(err), "error");
            });
        },
      });
    },

    dismissDuplicates: (signature) => {
      if (!isTauri()) {
        set((st) => ({
          duplicates: st.duplicates.filter((g) => g.signature !== signature),
          duplicatesDismissed: st.duplicatesDismissed + 1,
        }));
        return;
      }
      dismissDuplicatesCmd(signature)
        .then((r) => {
          if (r) set({ duplicates: r.groups, duplicatesDismissed: r.dismissed });
        })
        .catch((err) => {
          console.error("dismiss_duplicates failed", err);
          toast(String(err), "error");
        });
    },

    restoreDismissedDuplicates: () => {
      if (!isTauri()) {
        set({ duplicates: seedDuplicates(), duplicatesDismissed: 0 });
        return;
      }
      restoreDismissedDuplicatesCmd()
        .then((r) => {
          if (r) set({ duplicates: r.groups, duplicatesDismissed: r.dismissed });
        })
        .catch((err) => {
          console.error("restore_dismissed_duplicates failed", err);
          toast(String(err), "error");
        });
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
// Writing the interface preferences back
// ============================================================

/** How long a change waits before it is written. */
const PREFS_MS = 400;

function writePrefs() {
  if (prefsTimer) clearTimeout(prefsTimer);
  prefsTimer = null;
  void setSetting(UI_PREFS_KEY, serialisePrefs(useStore.getState())).catch((err) =>
    console.error("could not save the interface preferences", err),
  );
}

function schedulePrefsSave() {
  if (prefsTimer) clearTimeout(prefsTimer);
  prefsTimer = setTimeout(writePrefs, PREFS_MS);
}

/**
 * Write a preference that is still waiting out the debounce, right now.
 *
 * Lowering the volume and closing the window is the exact sequence the whole
 * feature exists for, so it must not be the one that gets lost.
 */
export function flushUiPrefs() {
  if (prefsTimer) writePrefs();
}

/**
 * Watch the preferences instead of saving from each action that changes one.
 *
 * Nine fields are reached from a dozen places — a dragged volume bar, a clicked
 * column header, a list opened from the sidebar — and a save hung off each one
 * is a save that gets forgotten the next time somebody adds a tenth. This sees
 * the change wherever it came from.
 */
if (isTauri()) {
  useStore.subscribe((s, previo) => {
    if (PREF_FIELDS.every((campo) => s[campo] === previo[campo])) return;
    schedulePrefsSave();
  });
}

// ============================================================
// Derived selectors (pure) — used by components against a state snapshot.
// ============================================================

/**
 * Wrap a pure selector so it only recomputes when what it reads changes.
 *
 * The library is filtered, sorted and grouped by more than one component on
 * every render, while the player writes `posSec` several times a second — so
 * without this the whole catalogue is walked a few dozen times a second to
 * produce a result that did not change. Keeping the previous result also keeps
 * its **identity**, which is what lets `useStore(applyFilters)` skip a render
 * instead of handing React a new array that merely looks the same.
 *
 * One entry is enough: every call inside a render pass reads the same
 * snapshot, and a snapshot that has been replaced is never read again.
 *
 * The cached value is shared between callers, so treat it as read-only.
 */
function recordar<A extends unknown[], T>(
  calcular: (...args: A) => T,
  leer: (...args: A) => unknown[],
): (...args: A) => T {
  let deps: unknown[] | null = null;
  let valor!: T;
  return (...args: A): T => {
    const ahora = leer(...args);
    if (deps && deps.length === ahora.length && deps.every((d, i) => Object.is(d, ahora[i]))) return valor;
    deps = ahora;
    valor = calcular(...args);
    return valor;
  };
}

/**
 * Whether the scan takes over the library view instead of a corner card.
 *
 * Only for a scan that has nothing behind it: a first scan of an empty
 * library, where a corner card would float over a blank screen. The moment
 * there is a catalogue to show — even one the running scan is still filling —
 * the table wins and the scan moves to the corner.
 *
 * Shared by the view and the card so the two can never both decide they are
 * the one showing the progress.
 */
export function escaneoAPantallaCompleta(s: CantoralState): boolean {
  return s.scanning && s.libState === "empty" && s.view === "biblioteca";
}

/** Currently loaded player track. */
export function cur(s: CantoralState): Track | null {
  return s.tracks.find((x) => x.id === s.playerId) ?? null;
}

/**
 * Occasions actually present in the catalogue, for the filter chips.
 *
 * Derived rather than hardcoded so a custom occasion shows up as a filter as
 * soon as a track carries it — the detail panel writes occasions straight into
 * the catalogue, so there is no half-saved state to reason about here.
 */
export const ocasiones = recordar(
  (s: CantoralState): string[] => {
    const found = new Set<string>();
    s.tracks.forEach((t) => {
      const o = t.ocasion?.trim();
      if (o) found.add(o);
    });
    // Keep the active filter listed even if its last track just changed occasion,
    // otherwise its chip vanishes and the filter can no longer be switched off.
    if (s.ocasion) found.add(s.ocasion);
    return [...found].sort((a, b) => a.localeCompare(b, "es"));
  },
  (s: CantoralState) => [s.tracks, s.ocasion],
);

/**
 * Tracks of the open culto list, in its order, skipping ids whose track is gone.
 *
 * Remembered like the others: the view reads it on every render, and a fresh
 * array each time would re-render the whole list once a second.
 */
export const filasDeLista = recordar(
  (s: CantoralState): Track[] =>
    (s.plOrder[s.curPlaylist] || [])
      .map((id) => s.tracks.find((t) => t.id === id))
      .filter((t): t is Track => !!t),
  (s: CantoralState) => [s.curPlaylist, s.plOrder[s.curPlaylist], s.tracks],
);

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
export const applyFilters = recordar(
  (s: CantoralState): Track[] => {
    let list = s.tracks.slice();
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
  },
  (s: CantoralState) => [s.tracks, s.qf, s.ocasion, s.query, s.sortKey, s.sortDir],
);

export interface Group {
  showHeader: boolean;
  label?: string;
  countLabel?: string;
  tracks: { track: Track; num: number }[];
}

/** Group + number the filtered list like buildGroups(). */
export const buildGroups = recordar(
  (s: CantoralState, list: Track[]): Group[] => {
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
  },
  (s: CantoralState, list: Track[]) => [list, s.groupBy, s.qf],
);

/**
 * Total playlist duration label, e.g. "23 min".
 *
 * Takes the catalogue rather than the whole state so a view can call it while
 * only subscribing to `tracks`.
 */
export function plDur(s: { tracks: Track[] }, ids: string[]): string {
  const total = ids.reduce((a, id) => {
    const t = s.tracks.find((x) => x.id === id);
    return a + (t ? t.durSec : 0);
  }, 0);
  return Math.round(total / 60) + " min";
}
