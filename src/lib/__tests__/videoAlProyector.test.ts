// Poner un video a sonar lo saca por el proyector, en la pantalla elegida en
// Configuración. No hay otra forma de proyectar: todo sale del reproductor, y
// la barra de abajo lo controla siempre, también cuando la cola pasa a otra
// pista. Lo que se fija aquí: que se abra en la pantalla que toca, qué pasa
// cuando no está, que haya un solo sonido, y que play, pausa y la barra de
// progreso lleguen a la salida.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EstadoProyeccion, MensajeProyeccion, MonitorInfo } from "../api";
import type { Track } from "../types";
import { parsePrefs } from "../uiPrefs";
import { identidadDe, resolverPantalla } from "../pantallas";

const projectionMonitors = vi.fn<() => Promise<MonitorInfo[]>>();
const openProjectionCmd = vi.fn<(m: number) => Promise<void>>();
const closeProjectionCmd = vi.fn<() => Promise<void>>();
const setProjectionCmd = vi.fn<(c: MensajeProyeccion) => Promise<void>>();
let contestar: ((e: EstadoProyeccion) => void) | null = null;

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  projectionMonitors: () => projectionMonitors(),
  openProjectionCmd: (m: number) => openProjectionCmd(m),
  closeProjectionCmd: () => closeProjectionCmd(),
  setProjectionCmd: (c: MensajeProyeccion) => setProjectionCmd(c),
  onProjectionState: (cb: (e: EstadoProyeccion) => void) => {
    contestar = cb;
    return Promise.resolve(() => (contestar = null));
  },
  onProjectionReady: () => Promise.resolve(() => {}),
}));

const { enElProyector, useStore } = await import("../../store");
const initial = useStore.getState();

function pantalla(indice: number, over: Partial<MonitorInfo> = {}): MonitorInfo {
  return { indice, nombre: `Pantalla ${indice + 1}`, ancho: 1920, alto: 1080, principal: false, sistema: `M${indice}`, x: indice * 1920, y: 0, ...over };
}
const PORTATIL = pantalla(0, { sistema: "Built-in", principal: true, ancho: 2880, alto: 1800 });
const TELE = pantalla(1, { sistema: "SAMSUNG", x: 2880 });
const PROYECTOR = pantalla(2, { sistema: "EPSON", x: 4800, ancho: 1280, alto: 800 });

function pista(id: string, over: Partial<Track> = {}): Track {
  return {
    id,
    titulo: `Pista ${id}`,
    artista: "Coro",
    album: "",
    dur: "3:00",
    durSec: 180,
    formato: "MP3",
    carpeta: "Música",
    fav: false,
    missing: false,
    added: 0,
    path: `/m/${id}.mp3`,
    ...over,
  };
}
const CANCION = pista("a");
const VIDEO = pista("v", { video: true, path: "/m/v.mp4", formato: "MP4" });
const OTRO_VIDEO = pista("w", { video: true, path: "/m/w.mp4", formato: "MP4", durSec: 60, dur: "1:00" });

/** El último mensaje mandado a la salida. */
const ultimo = (): MensajeProyeccion => {
  const llamadas = setProjectionCmd.mock.calls;
  return llamadas[llamadas.length - 1][0];
};

/** Deja que terminen las promesas encadenadas de abrir la salida. */
const esperar = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  useStore.setState(initial, true);
  for (const m of [projectionMonitors, openProjectionCmd, closeProjectionCmd, setProjectionCmd]) m.mockReset();
  projectionMonitors.mockResolvedValue([PORTATIL, TELE, PROYECTOR]);
  openProjectionCmd.mockResolvedValue(undefined);
  closeProjectionCmd.mockResolvedValue(undefined);
  setProjectionCmd.mockResolvedValue(undefined);
  useStore.setState({
    tracks: [CANCION, VIDEO, OTRO_VIDEO],
    curPlaylist: "p1",
    plOrder: { p1: ["a", "v", "w"] },
    queue: ["v", "a", "w"],
    playerId: "",
  });
  await useStore.getState().escucharProyeccion();
});

