import { backend } from "../lib/backend";
import type { Contexto, Get, Set } from "./contexto";
import { cur, queueForView, playQueue } from "./selectores";

// Parte del store (#134). Ver src/store/index.ts.
// El reproductor y su cola.

export interface ReproductorSlice {
  /** Ordered track ids the transport walks through (a culto list, or the library). */
  queue: string[];
  /**
   * De dónde salió la cola que está sonando.
   *
   * No se puede deducir mirándola: una cola de culto y una de biblioteca son
   * las dos una lista de ids, y el culto puede haber cambiado desde que se
   * puso a sonar. Se apunta al ponerla, que es el único momento en que se
   * sabe con seguridad.
   */
  queueOrigen: "biblioteca" | "culto";

  // ---- player ----
  playerId: string;
  playing: boolean;
  /**
   * Si algo ha sonado en esta sesión. Hasta entonces la barra del reproductor
   * no se muestra: enseñaba una canción cualquiera que no estaba sonando. Una
   * vez que suena algo se queda, también en pausa, porque es desde donde se
   * reanuda.
   */
  haSonado: boolean;
  posSec: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: boolean;

  play: (id: string, queue?: string[]) => void;
  togglePlay: () => void;
  /** Auto-advance when a track finishes (honours «repetir»). */
  advance: () => void;
  /** Poner el transporte en una pista, abriendo lo que haga falta para verla. */
  irAPista: (id: string) => void;
  prev: () => void;
  next: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleMute: () => void;
  seekToFraction: (f: number) => void;
  setVolume: (f: number) => void;

  tick: () => void;
}

export function crearReproductor(set: Set, get: Get, ctx: Contexto): ReproductorSlice {
  const { toast } = ctx;
  return {
    queue: [],
    queueOrigen: "biblioteca",

    playerId: "",
    playing: false,
    haSonado: false,
    posSec: 0,
    volume: 0.72,
    muted: false,
    shuffle: false,
    repeat: false,
    play: (id, queue) => {
      const s = get();
      const t = s.tracks.find((x) => x.id === id);
      if (!t) return;
      if (t.missing) {
        toast("El archivo no se encuentra en el disco", { tipo: "error" });
        return;
      }
      // Playing from a culto list queues that list, so the transport follows the
      // service order instead of falling back to whatever the library shows.
      //
      // Un video se reproduce dentro, como cualquier otra pista. Esto se lo
      // pasaba al reproductor del sistema, que en mitad de un culto significaba
      // otra ventana encima de la proyección, otro volumen y otra cola — con la
      // lista del culto quedándose atrás.
      set({ queue: queue ?? queueForView(s), queueOrigen: s.view === "lista" ? "culto" : "biblioteca", playing: true });
      get().irAPista(id);
    },
    togglePlay: () => {
      const s = get();
      const t = cur(s);
      // Reanudar un video que se pausó al cerrar el panel (#125): sin el panel
      // no hay `<video>` que suene, así que se vuelve a abrir en esa pista, como
      // hace `irAPista` al llegar a un video.
      if (!s.playing && t?.video && !(s.detailOpen && s.selId === t.id)) {
        if (s.selId !== t.id) get().flushEdit();
        set({ playing: true, detailOpen: true, selId: t.id, saveState: "idle" });
        return;
      }
      set({ playing: !s.playing });
    },
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
      get().irAPista(n);
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
      get().irAPista(n);
    },

    irAPista: (id) => {
      // La única superficie de video de esta ventana está en el panel de
      // detalle, así que llegar a un video sin el panel abierto sería llegar a
      // una pista que suena y no se ve. Se abre solo, y en la pista que toca.
      const t = get().tracks.find((x) => x.id === id);
      set(t?.video ? { playerId: id, posSec: 0, detailOpen: true, selId: id } : { playerId: id, posSec: 0 });
    },
    toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
    toggleRepeat: () => set((s) => ({ repeat: !s.repeat })),
    toggleMute: () => set((s) => ({ muted: !s.muted })),
    seekToFraction: (f) => {
      const t = cur(get());
      if (t) set({ posSec: Math.round(Math.min(1, Math.max(0, f)) * t.durSec) });
    },
    setVolume: (f) => set({ volume: Math.min(1, Math.max(0, f)), muted: false }),

    tick: () => {
      const s = get();
      if (!s.playing) return;
      const t = cur(s);
      if (!t) return;
      // When a real file is loaded (Tauri), its <audio> or <video> element
      // drives posSec via timeupdate and the queue via onEnded — the simulated
      // timer only runs where there is no file to play. Videos used to be left out, so the bar
      // kept advancing over a video the closed panel had silenced, and two
      // writers raced on posSec while it was open (#125).
      if (backend().reproduceArchivos && t.path && !t.missing) return;
      const p = s.posSec + 1;
      if (p >= t.durSec) get().advance();
      else set({ posSec: p });
    },
  };
}
