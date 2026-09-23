// Cantoral ya no le pasa ningún archivo al reproductor del sistema (#81). Lo
// que se fija aquí es lo que hace en su lugar: que un video se reproduzca
// dentro, que la única superficie donde se puede ver se abra sola al llegar a
// él, y que proyectar no deje dos cosas sonando a la vez por los altavoces del
// culto.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../types";

const openProjectionCmd = vi.fn<(m: number) => Promise<void>>();
const setProjectionCmd = vi.fn<(c: unknown) => Promise<void>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  projectionMonitors: () => Promise.resolve([]),
  openProjectionCmd: (m: number) => openProjectionCmd(m),
  closeProjectionCmd: () => Promise.resolve(),
  setProjectionCmd: (c: unknown) => setProjectionCmd(c),
  onProjectionState: () => Promise.resolve(() => {}),
  onProjectionReady: () => Promise.resolve(() => {}),
}));

const { avisoDeOmitidos, useStore } = await import("../../store");
const initial = useStore.getState();

function pista(id: string, over: Partial<Track> = {}): Track {
  return {
    id,
    titulo: `Pista ${id}`,
    artista: "Coro",
    album: "",
    dur: "3:00",
    durSec: 180,
    tono: "",
    bpm: 0,
    ocasion: "",
    formato: "MP3",
    carpeta: "Música",
    tags: [],
    fav: false,
    missing: false,
    added: 0,
    tieneHoja: false,
    path: `/m/${id}.mp3`,
    ...over,
  };
}

const CANCION = pista("a");
const VIDEO = pista("v", { video: true, path: "/m/v.mp4", formato: "MP4" });

beforeEach(() => {
  useStore.setState(initial, true);
  openProjectionCmd.mockReset();
  setProjectionCmd.mockReset();
  openProjectionCmd.mockResolvedValue(undefined);
  setProjectionCmd.mockResolvedValue(undefined);
  useStore.setState({
    tracks: [CANCION, VIDEO],
    curPlaylist: "p1",
    plOrder: { p1: ["a", "v"] },
    queue: ["a", "v"],
    view: "biblioteca",
    detailOpen: false,
    selId: "",
    playerId: "",
    playing: false,
  });
});

describe("reproducir un video", () => {
  it("lo pone en el transporte de la app, no en otro programa", () => {
    useStore.getState().play("v");

    const s = useStore.getState();
    expect(s.playerId).toBe("v");
    expect(s.playing).toBe(true);
  });

  it("y abre el panel de detalle, que es donde se puede ver", () => {
    // Sin el panel, el video sonaría sin que nadie lo viera: es la única
    // superficie de video de esta ventana.
    useStore.getState().play("v");

    const s = useStore.getState();
    expect(s.detailOpen).toBe(true);
    expect(s.selId).toBe("v");
  });

  it("una canción no abre nada", () => {
    useStore.getState().play("a");

    expect(useStore.getState().detailOpen).toBe(false);
  });

  it("llegar al video con «siguiente» también lo abre", () => {
    // Pasa solo, al acabarse la canción anterior de la lista del culto.
    useStore.getState().play("a");

    useStore.getState().next();

    const s = useStore.getState();
    expect(s.playerId).toBe("v");
    expect(s.detailOpen).toBe(true);
    expect(s.selId).toBe("v");
  });

  it("y llegar al video hacia atrás, igual", () => {
    useStore.setState({ playerId: "a" });

    useStore.getState().prev();

    expect(useStore.getState().playerId).toBe("v");
    expect(useStore.getState().detailOpen).toBe(true);
  });

  it("cambiar de pista pone el tiempo a cero", () => {
    useStore.setState({ playerId: "a", posSec: 95 });

    useStore.getState().next();

    expect(useStore.getState().posSec).toBe(0);
  });

  it("un archivo que no está sigue sin reproducirse, y se dice", () => {
    useStore.setState({ tracks: [pista("x", { missing: true })] });

    useStore.getState().play("x");

    expect(useStore.getState().playerId).toBe("");
    expect(useStore.getState().toast?.type).toBe("error");
  });
});

describe("proyectar mientras algo suena", () => {
  it("calla el reproductor del portátil", () => {
    // Hay una sola salida de audio. Dos cosas a la vez por los altavoces del
    // culto no es algo que nadie quiera, y con el video sonando dentro de la
    // app es fácil acabar ahí sin darse cuenta.
    useStore.getState().play("a");
    useStore.setState({ proyectando: true });

    useStore.getState().proyectarElemento(0);

    expect(useStore.getState().playing).toBe(false);
  });

  it("y lo que se proyecta es lo que se pidió, no lo que sonaba", () => {
    useStore.getState().play("a");
    useStore.setState({ proyectando: true });

    useStore.getState().proyectarElemento(1);

    expect(useStore.getState().proyeccionIdx).toBe(1);
    expect(useStore.getState().playerId).toBe("a");
  });
});

describe("el aviso de lo que el escaneo no indexó", () => {
  it("con cero, no dice nada: no hay nada que decir", () => {
    expect(avisoDeOmitidos(0)).toBe("");
    expect(avisoDeOmitidos(-1)).toBe("");
  });

  it("con uno, en singular", () => {
    expect(avisoDeOmitidos(1)).toBe(" · 1 archivo en un formato que Cantoral no reproduce");
  });

  it("con varios, en plural", () => {
    // Saltárselos en silencio sería peor que no tenerlos: quien ve que faltan
    // tres canciones no sabría si es por el formato o porque algo se rompió.
    expect(avisoDeOmitidos(3)).toBe(" · 3 archivos en formatos que Cantoral no reproduce");
  });
});

describe("de dónde sale lo que suena", () => {
  it("dar a play en la biblioteca deja la cola de la biblioteca", () => {
    // La barra lo dice, y hace falta: poner una canción suelta en mitad de un
    // culto deja el transporte siguiendo la biblioteca, y sin decirlo nadie se
    // enteraría hasta que sonara lo que no tocaba.
    useStore.setState({ view: "biblioteca" });

    useStore.getState().play("a");

    expect(useStore.getState().queueOrigen).toBe("biblioteca");
  });

  it("y darle desde un culto abierto deja la del culto", () => {
    useStore.setState({ view: "lista" });

    useStore.getState().play("a");

    expect(useStore.getState().queueOrigen).toBe("culto");
  });

  it("pasar de pista no cambia de dónde salió la cola", () => {
    useStore.setState({ view: "lista" });
    useStore.getState().play("a");

    useStore.getState().next();

    expect(useStore.getState().queueOrigen).toBe("culto");
  });
});
