import type { AvanceProyeccion, SalidaDeAudio, TransicionProyeccion } from "../lib/types";
import type { MonitorInfo, SalidaProyeccion } from "../lib/api";
import { motivoDeError } from "../lib/formatos";
import { closeProjectionCmd, onProjectionReady, onProjectionState, openProjectionCmd, projectionMonitors, setProjectionCmd } from "../lib/api";
import type { Contexto, Get, Set } from "./contexto";
import { elementosDeLista } from "./selectores";
import { estrofasEnPantalla, filasProyectadas, precargaDe, rutaDeElemento, salidaDelCulto } from "../lib/proyeccion";

// Parte del store (#134). Ver src/store/index.ts.
// La salida al proyector.

export interface ProyeccionSlice {
  /** Las pantallas conectadas, leídas al entrar en Proyección. */
  monitores: MonitorInfo[];
  /** Por cuál sale. Vive en la sesión: el índice de una pantalla cambia al
   *  enchufar o desenchufar una, así que recordarlo entre arranques apuntaría
   *  a la de al lado. */
  monitorSalida: number;
  /** Si la ventana de salida está abierta. */
  proyectando: boolean;
  /**
   * Qué elemento del culto está en pantalla. `-1` es nada: el proyector en
   * negro con la salida abierta, que es como empieza y como se queda entre una
   * cosa y otra.
   *
   * Un índice en el orden del culto y no un id de pista: la cola es la lista
   * abierta en su orden, y la misma pista puede estar dos veces en un culto
   * —una canción que se repite al final— sin que sean el mismo momento.
   */
  proyeccionIdx: number;
  /**
   * De qué lista es ese índice.
   *
   * No es siempre la lista abierta. En pleno culto se abre otra para buscar
   * algo, y si «Siguiente» avanzara por la que se está mirando sacaría por el
   * proyector una pista de una lista que nadie pidió. Lo que está en el aire
   * sigue siendo de la lista con la que se empezó hasta que se proyecte otra
   * cosa a propósito.
   */
  proyeccionLista: string;
  /**
   * Si el proyector está en negro aunque haya un elemento apuntado.
   *
   * Dos cosas distintas: «no hay nada elegido» es `proyeccionIdx === -1`, y
   * «hay algo elegido pero no se está viendo» es esto. Pasa al cortar la
   * imagen a mano y al terminarse un elemento, y en los dos casos lo elegido
   * sigue ahí para volver.
   */
  proyeccionEnNegro: boolean;
  /**
   * En qué estrofa de la letra va lo que está en pantalla.
   *
   * Solo cuenta con una pista de audio proyectada como letra. `0` es la
   * primera; una pista sin letra tiene cero estrofas y se queda en `0`.
   */
  proyeccionEstrofa: number;
  /** Qué sale por el proyector con una pista de solo audio. Se recuerda. */
  salidaDeAudio: SalidaDeAudio;
  /** Qué pasa entre un elemento del culto y el siguiente. Se recuerda. */
  transicionProyeccion: TransicionProyeccion;
  /**
   * Qué hace la proyección cuando un elemento se termina. Se recuerda.
   *
   * Por defecto, negro: en un culto el video se acaba mientras alguien está
   * hablando, y arrancar la canción de después por su cuenta delante de la
   * congregación no es algo que la app deba decidir sin que se lo pidan. Quien
   * proyecta un culto seguido —una lista entera de principio a fin— lo pone en
   * «siguiente» una vez y se olvida.
   */
  avanceProyeccion: AvanceProyeccion;
  /** Por dónde va lo que se está proyectando, en segundos. Lo dice la salida. */
  proyeccionPos: number;
  proyeccionDur: number;
  /**
   * Lo último que falló al proyectar, por `src`.
   *
   * Por id de pista y no un solo mensaje porque lo que interesa es *qué
   * elemento* de la cola no se puede proyectar: marcarlo en su fila se ve antes
   * de empezar el culto, y un aviso suelto se pierde.
   *
   * Sólo se apunta lo que falla estando en pantalla. Lo que falle mientras se
   * precarga se calla hasta que le toque, porque el elemento que precarga no
   * informa: si lo hiciera, un archivo roto al final del culto escribiría un
   * aviso rojo en la cola mientras suena tranquilamente el primero.
   */
  proyeccionFallos: Record<string, string>;
  showProyeccion: () => void;
  cargarMonitores: () => Promise<void>;
  elegirMonitor: (indice: number) => void;
  alternarProyeccion: () => void;
  proyectar: (salida: SalidaProyeccion) => void;
  /** Poner en pantalla el elemento `idx` del culto abierto. */
  proyectarElemento: (idx: number) => void;
  /** Pasar al siguiente del culto. */
  proyeccionSiguiente: () => void;
  /** Dejar el proyector en negro sin perder por dónde iba el culto. */
  proyeccionNegro: () => void;
  setSalidaDeAudio: (v: SalidaDeAudio) => void;
  setTransicionProyeccion: (v: TransicionProyeccion) => void;
  setAvanceProyeccion: (v: AvanceProyeccion) => void;
  /** Volver a mandar a la salida lo que ya está en pantalla. */
  reproyectar: () => void;
  /** Empezar a escuchar lo que devuelve la salida. Devuelve cómo dejar de hacerlo. */
  escucharProyeccion: () => Promise<() => void>;
}

