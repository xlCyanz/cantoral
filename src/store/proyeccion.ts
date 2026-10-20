import type { EstadoProyeccion, MensajeProyeccion, MonitorInfo } from "../lib/api";
import { motivoDeError } from "../lib/formatos";
import { fmt } from "../lib/covers";
import { backend } from "../lib/backend";
import { identidadDe, pantallaPorDefecto, resolverPantalla } from "../lib/pantallas";
import type { IdentidadPantalla } from "../lib/pantallas";
import { closeProjectionCmd, onProjectionReady, onProjectionState, openProjectionCmd, projectionMonitors, setProjectionCmd } from "../lib/api";
import type { Contexto, Get, Set } from "./contexto";
import { cur } from "./selectores";
import { rutaProyectable, salidaDePista, volumenEfectivo } from "../lib/proyeccion";

/** Si ya se dijo en esta sesión que el video se queda en el panel por falta de otra pantalla. */
let avisadoUnaPantalla = false;

// Parte del store (#134). Ver src/store/index.ts.
// La salida al proyector.
//
// Un solo modelo: el reproductor. No hay una cola de proyección aparte ni una
// vista desde la que manejarla. Lo que suena en la barra es lo que manda: si es
// un video, sale por la
// pantalla de proyección; si es un audio, suena en el equipo y el proyector se
// queda en negro. Play, pausa, saltar y pasar de pista se hacen desde la barra,
// siempre.

