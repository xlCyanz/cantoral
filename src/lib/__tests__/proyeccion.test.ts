// Elegir por qué pantalla sale la proyección es la decisión que más caro sale
// equivocar: si por defecto apunta a la pantalla del operador, lo primero que
// ve la congregación un domingo es el escritorio de quien opera. Lo que se fija
// aquí es que por defecto vaya a la otra, que mover la salida en marcha no la
// cierre, que no se mande nada a una salida que no está abierta, y que la
// ventana que acaba de abrirse reciba el video que suena.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EstadoProyeccion, MonitorInfo, SalidaProyeccion } from "../api";
import type { Track } from "../types";

const projectionMonitors = vi.fn<() => Promise<MonitorInfo[]>>();
const openProjectionCmd = vi.fn<(m: number) => Promise<void>>();
const closeProjectionCmd = vi.fn<() => Promise<void>>();
const setProjectionCmd = vi.fn<(c: SalidaProyeccion) => Promise<void>>();
/** Lo que la salida devuelve, para poder empujarlo desde el test. */
let contestar: ((e: EstadoProyeccion) => void) | null = null;
/** El aviso de «ya estoy escuchando» que manda la ventana de salida. */
let avisarLista: (() => void) | null = null;

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  projectionMonitors: () => projectionMonitors(),
  openProjectionCmd: (m: number) => openProjectionCmd(m),
  closeProjectionCmd: () => closeProjectionCmd(),
  setProjectionCmd: (c: SalidaProyeccion) => setProjectionCmd(c),
  onProjectionState: (cb: (e: EstadoProyeccion) => void) => {
    contestar = cb;
    return Promise.resolve(() => {
      contestar = null;
    });
  },
  onProjectionReady: (cb: () => void) => {
    avisarLista = cb;
    return Promise.resolve(() => {
      avisarLista = null;
    });
  },
}));

const { useStore } = await import("../../store");
const initial = useStore.getState();

function pantalla(indice: number, over: Partial<MonitorInfo> = {}): MonitorInfo {
  return { indice, nombre: `Pantalla ${indice + 1}`, ancho: 1920, alto: 1080, principal: false, sistema: `Monitor ${indice}`, x: indice * 1920, y: 0, ...over };
}

const PORTATIL = pantalla(0, { nombre: "Built-in", sistema: "Built-in", principal: true });
const PROYECTOR = pantalla(1, { nombre: "DELL P2219H", sistema: "DELL P2219H" });

beforeEach(() => {
  useStore.setState(initial, true);
  for (const m of [projectionMonitors, openProjectionCmd, closeProjectionCmd, setProjectionCmd]) m.mockReset();
  projectionMonitors.mockResolvedValue([PORTATIL, PROYECTOR]);
  openProjectionCmd.mockResolvedValue(undefined);
  closeProjectionCmd.mockResolvedValue(undefined);
  setProjectionCmd.mockResolvedValue(undefined);
  contestar = null;
  avisarLista = null;
});

describe("elegir pantalla", () => {
  it("por defecto sale por la que no es la del operador", async () => {
    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitorSalida).toBe(PROYECTOR.indice);
  });

  it("con una sola pantalla no queda más remedio que esa", async () => {
    // Preparando un jueves, sin proyector: la salida tapará la ventana, que es
    // lo que de verdad pasa, y es mejor que un botón que no hace nada.
    projectionMonitors.mockResolvedValue([PORTATIL]);

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitorSalida).toBe(PORTATIL.indice);
  });

  it("sin ninguna pantalla no se inventa un índice", async () => {
    projectionMonitors.mockResolvedValue([]);

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitores).toEqual([]);
    expect(useStore.getState().monitorSalida).toBe(0);
  });

  it("si ya se está proyectando, volver a mirar no cambia la pantalla debajo", async () => {
    // Enchufar un teclado no puede mover la proyección a mitad de un culto.
    await useStore.getState().cargarMonitores();
    useStore.getState().elegirMonitor(0);
    useStore.setState({ proyectando: true });

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitorSalida).toBe(0);
  });

  it("y si el índice elegido ya no existe, vuelve a decidir", async () => {
    useStore.setState({ proyectando: true, monitorSalida: 7 });

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitorSalida).toBe(PROYECTOR.indice);
  });

  it("la que eligió quien opera se respeta al volver a mirar, aunque no se esté proyectando", async () => {
    // Elegir el portátil para probar, ir al culto a buscar una canción y volver
    // a Proyección no puede devolverla al proyector sin decir nada.
    await useStore.getState().cargarMonitores();
    useStore.getState().elegirMonitor(PORTATIL.indice);

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitorSalida).toBe(PORTATIL.indice);
  });

  it("y si la elegida se desconecta, vuelve a la de por defecto", async () => {
    await useStore.getState().cargarMonitores();
    useStore.getState().elegirMonitor(PROYECTOR.indice);
    projectionMonitors.mockResolvedValue([PORTATIL]);

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitorSalida).toBe(PORTATIL.indice);
  });

  it("que el núcleo falle deja la lista vacía, no revienta la vista", async () => {
    projectionMonitors.mockRejectedValue(new Error("sin ventana"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitores).toEqual([]);
  });
});

