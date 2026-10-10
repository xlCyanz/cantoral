import type { AvanceProyeccion, SalidaDeAudio, TransicionProyeccion } from "../lib/types";
import type { EstadoProyeccion, MensajeProyeccion, MonitorInfo } from "../lib/api";
import { motivoDeError } from "../lib/formatos";
import { fmt } from "../lib/covers";
import { backend } from "../lib/backend";
import { identidadDe, pantallaPorDefecto, resolverPantalla } from "../lib/pantallas";
import type { IdentidadPantalla } from "../lib/pantallas";
import { closeProjectionCmd, onProjectionReady, onProjectionState, openProjectionCmd, projectionMonitors, setProjectionCmd } from "../lib/api";
import type { Contexto, Get, Set } from "./contexto";
import { cur, elementosDeLista } from "./selectores";
import {
  estrofasEnPantalla,
  filasProyectadas,
  pistaEnElAire,
  precargaDe,
  rutaDeElemento,
  rutaProyectable,
  salidaDePista,
  salidaDelCulto,
} from "../lib/proyeccion";

/** Si ya se dijo en esta sesión que el video se queda en el panel por falta de otra pantalla. */
let avisadoUnaPantalla = false;

// Parte del store (#134). Ver src/store/index.ts.
// La salida al proyector.