describe("poner un video a sonar lo proyecta", () => {
  it("se abre en la pantalla elegida en Configuración, no en la de por defecto", async () => {
    // Por defecto sería la tele (la primera que no es el portátil); se eligió
    // el proyector, y el índice no importa: se busca por lo que la describe.
    useStore.setState({ pantallaProyeccion: identidadDe(PROYECTOR) });

    useStore.getState().play("v", ["v", "a"]);
    await esperar();

    expect(openProjectionCmd).toHaveBeenCalledWith(PROYECTOR.indice);
    const s = useStore.getState();
    expect(s.proyectando).toBe(true);
    expect(s.proyeccionPista).toBe("v");
    expect(ultimo()).toEqual({ vista: expect.objectContaining({ modo: "media", src: "/m/v.mp4", reproduciendo: true }) });
  });

  it("el índice puede haber cambiado desde que se eligió", async () => {
    // Se desenchufó la tele: el proyector pasa a ser la «Pantalla 2».
    useStore.setState({ pantallaProyeccion: identidadDe(PROYECTOR) });
    projectionMonitors.mockResolvedValue([PORTATIL, { ...PROYECTOR, indice: 1, nombre: "Pantalla 2" }]);

    useStore.getState().play("v");
    await esperar();

    expect(openProjectionCmd).toHaveBeenCalledWith(1);
  });

  it("si la elegida no está conectada, sale por la de por defecto y lo dice", async () => {
    useStore.setState({ pantallaProyeccion: { sistema: "BENQ", ancho: 1024, alto: 768, x: 9000, y: 0 } });

    useStore.getState().play("v");
    await esperar();

    expect(openProjectionCmd).toHaveBeenCalledWith(TELE.indice);
    expect(useStore.getState().toast?.titulo).toMatch(/no está conectada/);
    // Y sigue guardada, para cuando vuelva.
    expect(useStore.getState().pantallaProyeccion?.sistema).toBe("BENQ");
  });

  it("con una sola pantalla se queda en el panel, sin tapar la del operador", async () => {
    projectionMonitors.mockResolvedValue([PORTATIL]);

    useStore.getState().play("v");
    await esperar();

    const s = useStore.getState();
    expect(openProjectionCmd).not.toHaveBeenCalled();
    expect(s.proyeccionPista).toBeNull();
    expect(s.videoEnPanel).toBe("v");
    expect(s.detailOpen && s.selId === "v").toBe(true);
    expect(s.playing).toBe(true);

    // Y pausar y seguir no lo vuelve a intentar: cortaría el video del panel.
    useStore.getState().togglePlay();
    useStore.getState().togglePlay();
    expect(useStore.getState().proyeccionPista).toBeNull();
  });

  it("si no se pudo abrir la salida, el video se ve en el panel", async () => {
    openProjectionCmd.mockRejectedValue(new Error("no"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    useStore.getState().play("v");
    await esperar();

    expect(useStore.getState().proyeccionPista).toBeNull();
    expect(useStore.getState().proyectando).toBe(false);
    expect(useStore.getState().videoEnPanel).toBe("v");
  });

  it("con el ajuste apagado, el video se ve en el panel como antes", async () => {
    useStore.setState({ proyectarVideos: false });

    useStore.getState().play("v");
    await esperar();

    expect(openProjectionCmd).not.toHaveBeenCalled();
    expect(useStore.getState().proyeccionPista).toBeNull();
  });

  it("un audio no abre nada: suena en el portátil", async () => {
    useStore.getState().play("a");
    await esperar();

    expect(openProjectionCmd).not.toHaveBeenCalled();
  });

  it("con la salida ya abierta, otro video la ocupa sin reabrirla", async () => {
    useStore.setState({ proyectando: true });

    useStore.getState().play("w");
    await esperar();

    expect(openProjectionCmd).not.toHaveBeenCalled();
    expect(ultimo()).toEqual({ vista: expect.objectContaining({ src: "/m/w.mp4", reproduciendo: true }) });
  });
});

describe("un video en el proyector, desde la barra", () => {
  async function proyectandoVideo() {
    useStore.getState().play("v", ["v", "a", "w"]);
    await esperar();
    setProjectionCmd.mockClear();
  }

  it("la barra habla del video y pausar pausa la salida", async () => {
    await proyectandoVideo();
    expect(enElProyector(useStore.getState())).toBe(true);

    useStore.getState().togglePlay();

    expect(ultimo()).toEqual({ vista: expect.objectContaining({ src: "/m/v.mp4", reproduciendo: false }) });
    useStore.getState().togglePlay();
    expect(ultimo()).toEqual({ vista: expect.objectContaining({ src: "/m/v.mp4", reproduciendo: true }) });
  });

  it("mover la barra de progreso salta en la salida", async () => {
    await proyectandoVideo();

    useStore.getState().seekToFraction(0.5);

    expect(ultimo()).toEqual({ orden: "buscar", src: "/m/v.mp4", pos: 90 });
    expect(useStore.getState().posSec).toBe(90);
  });

  it("el tiempo de la barra es el que devuelve la salida", async () => {
    await proyectandoVideo();

    contestar?.({ src: "/m/v.mp4", pos: 42, dur: 200, fin: false });

    const s = useStore.getState();
    expect(s.posSec).toBe(42);
    // La duración real del archivo manda sobre la de las etiquetas.
    expect(s.tracks.find((t) => t.id === "v")?.durSec).toBe(200);
  });

  it("al terminar pasa a lo siguiente; si es un audio, la salida queda en negro y abierta", async () => {
    await proyectandoVideo();

    contestar?.({ src: "/m/v.mp4", pos: 180, dur: 180, fin: true });

    const s = useStore.getState();
    expect(s.playerId).toBe("a");
    expect(s.proyeccionPista).toBeNull();
    expect(ultimo()).toEqual({ vista: { modo: "negro" } });
    // Sin cerrarla: cerrar y reabrir en el próximo video enseñaría el
    // escritorio por el proyector.
    expect(closeProjectionCmd).not.toHaveBeenCalled();
    expect(s.proyectando).toBe(true);
  });

  it("y si lo siguiente es otro video, lo pone en la misma salida", async () => {
    useStore.getState().play("v", ["v", "w"]);
    await esperar();

    useStore.getState().next();

    expect(useStore.getState().proyeccionPista).toBe("w");
    expect(ultimo()).toEqual({ vista: expect.objectContaining({ src: "/m/w.mp4", reproduciendo: true }) });
    expect(openProjectionCmd).toHaveBeenCalledTimes(1);
  });

  it("con «Repetir», al terminar rebobina la salida", async () => {
    await proyectandoVideo();
    useStore.setState({ repeat: true });

    contestar?.({ src: "/m/v.mp4", pos: 180, dur: 180, fin: true });

    expect(ultimo()).toEqual({ orden: "buscar", src: "/m/v.mp4", pos: 0 });
  });

  it("lo que llega de otro archivo se descarta", async () => {
    await proyectandoVideo();

    contestar?.({ src: "/m/w.mp4", pos: 30, dur: 60, fin: true });

    expect(useStore.getState().playerId).toBe("v");
  });

  it("cerrar la proyección para el video", async () => {
    await proyectandoVideo();

    useStore.getState().cerrarProyeccion();

    const s = useStore.getState();
    expect(closeProjectionCmd).toHaveBeenCalled();
    expect(s.playing).toBe(false);
    expect(s.proyeccionPista).toBeNull();
  });

});

describe("la cola avanza y la barra sigue mandando", () => {
  it("pasar a otro video deja la barra en él: pausa, salto y tiempo son los suyos", async () => {
    useStore.getState().play("v", ["v", "w", "a"]);
    await esperar();

    useStore.getState().next();
    setProjectionCmd.mockClear();

    let s = useStore.getState();
    expect(s.playerId).toBe("w");
    expect(enElProyector(s)).toBe(true);

    useStore.getState().togglePlay();
    expect(ultimo()).toEqual({ vista: expect.objectContaining({ src: "/m/w.mp4", reproduciendo: false }) });

    useStore.getState().togglePlay();
    useStore.getState().seekToFraction(0.5);
    expect(ultimo()).toEqual({ orden: "buscar", src: "/m/w.mp4", pos: 30 });

    contestar?.({ src: "/m/w.mp4", pos: 12, dur: 60, fin: false });
    s = useStore.getState();
    expect(s.posSec).toBe(12);
  });

  it("y al pasar a un audio, el proyector queda en negro y el audio es de la barra", async () => {
    useStore.getState().play("v", ["v", "a"]);
    await esperar();

    useStore.getState().next();

    const s = useStore.getState();
    expect(s.playerId).toBe("a");
    expect(s.playing).toBe(true);
    expect(enElProyector(s)).toBe(false);
    expect(ultimo()).toEqual({ vista: { modo: "negro" } });
    expect(s.proyectando).toBe(true);

    // Pausar el audio es pausar el audio: al proyector no se le manda nada.
    setProjectionCmd.mockClear();
    useStore.getState().togglePlay();
    expect(useStore.getState().playing).toBe(false);
    expect(setProjectionCmd).not.toHaveBeenCalled();
  });

  it("volver con «Anterior» a un video lo saca otra vez por la misma salida", async () => {
    useStore.getState().play("v", ["v", "a"]);
    await esperar();
    useStore.getState().next();

    useStore.getState().prev();

    expect(enElProyector(useStore.getState())).toBe(true);
    expect(ultimo()).toEqual({ vista: expect.objectContaining({ src: "/m/v.mp4", reproduciendo: true }) });
    expect(openProjectionCmd).toHaveBeenCalledTimes(1);
  });

  it("al terminar el último video de la cola, sigue la cola como en el equipo", async () => {
    useStore.getState().play("w", ["v", "w"]);
    await esperar();

    contestar?.({ src: "/m/w.mp4", pos: 60, dur: 60, fin: true });

    expect(useStore.getState().playerId).toBe("v");
    expect(ultimo()).toEqual({ vista: expect.objectContaining({ src: "/m/v.mp4" }) });
  });
});

describe("la pantalla de proyección se recuerda por lo que la describe", () => {
  it("elegirla en Configuración la guarda para el próximo arranque", async () => {
    await useStore.getState().cargarMonitores();

    useStore.getState().elegirMonitor(PROYECTOR.indice);

    expect(useStore.getState().pantallaProyeccion).toEqual(identidadDe(PROYECTOR));
  });

  it("al volver a mirar, se encuentra aunque haya cambiado de índice", async () => {
    useStore.setState({ pantallaProyeccion: identidadDe(PROYECTOR) });
    projectionMonitors.mockResolvedValue([{ ...PROYECTOR, indice: 0 }, { ...PORTATIL, indice: 1 }]);

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitorSalida).toBe(0);
  });

  it("de más a menos seguro: nombre y sitio, nombre solo, sitio y resolución", () => {
    const g = identidadDe(PROYECTOR);
    // Movida en el escritorio: el nombre basta.
    expect(resolverPantalla([PORTATIL, { ...PROYECTOR, x: 0, y: -800 }], g)).toBe(PROYECTOR.indice);
    // Windows la renombró al reconectar: el sitio y la resolución.
    expect(resolverPantalla([PORTATIL, { ...PROYECTOR, sistema: "\\\\.\\DISPLAY5" }], g)).toBe(PROYECTOR.indice);
    // Dos del mismo modelo y nada más que el nombre: no se elige a ciegas.
    const gemela = { ...PROYECTOR, indice: 3, x: 7000 };
    expect(resolverPantalla([{ ...PROYECTOR, x: 100 }, gemela], g)).toBeNull();
    // Nada parecido: no está.
    expect(resolverPantalla([PORTATIL, TELE], g)).toBeNull();
    expect(resolverPantalla([PORTATIL], null)).toBeNull();
  });

  it("lo guardado se lee con cuidado", () => {
    const g = identidadDe(PROYECTOR);
    expect(parsePrefs(JSON.stringify({ pantallaProyeccion: g, proyectarVideos: false }))).toEqual({ pantallaProyeccion: g, proyectarVideos: false });
    expect(parsePrefs(JSON.stringify({ pantallaProyeccion: { sistema: 3 } }))).toEqual({});
    expect(parsePrefs(JSON.stringify({ pantallaProyeccion: null }))).toEqual({ pantallaProyeccion: null });
  });
});
