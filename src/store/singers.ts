import type { Singer } from "../lib/types";
import { backend } from "../lib/backend";
import type { Contexto, Get, Set } from "./contexto";
import { pistasPorId } from "./selectores";

// Parte del store (#134). Ver src/store/index.ts.
// Los cantantes de la iglesia: quiénes son y quiénes se saben cada canción.

export interface SingersSlice {
  /** Personas registradas como cantantes de la iglesia. */
  singers: Singer[];
  /** Pista cuya ventana de «¿quién se la sabe?» está abierta, o null. */
  singerCheckTrack: string | null;
  /** Si se pregunta al terminar una canción. Ver `uiPrefs`. */
  askSingersAtEnd: boolean;

  addSinger: (nombre: string) => void;
  renameSinger: (id: string, nombre: string) => void;
  deleteSinger: (id: string) => void;
  /** Marcar o desmarcar que un cantante se sabe la pista del panel. */
  toggleSingerOnTrack: (nombre: string) => void;
  /** Guardar quiénes se saben la pista del aviso post-canción. */
  saveSingersForTrack: (nombres: string[]) => void;
  closeSingerCheck: () => void;
  setAskSingersAtEnd: (v: boolean) => void;
}

export function createSingers(set: Set, get: Get, ctx: Contexto): SingersSlice {
  const { toast, avisarFallo, applySnapshot } = ctx;

  /** Los ids de los cantantes que llevan estos nombres. Nombres que la base
   *  ya no tiene —borrados entre un dibujo y otro— no llegan al núcleo. */
  const idsDe = (nombres: readonly string[]): string[] => {
    const porNombre = new Map(get().singers.map((c) => [c.nombre, c.id]));
    return nombres.map((n) => porNombre.get(n)).filter((id): id is string => !!id);
  };

  return {
    singers: [],
    singerCheckTrack: null,
    askSingersAtEnd: true,

    addSinger: (nombre) => {
      const limpio = nombre.trim();
      if (!limpio) return;
      backend()
        .addSinger(limpio)
        .then((snap) => applySnapshot(snap))
        .catch((err) => avisarFallo(err, "No se pudo añadir el cantante"));
    },
    renameSinger: (id, nombre) => {
      const limpio = nombre.trim();
      if (!limpio) return;
      // El filtro «Hoy cantan» guarda nombres: si este está en él, lo sigue
      // con su nombre nuevo, y si la base le negó el cambio no llega aquí.
      const antes = get().singers.find((c) => c.id === id)?.nombre;
      backend()
        .renameSinger(id, limpio)
        .then((snap) => {
          applySnapshot(snap);
          if (antes && antes !== limpio) {
            set((st) => ({
              singingToday: st.singingToday.map((n) => (n === antes ? limpio : n)),
            }));
          }
        })
        .catch((err) => avisarFallo(err, "No se pudo renombrar el cantante"));
    },
    deleteSinger: (id) => {
      const nombre = get().singers.find((c) => c.id === id)?.nombre;
      backend()
        .deleteSinger(id)
        .then((snap) => {
          applySnapshot(snap);
          if (nombre) {
            // La cascada ya se lo llevó de las pistas; el filtro tampoco
            // puede quedar filtrando por alguien que ya no existe.
            set((st) => ({ singingToday: st.singingToday.filter((n) => n !== nombre) }));
          }
        })
        .catch((err) => avisarFallo(err, "No se pudo quitar el cantante"));
    },

    toggleSingerOnTrack: (nombre) => {
      const id = get().selId;
      const t = id ? pistasPorId(get().tracks).get(id) : undefined;
      if (!id || !t) return;
      const ya = t.singers.includes(nombre);
      const nombres = ya ? t.singers.filter((n) => n !== nombre) : [...t.singers, nombre];
      set((st) => ({
        tracks: st.tracks.map((x) => (x.id === id ? { ...x, singers: nombres } : x)),
      }));
      backend()
        .setTrackSingers(id, idsDe(nombres))
        .then((snap) => applySnapshot(snap))
        .catch((err) => {
          console.error("set_track_singers failed", err);
          toast("No se pudo guardar quién se la sabe", { tipo: "error" });
          // Volver a lo que tenía: un corazón marcado en pantalla y a la vez
          // no guardado se lee como que está a medio hacer.
          set((st) => ({
            tracks: st.tracks.map((x) => (x.id === id ? { ...x, singers: t.singers } : x)),
          }));
        });
    },

    saveSingersForTrack: (nombres) => {
      const id = get().singerCheckTrack;
      if (!id) return;
      const t = pistasPorId(get().tracks).get(id);
      if (!t) {
        set({ singerCheckTrack: null });
        return;
      }
      set((st) => ({
        tracks: st.tracks.map((x) => (x.id === id ? { ...x, singers: nombres } : x)),
        singerCheckTrack: null,
      }));
      backend()
        .setTrackSingers(id, idsDe(nombres))
        .then((snap) => applySnapshot(snap))
        .catch((err) => {
          console.error("set_track_singers failed", err);
          toast("No se pudo guardar quién se la sabe", { tipo: "error" });
          set((st) => ({
            tracks: st.tracks.map((x) => (x.id === id ? { ...x, singers: t.singers } : x)),
          }));
        });
    },

    closeSingerCheck: () => set({ singerCheckTrack: null }),
    setAskSingersAtEnd: (v) => set({ askSingersAtEnd: v }),
  };
}
