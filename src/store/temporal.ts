import { backend } from "../lib/backend";
import { agregarAlFinal, llevarA, moverEn } from "../lib/temporal";
import { modulo } from "./contexto";
import type { Contexto, Get, Set } from "./contexto";
import { pistasParaAgregar } from "./selectores";

// Parte del store (#134). Ver src/store/index.ts.
//
// La lista temporal (#230): lo que va a sonar, armado sobre la marcha sin
// crear una lista de canciones. Las reglas del orden viven en
// `lib/temporal.ts`; aquí, lo que la toca y lo que se dice al tocarla.
//
// Cómo suena: como cualquier otra cola. «Reproducir» la pone a sonar desde la
// primera, y la cola sigue a la lista viva —lo que se añade o se mueve
// mientras suena cuenta para lo que viene— (ver `playQueue`). Al acabarse, se
// para, como todas. Lo que ya sonó se queda donde está: quitarlo solo sería
// perder lo que se cantó, y para repetirlo hay que poder volver a darle.

/** Cómo se llama en la app, en un solo sitio. */
export const NOMBRE_TEMPORAL = "Lista temporal";

export interface TemporalSlice {
  /** Los ids, en el orden en que van a sonar. Se recuerda entre sesiones. */
  temporal: string[];
  /** Ir a la vista de la lista temporal. */
  abrirTemporal: () => void;
  /** Añadir al final, sin repetir. Avisa de cuántas entraron. */
  agregarATemporal: (ids: readonly string[]) => void;
  /** Lo de «Agregar a la lista temporal» del menú: la selección o la pista abierta. */
  agregarElegidasATemporal: () => void;
  quitarDeTemporal: (id: string) => void;
  /** Mover una pista arriba o abajo. La vía del teclado y de los botones. */
  moverEnTemporal: (id: string, delta: number) => void;
  /** Soltar la pista que se arrastra (`modulo.dragId`) sobre `hastaId`. */
  reordenarTemporal: (hastaId: string) => void;
  /** Vaciarla, preguntando antes si había algo. */
  vaciarTemporal: () => void;
  /** Ponerla a sonar desde la primera que tenga archivo. */
  reproducirTemporal: () => void;
  /** Abrir el diálogo que la guarda como lista de canciones. */
  abrirGuardarTemporal: () => void;
  /** Crear una lista de canciones con este nombre y el orden de la temporal. */
  guardarTemporalComoLista: (nombre: string) => void;
}

export function crearTemporal(set: Set, get: Get, ctx: Contexto): TemporalSlice {
  const { toast, applyPlaylists } = ctx;

  /** Las que siguen en la biblioteca: una pista borrada no cuenta ni suena. */
  const vivas = (): string[] => {
    const hay = new Set(get().tracks.map((t) => t.id));
    return get().temporal.filter((id) => hay.has(id));
  };

  const titulo = (id: string) => get().tracks.find((t) => t.id === id)?.titulo ?? "La pista";

  return {
    temporal: [],

    abrirTemporal: () => set({ view: "temporal", rowMenu: null }),

    agregarATemporal: (ids) => {
      if (ids.length === 0) return;
      const { lista, agregadas } = agregarAlFinal(get().temporal, ids);
      set({ rowMenu: null });
      if (agregadas === 0) {
        toast(ids.length === 1 ? `Ya estaba en la ${NOMBRE_TEMPORAL.toLowerCase()}` : `Ya estaban todas en la ${NOMBRE_TEMPORAL.toLowerCase()}`, { tipo: "info" });
        return;
      }
      set({ temporal: lista });
      toast(`Agregadas a la ${NOMBRE_TEMPORAL.toLowerCase()}`, {
        detalle: agregadas === 1 ? "1 pista, al final." : `${agregadas} pistas, al final.`,
      });
    },

    agregarElegidasATemporal: () => {
      get().agregarATemporal(pistasParaAgregar(get()));
      // Como al agregar a una lista: lo que se quería hacer con la selección
      // ya está hecho.
      set({ selection: [], selAnchor: null });
    },

    quitarDeTemporal: (id) => {
      const antes = get().temporal;
      if (!antes.includes(id)) return;
      const nueva = antes.filter((x) => x !== id);
      set({ temporal: nueva, reorderNotice: `«${titulo(id)}» quitada. Quedan ${nueva.length}.` });
    },

    moverEnTemporal: (id, delta) => {
      const nueva = moverEn(get().temporal, id, delta);
      if (!nueva) return;
      set({ temporal: nueva, reorderNotice: `«${titulo(id)}», posición ${nueva.indexOf(id) + 1} de ${nueva.length}` });
    },

    reordenarTemporal: (hastaId) => {
      const desde = modulo.dragId;
      const nueva = desde ? llevarA(get().temporal, desde, hastaId) : null;
      set({ draggingId: null, overId: null, ...(nueva ? { temporal: nueva } : {}) });
      modulo.dragId = null;
    },

    vaciarTemporal: () => {
      const n = get().temporal.length;
      if (n === 0) return;
      get().askConfirm({
        title: `¿Vaciar la ${NOMBRE_TEMPORAL.toLowerCase()}?`,
        message: "Se quitan todas las canciones de la lista temporal.",
        detail: n === 1 ? "Tiene 1 pista." : `Tiene ${n} pistas.`,
        safe: "Las pistas siguen en tu biblioteca, y lo que esté sonando sigue sonando.",
        confirmLabel: "Vaciar",
        onConfirm: () => {
          set({ temporal: [] });
          toast(`${NOMBRE_TEMPORAL} vacía`);
        },
      });
    },

    reproducirTemporal: () => {
      const filas = vivas();
      if (filas.length === 0) return;
      const pistas = new Map(get().tracks.map((t) => [t.id, t]));
      const primera = filas.find((id) => !pistas.get(id)?.missing);
      if (!primera) {
        toast("Ninguna de estas pistas tiene el archivo en el disco", { tipo: "error" });
        return;
      }
      get().play(primera, filas);
      // `play` saca el origen de la vista; desde el botón de la barra lateral
      // o el atajo podría no estar en ella.
      set({ queueOrigen: "temporal" });
    },

    abrirGuardarTemporal: () => {
      if (vivas().length === 0) return;
      set({ dialog: "guardarTemporal" });
    },

    guardarTemporalComoLista: (nombre) => {
      set({ dialog: null });
      const ids = vivas();
      const name = nombre.trim() || "Lista sin título";
      backend()
        .createPlaylist(name)
        .then(async (id) => {
          applyPlaylists(await backend().addTracksToPlaylist(id, ids));
          set({ view: "lista", curPlaylist: id });
          toast("Lista creada", { detalle: ids.length === 1 ? "Con 1 pista de la lista temporal." : `Con ${ids.length} pistas de la lista temporal.` });
        })
        .catch((err) => {
          console.error(err);
          toast("No se pudo guardar como lista", { tipo: "error" });
        });
    },
  };
}
