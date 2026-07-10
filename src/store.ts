import { create } from "zustand";
import type {
  Folder,
  GroupBy,
  LibState,
  Playlist,
  QuickFilter,
  SortKey,
  Theme,
  Track,
  TrackEdit,
  View,
} from "./lib/types";
import { SCAN_FILES, SEED_FOLDERS, SEED_PLAYLISTS, SEED_TRACKS } from "./lib/seed";
import {
  addAndScanFolder,
  assetUrl,
  backupDatabase,
  getLibrary,
  isTauri,
  openExternalPath,
  pickSavePath,
  removeFolderCmd,
  rescanFolderCmd,
  setPlaylistOrderCmd,
  setTrackFav,
  updateTrackCmd,
  type Snapshot,
} from "./lib/api";

// Module-scoped timers (kept out of React/zustand state).
let scanTimer: ReturnType<typeof setInterval> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let dragId: string | null = null;

export interface CantoralState {
  // ---- data ----
  tracks: Track[];
  folders: Folder[];
  playlists: Playlist[];
  plOrder: Record<string, string[]>;

  // ---- ui / navigation ----
  theme: Theme;
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
  dialog: "addFolder" | null;
  scanPct: number;
  scanIdx: number;
  scanFile: string;

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
  toast: string | null;

  // ---- actions ----
  showBiblioteca: () => void;
  showColecciones: () => void;
  showConfig: () => void;
  onFolderClick: () => void;
  openPlaylist: (id: string) => void;
  toggleTheme: () => void;
  setThemeTo: (t: Theme) => void;

  onQuery: (v: string) => void;
  clearQuery: () => void;
  onQuickFilter: (q: Exclude<QuickFilter, null>) => void;
  onOcasion: (o: string) => void;
  onGroupBy: (g: GroupBy) => void;
  onSortHeader: (k: SortKey) => void;

  onRowClick: (id: string) => void;
  onFav: (id: string) => void;
  onOpenExternal: (id: string) => void;

  play: (id: string) => void;
  togglePlay: () => void;
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
  closeDialog: () => void;
  confirmAddFolder: () => void;
  indexFolder: (path?: string) => void;
  startScan: () => void;
  cancelScan: () => void;
  retryError: () => void;
  hydrate: () => Promise<void>;

  playAll: () => void;
  exportPl: () => void;
  newList: () => void;
  removeFromPl: (id: string) => void;
  reorderPl: (toId: string) => void;
  setDragging: (id: string) => void;
  setOver: (id: string | null) => void;
  clearDrag: () => void;

  toggleOpenExt: () => void;
  removeFolder: (id: string) => void;
  rescanFolder: (id?: string) => void;
  backup: () => void;
  restore: () => void;

  tick: () => void;
  showToast: (m: string) => void;
}

const initialPlOrder: Record<string, string[]> = {};
SEED_PLAYLISTS.forEach((p) => (initialPlOrder[p.id] = p.ids.slice()));