describe("abrir y cerrar la salida", () => {
  it("el botón de la barra la cierra", async () => {
    useStore.setState({ proyectando: true });

    useStore.getState().cerrarProyeccion();

    expect(closeProjectionCmd).toHaveBeenCalled();
    expect(useStore.getState().proyectando).toBe(false);
  });

  it("cambiar de pantalla en marcha la mueve, no la cierra", async () => {
    // Cerrar y volver a abrir sería un parpadeo delante de la congregación.
    useStore.setState({ proyectando: true, monitores: [PORTATIL, PROYECTOR] });

    useStore.getState().elegirMonitor(0);

    expect(openProjectionCmd).toHaveBeenCalledWith(0);
    expect(closeProjectionCmd).not.toHaveBeenCalled();
    expect(useStore.getState().proyectando).toBe(true);
  });

  it("y apagada solo se apunta cuál será", () => {
    useStore.setState({ proyectando: false, monitores: [PORTATIL, PROYECTOR] });

    useStore.getState().elegirMonitor(1);

    expect(openProjectionCmd).not.toHaveBeenCalled();
    expect(useStore.getState().monitorSalida).toBe(1);
  });
});

describe("mandar contenido a la salida", () => {
  it("no manda nada si no hay salida abierta", () => {
    useStore.setState({ proyectando: false });

    useStore.getState().proyectar({ vista: { modo: "negro" } });

    expect(setProjectionCmd).not.toHaveBeenCalled();
  });

  it("y con la salida abierta manda lo que se le pide", () => {
    useStore.setState({ proyectando: true });

    const mensaje = { vista: { modo: "media", src: "/m/v.mp4", titulo: "Sublime Gracia", reproduciendo: true, volumen: 0.5 } } as const;
    useStore.getState().proyectar(mensaje);

    expect(setProjectionCmd).toHaveBeenCalledWith(mensaje);
  });
});

// ---------------------------------------------------------------- el arranque

const VIDEO: Track = {
  id: "v",
  titulo: "Video",
  artista: "Coro",
  album: "",
  dur: "3:00",
  durSec: 180,
  formato: "MP4",
  carpeta: "Música",
  fav: false,
  missing: false,
  singers: [],
  added: 0,
  path: "/m/v.mp4",
  video: true,
};

/** El último mensaje mandado a la salida. */
const ultimo = (): SalidaProyeccion => {
  const llamadas = setProjectionCmd.mock.calls;
  return llamadas[llamadas.length - 1][0];
};

describe("el arranque de la ventana de salida", () => {
  it("el video que suena se manda otra vez cuando la salida dice que ya escucha", async () => {
    // Abrir la ventana y mandarle lo primero son dos cosas seguidas, y entre
    // una y otra el webview está arrancando. Sin esto, el video se perdía y
    // el proyector se quedaba en negro justo al empezar.
    useStore.setState({ tracks: [VIDEO], playerId: "v", playing: true, proyeccionPista: "v", proyectando: true });
    await useStore.getState().escucharProyeccion();
    setProjectionCmd.mockClear();

    avisarLista!();

    expect(ultimo().vista).toMatchObject({ modo: "media", src: "/m/v.mp4", reproduciendo: true });
  });

  it("y si no había ningún video, se le manda el negro", async () => {
    useStore.setState({ proyectando: true });
    await useStore.getState().escucharProyeccion();
    setProjectionCmd.mockClear();

    avisarLista!();

    expect(ultimo().vista).toEqual({ modo: "negro" });
  });

  it("con la salida cortada no se contesta a nada", async () => {
    await useStore.getState().escucharProyeccion();
    useStore.setState({ proyectando: false });
    setProjectionCmd.mockClear();

    avisarLista!();

    expect(setProjectionCmd).not.toHaveBeenCalled();
  });

  it("dejar de escuchar suelta las dos suscripciones", async () => {
    const soltar = await useStore.getState().escucharProyeccion();

    soltar();

    expect(avisarLista).toBeNull();
    expect(contestar).toBeNull();
  });
});
