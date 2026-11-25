// La lista temporal (#230): lo que va a sonar, armado sobre la marcha. Se fija
// qué entra y en qué orden, que suena una detrás de otra siguiendo la lista
// viva, y que se recuerda entre sesiones.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Playlist, Track } from "../types";
import { agregarAlFinal, llevarA, moverEn } from "../temporal";
import { parsePrefs, serialisePrefs, type UiPrefs } from "../uiPrefs";

const createPlaylistCmd = vi.fn<(nombre: string) => Promise<string>>();
const addTracksToPlaylistCmd = vi.fn<(id: string, ids: string[]) => Promise<Playlist[]>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  createPlaylistCmd: (nombre: string) => createPlaylistCmd(nombre),
  addTracksToPlaylistCmd: (id: string, ids: string[]) => addTracksToPlaylistCmd(id, ids),
}));

const { useStore, playQueue } = await import("../../store");
const initial = useStore.getState();

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
    singers: [],
    added: 0,
    path: `/m/${id}.mp3`,
    ...over,
  };
}

const st = () => useStore.getState();

beforeEach(() => {
  useStore.setState(initial, true);
  createPlaylistCmd.mockReset();
  addTracksToPlaylistCmd.mockReset();
  useStore.setState({
    tracks: ["a", "b", "c", "d"].map((id) => pista(id)),
    view: "biblioteca",
    temporal: [],
    playerId: "",
    playing: false,
  });
});

describe("las reglas del orden", () => {
  it("añade al final sin repetir y cuenta solo las que entraron", () => {
    expect(agregarAlFinal(["a"], ["b", "a", "c", "b"])).toEqual({ lista: ["a", "b", "c"], agregadas: 2 });
    expect(agregarAlFinal(["a"], ["a"])).toEqual({ lista: ["a"], agregadas: 0 });
  });

  it("mueve sin dar la vuelta en los extremos", () => {
    expect(moverEn(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(moverEn(["a", "b", "c"], "a", -1)).toBeNull();
    expect(moverEn(["a", "b", "c"], "c", 1)).toBeNull();
    expect(moverEn(["a", "b"], "z", 1)).toBeNull();
  });

  it("al soltar un arrastre, la pista ocupa el sitio de aquella sobre la que se soltó", () => {
    expect(llevarA(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(llevarA(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(llevarA(["a", "b"], "a", "a")).toBeNull();
  });
});

describe("armarla", () => {
  it("agrega al final y dice que ya estaba en vez de «0 agregadas»", () => {
    st().agregarATemporal(["b", "a"]);
    expect(st().temporal).toEqual(["b", "a"]);
    expect(st().toast?.titulo).toBe("Agregadas a la lista temporal");

    st().agregarATemporal(["a"]);
    expect(st().temporal).toEqual(["b", "a"]);
    expect(st().toast?.titulo).toBe("Ya estaba en la lista temporal");
  });

  it("desde el menú de una canción agrega lo seleccionado, en el orden de la biblioteca", () => {
    useStore.setState({ selection: ["c", "a"] });
    st().agregarElegidasATemporal();
    expect(st().temporal).toEqual(["a", "c"]);
    expect(st().selection).toEqual([]);
  });

  it("se reordena y se quita, y lo dice para el lector de pantalla", () => {
    useStore.setState({ temporal: ["a", "b", "c"] });
    st().moverEnTemporal("c", -1);
    expect(st().temporal).toEqual(["a", "c", "b"]);
    expect(st().reorderNotice).toBe("«Pista c», posición 2 de 3");

    st().quitarDeTemporal("a");
    expect(st().temporal).toEqual(["c", "b"]);
  });

  it("vaciarla pregunta antes", () => {
    useStore.setState({ temporal: ["a", "b"] });
    st().vaciarTemporal();
    expect(st().temporal).toEqual(["a", "b"]);
    st().confirm!.onConfirm();
    expect(st().temporal).toEqual([]);
  });
});

describe("hacerla sonar", () => {
  it("suena desde la primera, una detrás de otra, y se para al acabarse", () => {
    useStore.setState({ temporal: ["c", "a"] });
    st().reproducirTemporal();
    expect(st().playerId).toBe("c");
    expect(st().queueOrigen).toBe("temporal");

    st().next();
    expect(st().playerId).toBe("a");
    st().next();
    expect(st().playing).toBe(false);
  });

  it("salta la que no tiene archivo", () => {
    useStore.setState({
      tracks: [pista("a", { missing: true }), pista("b")],
      temporal: ["a", "b"],
    });
    st().reproducirTemporal();
    expect(st().playerId).toBe("b");
  });

  it("lo que se añade o se mueve mientras suena cuenta para lo que viene", () => {
    useStore.setState({ temporal: ["a", "b"] });
    st().reproducirTemporal();
    st().agregarATemporal(["d"]);
    st().moverEnTemporal("d", -1);
    expect(playQueue(st())).toEqual(["a", "d", "b"]);
    st().next();
    expect(st().playerId).toBe("d");
  });

  it("vacía mientras suena, la cola se acaba en vez de saltar a la biblioteca", () => {
    useStore.setState({ temporal: ["a"] });
    st().reproducirTemporal();
    useStore.setState({ temporal: [] });
    expect(playQueue(st())).toEqual([]);
  });

  it("dar a una pista desde su vista pone la lista temporal como cola", () => {
    useStore.setState({ temporal: ["b", "c"], view: "temporal" });
    st().play("c");
    expect(st().queueOrigen).toBe("temporal");
    expect(playQueue(st())).toEqual(["b", "c"]);
  });
});

describe("guardarla como lista de canciones", () => {
  it("crea la lista con su orden, la abre y no vacía la temporal", async () => {
    useStore.setState({ temporal: ["c", "a"] });
    createPlaylistCmd.mockResolvedValue("p9");
    addTracksToPlaylistCmd.mockResolvedValue([{ id: "p9", nombre: "Ensayo", ids: ["c", "a"], tocada: "" }]);

    st().guardarTemporalComoLista("Ensayo");
    await vi.waitFor(() => expect(st().view).toBe("lista"));

    expect(createPlaylistCmd).toHaveBeenCalledWith("Ensayo");
    expect(addTracksToPlaylistCmd).toHaveBeenCalledWith("p9", ["c", "a"]);
    expect(st().curPlaylist).toBe("p9");
    expect(st().temporal).toEqual(["c", "a"]);
  });
});

describe("se recuerda entre sesiones", () => {
  it("viaja con las preferencias, y lo que no es una lista de ids se descarta", () => {
    const prefs = { ...parsePrefs("{}"), temporal: ["b", "a"] } as UiPrefs;
    expect(parsePrefs(serialisePrefs(prefs)).temporal).toEqual(["b", "a"]);
    expect(parsePrefs(JSON.stringify({ temporal: ["a", 3] })).temporal).toBeUndefined();
    expect(parsePrefs(JSON.stringify({ temporal: "a" })).temporal).toBeUndefined();
    expect(parsePrefs(JSON.stringify({ view: "temporal" })).view).toBe("temporal");
  });
});