export interface ProyeccionSlice {
  /** Las pantallas conectadas, leídas al entrar en Configuración o al proyectar. */
  monitores: MonitorInfo[];
  /** Por cuál sale, como índice de `monitores`. Vive en la sesión: el índice
   *  de una pantalla cambia al enchufar o desenchufar una, así que recordarlo
   *  entre arranques apuntaría a la de al lado. Lo que se recuerda es
   *  `pantallaProyeccion`, y de ella sale este cada vez que se miran. */
  monitorSalida: number;
  /**
   * La pantalla de proyección que eligió quien opera en Configuración. Se
   * recuerda entre arranques por lo que la describe (`lib/pantallas.ts`).
   * Mientras sea `null`, o no esté conectada, vale la de por defecto: la
   * primera que no es la del operador.
   */
  pantallaProyeccion: IdentidadPantalla | null;
  /**
   * Si poner un video a sonar lo saca por la pantalla de proyección. Siempre
   * sí: ya no hay ajuste para apagarlo, porque en la iglesia todo video va al
   * proyector. Queda como campo para que las pruebas del video en el panel
   * puedan simular que no se proyecta.
   */
  proyectarVideos: boolean;
  /**
   * El video del reproductor que ocupa la salida, o `null`.
   *
   * Cuando no es `null`, es la salida —no el panel de detalle— la que lo
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
  /** Si la ventana de salida está abierta. */
  proyectando: boolean;
  cargarMonitores: () => Promise<void>;
  elegirMonitor: (indice: number) => void;
  /** Cerrar la salida. Desde el botón de la barra. */
  cerrarProyeccion: () => void;
  proyectar: (mensaje: MensajeProyeccion) => void;
  /**
   * Llevar la salida al día con el reproductor: un video que suena sale por
   * el proyector, y lo que no es video la deja en negro. La llama una
   * suscripción del store cada vez que cambia la pista o el play.
   */
  sincronizarVideo: () => void;
  /** Sacar por la salida el video `id` del reproductor, abriéndola si hace falta. */
  proyectarPista: (id: string) => Promise<void>;
  /**
   * Mandar a la salida el volumen de la barra. La llama una suscripción del
   * store cada vez que cambian el volumen o el silencio: el video que suena
   * en el proyector suena a lo que diga la barra, como cualquier otra pista.
   */
  enviarVolumen: () => void;
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
    proyectando: false,

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
        // ventana.
        monitorSalida:
          resolverPantalla(lista, st.pantallaProyeccion) ??
          (st.proyectando && lista.some((m) => m.indice === st.monitorSalida) ? st.monitorSalida : pantallaPorDefecto(lista)),
      }));
    },

    elegirMonitor: (indice) => {
      const m = get().monitores.find((x) => x.indice === indice);
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
      // Un video que salía por el proyector se para: sin la salida no tiene
      // dónde sonar, y seguir diciendo «reproduciendo» en la barra sería
      // mentir. Un audio sigue sonando en el equipo, que es donde estaba.
      set({
        proyectando: false,
        proyeccionPista: null,
        ...(st.proyeccionPista && st.playing ? { playing: false } : {}),
      });
      // Worth saying out loud: a window that failed to close is still on the
      // projector, in front of everyone, while the app says it is off.
      void closeProjectionCmd().catch((err) => {
        console.error("close_projection failed", err);
        toast("No se pudo cerrar la proyección", { tipo: "error", detalle: String(err) });
      });
    },

    proyectar: (mensaje) => {
      if (!get().proyectando) return;
      void setProjectionCmd(mensaje).catch((err) => console.error("set_projection failed", err));
    },


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
          get().proyectar(salidaDePista(t, s.playing, volumenEfectivo(s)));
          return;
        }
        // Lo que viene no es un video para el proyector —un audio, que suena
        // en el equipo—. La salida se queda abierta y en negro: cerrarla y
        // volver a abrirla en el video de después enseñaría el escritorio por
        // el proyector cada vez.
        set({ proyeccionPista: null });
        get().proyectar({ vista: { modo: "negro" } });
        return;
      }

      if (t && proyectable && s.playing && s.videoEnPanel !== t.id) {
        void get().proyectarPista(t.id);
      }
    },

    proyectarPista: async (id) => {
      if (get().proyectando) {
        // Ya está abierta —en negro por un audio, u otro video—: el video la
        // ocupa ya, sin volver a abrirla.
        set({ proyeccionPista: id });
        const t = cur(get());
        if (t) get().proyectar(salidaDePista(t, get().playing, volumenEfectivo(get())));
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
      set({ proyectando: true });
      const t = cur(get());
      if (get().proyeccionPista && t) get().proyectar(salidaDePista(t, get().playing, volumenEfectivo(get())));
      else get().proyectar({ vista: { modo: "negro" } });
    },

    enviarVolumen: () => {
      // Solo con un video en la salida: con ella en negro no suena nada, y el
      // volumen viaja igual con el próximo video que se proyecte.
      if (!get().proyeccionPista) return;
      get().proyectar({ orden: "volumen", valor: volumenEfectivo(get()) });
    },

    escucharProyeccion: async () => {
      // La salida acaba de engancharse: se le manda lo que debería estar
      // viendo. Sin esto, lo primero se pierde en el arranque. `proyectar` ya
      // no manda nada con la salida cortada, así que un aviso que llegue
      // tarde no hace falta filtrarlo aquí también.
      const soltarLista = await onProjectionReady(() => {
        const st = get();
        const t = cur(st);
        if (st.proyeccionPista && t) get().proyectar(salidaDePista(t, st.playing, volumenEfectivo(st)));
        else get().proyectar({ vista: { modo: "negro" } });
      });
      const soltarEstado = await onProjectionState(estadoDelVideo);
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
          // Se acabó: lo de después de la cola, como si sonara en el equipo.
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
        // La duración real del archivo manda sobre la de las etiquetas: es
        // la que llena la barra.
        const durNueva = e.dur > 0 && e.dur !== t.durSec;
        // El mismo segundo no se vuelve a escribir: cualquier escritura
        // despierta a todos los suscriptores del store.
        if (!durNueva && st.posSec === e.pos) return;
        set((prev) => ({
          posSec: e.pos,
          ...(durNueva
            ? { tracks: prev.tracks.map((x) => (x.id === t.id ? { ...x, durSec: e.dur, dur: fmt(e.dur) } : x)) }
            : {}),
        }));
      }
    },
  };
}