export const useStore = create<CantoralState>((set, get) => {
  const toast = (m: string) => get().showToast(m);

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
    set({ tracks, folders: snap.folders, playlists: snap.playlists, plOrder, curPlaylist, playerId });
  };

  return {
    tracks: SEED_TRACKS.map((t) => ({ ...t })),
    folders: SEED_FOLDERS.map((f) => ({ ...f })),
    playlists: SEED_PLAYLISTS,
    plOrder: initialPlOrder,

    theme: "light",
    view: "biblioteca",
    libState: "content",

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

    playerId: "t1",
    playing: false,
    posSec: 47,
    volume: 0.72,
    muted: false,
    shuffle: false,
    repeat: false,

    curPlaylist: "p1",
    openExt: false,
    draggingId: null,
    overId: null,

    toast: null,

    // ---------- nav ----------
    showBiblioteca: () => set({ view: "biblioteca" }),
    showColecciones: () => set({ view: "colecciones" }),
    showConfig: () => set({ view: "config" }),
    onFolderClick: () =>
      set({ view: "biblioteca", libState: "content", qf: null, ocasion: null }),
    openPlaylist: (id) => set({ view: "lista", curPlaylist: id }),
    toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
    setThemeTo: (t) => set({ theme: t }),

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
        toast("Abriendo en el reproductor del sistema…");
        return;
      }
      if (!t?.path) {
        toast("Sin archivo para abrir");
        return;
      }
      toast("Abriendo en el reproductor del sistema…");
      void openExternalPath(t.path).catch((err) => {
        console.error("openExternalPath failed", err);
        toast("No se pudo abrir el archivo");
      });
    },

    // ---------- player ----------
    play: (id) => {
      const t = get().tracks.find((x) => x.id === id);
      if (!t) return;
      if (t.missing) {
        toast("El archivo no se encuentra en el disco");
        return;
      }
      // Videos always, and any track when "abrir en el sistema" is on, open in
      // the OS default player instead of the integrated one.
      if (t.video || get().openExt) {
        get().onOpenExternal(id);
        return;
      }
      set({ playerId: id, playing: true, posSec: 0 });
    },
    togglePlay: () => set((s) => ({ playing: !s.playing })),
    prev: () => {
      const ids = applyFilters(get()).map((t) => t.id);
      const i = ids.indexOf(get().playerId);
      const n = ids.length ? ids[(i - 1 + ids.length) % ids.length] : get().playerId;
      set({ playerId: n, posSec: 0 });
    },
    next: () => {
      const s = get();
      const ids = applyFilters(s).map((t) => t.id);
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
    closeDialog: () => set({ dialog: null }),
    confirmAddFolder: () => {
      set({ dialog: null });
      get().indexFolder();
    },
    indexFolder: (path) => {
      set({ dialog: null });
      if (isTauri() && path) {
        if (scanTimer) clearInterval(scanTimer);
        scanTimer = null;
        set({ view: "biblioteca", libState: "scanning", scanPct: 0, scanIdx: 0, scanFile: "" });
        addAndScanFolder(path)
          .then((snap) => {
            applySnapshot(snap);
            set({ libState: "content", scanPct: 100 });
            toast("Biblioteca actualizada");
          })
          .catch((err) => {
            console.error(err);
            set({ libState: "error" });
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
      set({ libState: "content" });
    },
    retryError: () => get().startScan(),
    hydrate: async () => {
      if (!isTauri()) return;
      try {
        const snap = await getLibrary();
        if (snap) {
          applySnapshot(snap);
          set({ libState: snap.tracks.length ? "content" : "empty" });
        }
      } catch (err) {
        console.error("hydrate failed", err);
      }
    },

    // ---------- collections ----------
    playAll: () => {
      const ord = get().plOrder[get().curPlaylist] || [];
      if (ord.length) {
        get().play(ord[0]);
        toast("Reproduciendo la lista completa");
      }
    },
    exportPl: () => toast("Lista exportada como PDF"),
    newList: () => toast("Nueva lista para culto"),
    removeFromPl: (id) => {
      const cur2 = get().curPlaylist;
      const next = (get().plOrder[cur2] || []).filter((x) => x !== id);
      set((st) => ({ plOrder: { ...st.plOrder, [cur2]: next } }));
      void setPlaylistOrderCmd(cur2, next);
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
          arr.splice(fi, 1);
          arr.splice(ti, 0, from);
          set((st) => ({ plOrder: { ...st.plOrder, [cur2]: arr } }));
          void setPlaylistOrderCmd(cur2, arr);
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
    toggleOpenExt: () => set((st) => ({ openExt: !st.openExt })),
    removeFolder: (id) => {
      if (isTauri()) {
        removeFolderCmd(id).then(applySnapshot).catch(console.error);
      } else {
        set((s) => ({ folders: s.folders.filter((f) => f.id !== id) }));
      }
      toast("Carpeta quitada de la biblioteca");
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
            set({ libState: "error" });
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
    restore: () => toast("Selecciona un archivo de respaldo…"),

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
      if (p >= t.durSec) get().next();
      else set({ posSec: p });
    },
    showToast: (m) => {
      if (toastTimer) clearTimeout(toastTimer);
      set({ toast: m });
      toastTimer = setTimeout(() => set({ toast: null }), 2200);
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