export interface ProyeccionSlice {
  /** Las pantallas conectadas, leídas al entrar en Proyección. */
  monitores: MonitorInfo[];
  /** Por cuál sale, como índice de `monitores`. Vive en la sesión: el índice
   *  de una pantalla cambia al enchufar o desenchufar una, así que recordarlo
   *  entre arranques apuntaría a la de al lado. Lo que se recuerda es
   *  `pantallaProyeccion`, y de ella sale este cada vez que se miran. */
  monitorSalida: number;
  /**
   * La pantalla de proyección que eligió quien opera, en Proyección o en
   * Configuración —es el mismo ajuste—. Se recuerda entre arranques por lo
   * que la describe (`lib/pantallas.ts`). Mientras sea `null`, o no esté
   * conectada, vale la de por defecto: la primera que no es la del operador.
   */
  pantallaProyeccion: IdentidadPantalla | null;
  /**
   * Si poner un video a sonar lo saca por la pantalla de proyección. Se
   * recuerda. Activado de fábrica: es lo que se pidió, ver un video sin tener
   * que armar un culto para proyectarlo.
   */
  proyectarVideos: boolean;
  /**
   * El video del reproductor que ocupa la salida, o `null`.
   *
   * Cuando no es `null`, la salida no enseña el culto: enseña la pista que
   * suena en la barra, y es ella —no el panel de detalle— la que la
   * reproduce. Se apunta antes de abrir la ventana, para que el panel no
   * arranque el mismo video mientras se abre: dos sonidos a la vez es justo
   * lo que hay que evitar.
   */
  proyeccionPista: string | null;
  /**
   * El video que, por no haber otra pantalla, se quedó en el panel. Para no
   * volver a intentarlo —y cortarlo— en cada pausa: se olvida al pasar a otra
   * pista.
   */
  videoEnPanel: string | null;
  /** Si la pista del culto en el aire está en pausa, desde la barra. */
  proyeccionPausada: boolean;
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
   * Por defecto, «siguiente»: un culto se prepara para correr entero sin
   * nadie al ratón. Quien prefiere que cada elemento acabe en negro —porque
   * entre canción y canción alguien habla— lo cambia una vez y se olvida.
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
  /** Cerrar la salida, sea un culto o un video. */
  cerrarProyeccion: () => void;
  proyectar: (mensaje: MensajeProyeccion) => void;
  setProyectarVideos: (v: boolean) => void;
  /**
   * Llevar la salida al día con el reproductor: un video que suena sale por
   * el proyector, y lo que no es video la deja en negro. La llama una
   * suscripción del store cada vez que cambia la pista o el play.
   */
  sincronizarVideo: () => void;
  /** Sacar por la salida el video `id` del reproductor, abriéndola si hace falta. */
  proyectarPista: (id: string) => Promise<void>;
  /** Pausar o seguir la pista del culto en el aire. */
  alternarPausaProyeccion: () => void;
  /** Saltar a una fracción de la pista del culto en el aire. */
  buscarEnProyeccion: (f: number) => void;
  /** Volver al principio de lo que suena o, si acaba de empezar, al anterior del culto. */
  proyeccionAnterior: () => void;
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
    pantallaProyeccion: null,
    proyectarVideos: true,
    proyeccionPista: null,
    videoEnPanel: null,
    proyeccionPausada: false,
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
        // La que eligió quien opera, si está conectada: se busca por lo que la
        // describe, no por el índice, que pudo cambiar desde que se eligió.
        //
        // Si no, la que ya está en uso mientras siga ahí —enchufar un teclado
        // no puede mover la salida a mitad de un culto—, y si tampoco, la de
        // por defecto: la primera pantalla que no sea en la que está la
        // ventana. Si solo hay una, se queda esa y quien opera verá la salida
        // encima — que es lo que pasa cuando se prepara sin el proyector.
        monitorSalida:
          resolverPantalla(lista, st.pantallaProyeccion) ??
          (st.proyectando && lista.some((m) => m.indice === st.monitorSalida) ? st.monitorSalida : pantallaPorDefecto(lista)),
      }));
    },

    elegirMonitor: (indice) => {
      const m = get().monitores.find((x) => x.indice === indice);
      // Elegirla aquí o en Configuración es lo mismo, y se recuerda.
      set({ monitorSalida: indice, ...(m ? { pantallaProyeccion: identidadDe(m) } : {}) });
      // En marcha, elegir otra pantalla la mueve. El núcleo la cierra y la
      // abre allí —mover una pantalla completa de un monitor a otro no es
      // fiable en macOS—, y la ventana nueva, al avisar que está lista, recibe
      // lo que se estaba proyectando.
      if (get().proyectando) {
        void openProjectionCmd(indice).catch((err) => {
          console.error("open_projection failed", err);
          toast("No se pudo mover la proyección a esa pantalla", { tipo: "error" });
        });
      }
    },

    cerrarProyeccion: () => {
      const st = get();
      // Cortar deja la cola donde estaba. Quien corta suele cortar para
      // arreglar algo —el proyector, el cable, un archivo— y volver al
      // mismo sitio, no para empezar el culto otra vez.
      //
      // Un video del reproductor, en cambio, se para: sin la salida no tiene
      // dónde sonar, y seguir diciendo «reproduciendo» en la barra sería
      // mentir.
      set({
        proyectando: false,
        proyeccionPos: 0,
        proyeccionDur: 0,
        proyeccionPista: null,
        proyeccionPausada: false,
        ...(st.proyeccionPista && st.playing ? { playing: false } : {}),
      });
      // Worth saying out loud: a window that failed to close is still on the
      // projector, in front of everyone, while the app says it is off.
      void closeProjectionCmd().catch((err) => {
        console.error("close_projection failed", err);
        toast("No se pudo cerrar la proyección", { tipo: "error", detalle: String(err) });
      });
    },

    alternarProyeccion: () => {
      if (get().proyectando) {
        get().cerrarProyeccion();
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

    proyectar: (mensaje) => {
      if (!get().proyectando) return;
      void setProjectionCmd(mensaje).catch((err) => console.error("set_projection failed", err));
    },

    setProyectarVideos: (v) => set({ proyectarVideos: v }),

    sincronizarVideo: () => {
      const s = get();
      const t = cur(s);
      if (s.videoEnPanel && s.videoEnPanel !== s.playerId) set({ videoEnPanel: null });
      const proyectable = !!t?.video && s.proyectarVideos && backend().reproduceArchivos && !!rutaProyectable(t);

      if (s.proyeccionPista) {
        if (t && proyectable) {
          // Otro video de la cola, o el mismo en pausa o reanudado: la salida
          // sigue abierta y enseña lo que diga la barra.
          if (t.id !== s.proyeccionPista) set({ proyeccionPista: t.id });
          get().proyectar(salidaDePista(t, s.playing));
          return;
        }
        // Lo que viene no es un video para el proyector —un audio, que suena
        // en el portátil—. La salida se queda abierta y en negro: cerrarla y
        // volver a abrirla en el video de después enseñaría el escritorio por
        // el proyector cada vez.
        set({ proyeccionPista: null });
        get().proyectar({ vista: { modo: "negro" } });
        return;
      }

      if (t && proyectable && s.playing && s.videoEnPanel !== t.id) {
        void get().proyectarPista(t.id);
        return;
      }

      // Algo empieza a sonar en el portátil con una pista del culto sonando
      // por la salida: se pausa la del culto. Una sola cosa por los altavoces.
      if (s.playing && pistaEnElAire(s) && !s.proyeccionPausada) {
        set({ proyeccionPausada: true });
        get().proyectar(salidaDelCulto(get(), s.proyeccionIdx, false));
      }
    },

    proyectarPista: async (id) => {
      if (get().proyectando) {
        // Ya está abierta —un culto, u otro video—: el video la ocupa ya. El
        // culto no se pierde: su sitio sigue apuntado, en negro.
        set({ proyeccionPista: id, proyeccionEnNegro: true, proyeccionPausada: false, proyeccionPos: 0, proyeccionDur: 0 });
        const t = cur(get());
        if (t) get().proyectar(salidaDePista(t, get().playing));
        return;
      }
      // Se apunta ya, antes de saber si hay dónde: el panel de detalle mira
      // esto para no arrancar el mismo video mientras se abre la salida.
      set({ proyeccionPista: id });
      await get().cargarMonitores();
      if (!get().proyeccionPista) return; // se pasó a otra cosa mientras tanto

      const st = get();
      const m = st.monitores.find((x) => x.indice === st.monitorSalida);
      if (!m || m.principal) {
        // Sin otra pantalla, el video se queda en el panel, como siempre. La
        // salida a pantalla completa taparía la única que hay, sin cursor y
        // sin controles, y quien opera no tendría cómo volver.
        set({ proyeccionPista: null, videoEnPanel: st.playerId });
        if (!avisadoUnaPantalla) {
          avisadoUnaPantalla = true;
          toast("El video se ve en el panel", {
            detalle: "No hay otra pantalla para proyectarlo. Conecta el proyector y vuelve a darle al play.",
          });
        }
        return;
      }
      if (st.pantallaProyeccion && resolverPantalla(st.monitores, st.pantallaProyeccion) === null) {
        toast(`La pantalla de proyección elegida no está conectada: sale por ${m.nombre}`);
      }

      try {
        await openProjectionCmd(m.indice);
      } catch (err) {
        console.error("open_projection failed", err);
        toast("No se pudo abrir la proyección", { tipo: "error", detalle: "El video se ve en el panel." });
        set({ proyeccionPista: null, videoEnPanel: get().playerId });
        return;
      }
      // Abierta queda aunque mientras tanto se haya pasado a un audio: en
      // negro, lista para el próximo video y sin parpadeos.
      set({ proyectando: true, proyeccionEnNegro: true, proyeccionPausada: false, proyeccionPos: 0, proyeccionDur: 0 });
      const t = cur(get());
      if (get().proyeccionPista && t) get().proyectar(salidaDePista(t, get().playing));
      else get().proyectar({ vista: { modo: "negro" } });
    },

    alternarPausaProyeccion: () => {
      const st = get();
      if (!pistaEnElAire(st)) return;
      const pausada = !st.proyeccionPausada;
      set({ proyeccionPausada: pausada, ...(pausada ? {} : { playing: false }) });
      get().proyectar(salidaDelCulto(get(), st.proyeccionIdx, !pausada));
    },

    buscarEnProyeccion: (f) => {
      const st = get();
      const t = pistaEnElAire(st);
      if (!t) return;
      const dur = st.proyeccionDur || t.durSec;
      const pos = Math.round(Math.min(1, Math.max(0, f)) * dur);
      set({ proyeccionPos: pos });
      get().proyectar({ orden: "buscar", src: rutaProyectable(t), pos });
    },

    proyeccionAnterior: () => {
      const st = get();
      const anterior = st.proyeccionIdx - 1;
      // Como en cualquier reproductor: pasados unos segundos, «Anterior»
      // vuelve al principio de lo que suena; al principio, al de antes.
      if (st.proyeccionPos > 3 || anterior < 0) {
        get().buscarEnProyeccion(0);
        return;
      }
      set({ proyeccionIdx: anterior, proyeccionEnNegro: false, proyeccionPausada: false, proyeccionPos: 0, proyeccionDur: 0 });
      get().proyectar({ ...salidaDelCulto(get(), anterior, true), transicion: get().transicionProyeccion });
    },

    proyectarElemento: (idx) => {
      // Se proyecta desde la lista abierta, y a partir de aquí esa pasa a ser
      // la que está en el aire.
      if (idx < 0 || idx >= elementosDeLista(get()).length) return;
      // Y se calla lo que estuviera sonando en el portátil. Hay una sola salida
      // de audio: dos cosas a la vez por los altavoces del culto no es algo que
      // nadie quiera, y ahora que el video suena dentro de la app es fácil
      // acabar ahí sin darse cuenta.
      //
      // Y si la salida la ocupaba un video del reproductor, deja de ocuparla.
      const veniaDeOtro = get().proyeccionIdx !== idx || get().proyeccionEnNegro;
      set({
        playing: false,
        proyeccionPista: null,
        proyeccionPausada: false,
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
      set({
        proyeccionIdx: siguiente,
        proyeccionEnNegro: false,
        proyeccionEstrofa: 0,
        proyeccionPos: 0,
        proyeccionDur: 0,
        proyeccionPausada: false,
        // Pasar al siguiente del culto con un video del reproductor en la
        // salida es volver al culto: el video se para.
        ...(st.proyeccionPista ? { proyeccionPista: null, playing: false } : {}),
      });
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
      if (!st.proyectando || st.proyeccionPista || st.proyeccionEnNegro || st.proyeccionIdx < 0) return;
      get().proyectar(salidaDelCulto(st, st.proyeccionIdx, !st.proyeccionPausada));
    },

    proyeccionNegro: () => {
      const st = get();
      set({
        proyeccionEnNegro: true,
        proyeccionPos: 0,
        proyeccionDur: 0,
        proyeccionPausada: false,
        // Un video del reproductor en negro no se sigue oyendo.
        ...(st.proyeccionPista ? { proyeccionPista: null, playing: false } : {}),
      });
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
        const t = cur(st);
        if (st.proyeccionPista && t) {
          get().proyectar(salidaDePista(t, st.playing));
          return;
        }
        // En negro se queda en negro: la ventana se recrea al cambiarla de
        // pantalla, y no puede volver enseñando lo que se había quitado.
        get().proyectar(
          st.proyeccionIdx >= 0 && !st.proyeccionEnNegro && filasProyectadas(st).length > st.proyeccionIdx
            ? salidaDelCulto(st, st.proyeccionIdx, !st.proyeccionPausada)
            : { vista: { modo: "negro" }, precarga: st.proyeccionIdx >= 0 ? precargaDe(st, st.proyeccionIdx) : undefined },
        );
      });
      const soltarEstado = await onProjectionState((e) => {
        const st = get();
        if (st.proyeccionPista) {
          estadoDelVideo(e);
          return;
        }
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

      /** Lo que devuelve la salida mientras enseña un video del reproductor. */
      function estadoDelVideo(e: EstadoProyeccion) {
        const st = get();
        const t = st.tracks.find((x) => x.id === st.proyeccionPista);
        if (!t || !st.proyectando || rutaProyectable(t) !== e.src) return;
        if (e.fin) {
          // Se acabó: lo de después de la cola, como si sonara en el portátil.
          // Si es el mismo —«Repetir», o una cola de uno— la salida ya está
          // al final y hay que rebobinarla a mano.
          get().advance();
          const ahora = get();
          if (ahora.proyeccionPista === t.id && ahora.playerId === t.id && ahora.playing) {
            set({ posSec: 0 });
            get().proyectar({ orden: "buscar", src: e.src, pos: 0 });
          }
          return;
        }
        if (e.error !== undefined) {
          toast(motivoDeError(e.error, t.path), { detalle: `«${t.titulo}» no llega al proyector.`, tipo: "error" });
          set({ playing: false });
          return;
        }
        set((prev) => ({
          posSec: e.pos,
          // La duración real del archivo manda sobre la de las etiquetas: es
          // la que llena la barra.
          ...(e.dur > 0 && e.dur !== t.durSec
            ? { tracks: prev.tracks.map((x) => (x.id === t.id ? { ...x, durSec: e.dur, dur: fmt(e.dur) } : x)) }
            : {}),
        }));
      }
    },
  };
}