export function crearProyeccion(set: Set, get: Get, ctx: Contexto): ProyeccionSlice {
  const { toast } = ctx;
  return {
    monitores: [],
    monitorSalida: 0,
    proyectando: false,
    proyeccionIdx: -1,
    proyeccionLista: "",
    proyeccionEnNegro: true,
    proyeccionEstrofa: 0,
    salidaDeAudio: "letra",
    transicionProyeccion: "negro",
    // Un culto es una lista preparada para darle y que corra entera: pasar
    // solo al siguiente es lo que se espera, y el negro entre elementos, la
    // excepción que se elige.
    avanceProyeccion: "siguiente",
    proyeccionPos: 0,
    proyeccionDur: 0,
    proyeccionFallos: {},

    showProyeccion: () => {
      // Se proyecta el culto que está abierto, que es el que quien opera acaba
      // de repasar. No hay otro que pudiera querer decir.
      set({ view: "proyeccion" });
      void get().cargarMonitores();
    },

    cargarMonitores: async () => {
      const lista = await projectionMonitors().catch((err) => {
        console.error("projection_monitors failed", err);
        return [] as MonitorInfo[];
      });
      set((st) => ({
        monitores: lista,
        // Por defecto, la primera pantalla que no sea en la que está la
        // ventana: en un culto el proyector es siempre la otra. Si solo hay
        // una, se queda esa y quien opera verá la salida encima — que es lo
        // que pasa cuando se prepara sin el proyector conectado.
        monitorSalida:
          lista.some((m) => m.indice === st.monitorSalida) && st.proyectando
            ? st.monitorSalida
            : (lista.find((m) => !m.principal) ?? lista[0])?.indice ?? 0,
      }));
    },

    elegirMonitor: (indice) => {
      set({ monitorSalida: indice });
      // En marcha, elegir otra pantalla la mueve: pedir que se cierre y se
      // vuelva a abrir sería un parpadeo delante de la congregación.
      if (get().proyectando) {
        void openProjectionCmd(indice).catch((err) => {
          console.error("open_projection failed", err);
          toast("No se pudo mover la proyección a esa pantalla", { tipo: "error" });
        });
      }
    },

    alternarProyeccion: () => {
      if (get().proyectando) {
        // Cortar deja la cola donde estaba. Quien corta suele cortar para
        // arreglar algo —el proyector, el cable, un archivo— y volver al
        // mismo sitio, no para empezar el culto otra vez.
        set({ proyectando: false, proyeccionPos: 0, proyeccionDur: 0 });
        // Worth saying out loud: a window that failed to close is still on the
        // projector, in front of everyone, while the app says it is off.
        void closeProjectionCmd().catch((err) => {
          console.error("close_projection failed", err);
          toast("No se pudo cerrar la proyección", { tipo: "error", detalle: String(err) });
        });
        return;
      }
      void openProjectionCmd(get().monitorSalida)
        .then(() => {
          set({ proyectando: true });
          // Salir al aire es salir con algo. Con un culto a medias vuelve a
          // donde estaba —y a la lista en la que estaba—; si no, empieza por
          // el principio del que esté abierto.
          const st = get();
          if (st.proyeccionIdx >= 0 && filasProyectadas(st).length > st.proyeccionIdx) {
            set({ proyeccionEnNegro: false, proyeccionPos: 0, proyeccionDur: 0 });
            get().proyectar(salidaDelCulto(get(), st.proyeccionIdx, true));
          } else if (elementosDeLista(st).length > 0) {
            get().proyectarElemento(0);
          } else {
            get().proyeccionNegro();
          }
        })
        .catch((err) => {
          console.error("open_projection failed", err);
          toast("No se pudo abrir la proyección", { tipo: "error" });
        });
    },

    proyectar: (salida) => {
      if (!get().proyectando) return;
      void setProjectionCmd(salida).catch((err) => console.error("set_projection failed", err));
    },

    proyectarElemento: (idx) => {
      // Se proyecta desde la lista abierta, y a partir de aquí esa pasa a ser
      // la que está en el aire.
      if (idx < 0 || idx >= elementosDeLista(get()).length) return;
      // Y se calla lo que estuviera sonando en el portátil. Hay una sola salida
      // de audio: dos cosas a la vez por los altavoces del culto no es algo que
      // nadie quiera, y ahora que el video suena dentro de la app es fácil
      // acabar ahí sin darse cuenta.
      if (get().playing) set({ playing: false });
      const veniaDeOtro = get().proyeccionIdx !== idx || get().proyeccionEnNegro;
      set({
        proyeccionIdx: idx,
        proyeccionLista: get().curPlaylist,
        proyeccionEnNegro: false,
        proyeccionEstrofa: 0,
        proyeccionPos: 0,
        proyeccionDur: 0,
      });
      get().proyectar({
        ...salidaDelCulto(get(), idx, true),
        // Volver a poner lo mismo que ya estaba —pulsar su fila otra vez— no
        // lleva transición: sería medio segundo de negro sin motivo.
        ...(veniaDeOtro ? { transicion: get().transicionProyeccion } : {}),
      });
    },

    proyeccionSiguiente: () => {
      const st = get();
      // Primero la letra, después la cola. «Siguiente» es un solo botón y una
      // sola tecla porque desde el atril no se quiere elegir entre dos: se
      // quiere pasar a lo que viene, sea la estrofa de abajo o la canción de
      // después.
      const trozos = estrofasEnPantalla(st);
      if (!st.proyeccionEnNegro && st.proyeccionEstrofa + 1 < trozos.length) {
        set({ proyeccionEstrofa: st.proyeccionEstrofa + 1 });
        get().proyectar(salidaDelCulto(get(), st.proyeccionIdx, true));
        return;
      }
      const filas = filasProyectadas(st);
      const siguiente = st.proyeccionIdx + 1;
      if (siguiente >= filas.length) {
        // Se acabó el culto. Negro y no volver al principio: nadie quiere que
        // la última canción arranque otra vez sola delante de todos.
        get().proyeccionNegro();
        return;
      }
      set({ proyeccionIdx: siguiente, proyeccionEnNegro: false, proyeccionEstrofa: 0, proyeccionPos: 0, proyeccionDur: 0 });
      get().proyectar({ ...salidaDelCulto(get(), siguiente, true), transicion: get().transicionProyeccion });
    },

    setSalidaDeAudio: (v) => {
      set({ salidaDeAudio: v });
      // En marcha, el cambio se ve al momento: quien lo está tocando lo toca
      // para ver el efecto, no para que se aplique en la siguiente canción.
      get().reproyectar();
    },

    setTransicionProyeccion: (v) => set({ transicionProyeccion: v }),

    setAvanceProyeccion: (v) => set({ avanceProyeccion: v }),

    /** Volver a mandar lo que ya está en pantalla, con lo que haya cambiado. */
    reproyectar: () => {
      const st = get();
      if (!st.proyectando || st.proyeccionEnNegro || st.proyeccionIdx < 0) return;
      get().proyectar(salidaDelCulto(st, st.proyeccionIdx, true));
    },

    proyeccionNegro: () => {
      set({ proyeccionEnNegro: true, proyeccionPos: 0, proyeccionDur: 0 });
      // El negro se lleva la precarga del siguiente: volver del negro tiene
      // que ser inmediato, y lo que venga después ya está cargado.
      get().proyectar({ vista: { modo: "negro" }, precarga: precargaDe(get(), get().proyeccionIdx) });
    },

    escucharProyeccion: async () => {
      // La salida acaba de engancharse: se le manda lo que debería estar
      // viendo. Sin esto, lo primero del culto se pierde en el arranque.
      // `proyectar` ya no manda nada con la salida cortada, así que un aviso
      // que llegue tarde no hace falta filtrarlo aquí también.
      const soltarLista = await onProjectionReady(() => {
        const st = get();
        get().proyectar(
          st.proyeccionIdx >= 0 && filasProyectadas(st).length > st.proyeccionIdx
            ? salidaDelCulto(st, st.proyeccionIdx, true)
            : { vista: { modo: "negro" } },
        );
      });
      const soltarEstado = await onProjectionState((e) => {
        const st = get();
        const actual = filasProyectadas(st)[st.proyeccionIdx];
        // Lo que llega de un archivo que ya no está en pantalla es de antes de
        // pasar de elemento y se descarta: escribirlo pondría el tiempo de la
        // canción anterior debajo de la que acaba de empezar.
        // Un momento sin música no tiene archivo, así que nada de lo que llegue
        // es suyo: tampoco un `fin` rezagado de la canción de antes, que lo
        // haría avanzar solo en mitad de la oración (#145).
        if (actual?.clase !== "pista" || !st.proyectando || rutaDeElemento(actual) !== e.src) return;
        const pista = actual.pista;
        if (e.fin) {
          // Se acabó lo que había en pantalla.
          //
          // Con «Pasar al siguiente» puesto, la proyección sigue sola: es lo
          // que quiere quien proyecta un culto de principio a fin sin que nadie
          // esté al ratón. Con el ajuste por defecto se queda en negro, porque
          // un video se termina mientras alguien está hablando y arrancar la
          // canción de después por su cuenta delante de la congregación no lo
          // puede decidir la app sin que se lo hayan pedido.
          //
          // Al final del culto no avanza en ninguno de los dos casos: no hay
          // adónde, y `proyeccionSiguiente` deja el negro.
          if (st.avanceProyeccion === "siguiente") {
            set({ proyeccionPos: e.dur || get().proyeccionDur });
            get().proyeccionSiguiente();
            return;
          }
          set({ proyeccionEnNegro: true, proyeccionPos: e.dur || get().proyeccionDur });
          get().proyectar({ vista: { modo: "negro" }, precarga: precargaDe(get(), get().proyeccionIdx) });
          return;
        }
        if (e.error !== undefined) {
          const motivo = motivoDeError(e.error, pista.path);
          set((prev) => ({ proyeccionFallos: { ...prev.proyeccionFallos, [pista.id]: motivo } }));
          toast(motivo, { detalle: `«${pista.titulo}» no llega al proyector.`, tipo: "error" });
          return;
        }
        set((prev) => {
          // Un archivo que va se quita de la lista de fallos: pasa al
          // reapuntarlo o al convertirlo sin cerrar la app.
          const fallos = prev.proyeccionFallos[pista.id]
            ? Object.fromEntries(Object.entries(prev.proyeccionFallos).filter(([k]) => k !== pista.id))
            : prev.proyeccionFallos;
          return { proyeccionPos: e.pos, proyeccionDur: e.dur || prev.proyeccionDur, proyeccionFallos: fallos };
        });
      });
      return () => {
        soltarLista();
        soltarEstado();
      };
    },
  };
}
