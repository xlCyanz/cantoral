// Duplicar una lista y partir de una plantilla escriben una lista nueva sin
// tocar la de origen. Lo que se fija aquí es esa separación —que editar la
// copia no mueva el culto que ya pasó— y que un fallo del backend no deje la
// pantalla diciendo que se duplicó algo que nunca se guardó.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Playlist } from "../types";
import type { Snapshot } from "../api";

let enTauri = false;
const duplicatePlaylistCmd = vi.fn<(playlist: string) => Promise<string>>();
const setPlaylistTemplateCmd = vi.fn<(playlist: string, plantilla: boolean) => Promise<Snapshot>>();
const createPlaylistCmd = vi.fn<(n: string, o: string, desde?: string) => Promise<string>>();
const getLibrary = vi.fn<() => Promise<Snapshot | null>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => enTauri,
  duplicatePlaylistCmd: (playlist: string) => duplicatePlaylistCmd(playlist),
  setPlaylistTemplateCmd: (playlist: string, plantilla: boolean) =>
    setPlaylistTemplateCmd(playlist, plantilla),
  createPlaylistCmd: (n: string, o: string, desde?: string) => createPlaylistCmd(n, o, desde),
  getLibrary: () => getLibrary(),
}));

const { useStore } = await import("../../store");
const initial = useStore.getState();

function lista(id: string, over: Partial<Playlist> = {}): Playlist {
  return { id, nombre: `Lista ${id}`, tocada: "", ocasion: "", ids: [], plantilla: false, ...over };
}

/** A library with one past service and one template. */
function conListas() {
  const culto = lista("p1", {
    nombre: "Culto",
    tocada: "",
    ocasion: "Servicio dominical",
    ids: ["a", "b", "c"],
  });
  const plantilla = lista("p9", {
    nombre: "Dominical",
    ocasion: "Servicio dominical",
    ids: ["b", "a"],
    plantilla: true,
  });
  useStore.setState({
    playlists: [culto, plantilla],
    plOrder: { p1: ["a", "b", "c"], p9: ["b", "a"] },
    curPlaylist: "p1",
    view: "lista",
  });
}

const abierta = () => {
  const s = useStore.getState();
  return s.playlists.find((p) => p.id === s.curPlaylist)!;
};

beforeEach(() => {
  useStore.setState(initial, true);
  enTauri = false;
  [duplicatePlaylistCmd, setPlaylistTemplateCmd, createPlaylistCmd, getLibrary].forEach((m) =>
    m.mockReset(),
  );
  getLibrary.mockResolvedValue(null);
  conListas();
});

describe("duplicar una lista, en el navegador", () => {
  it("copia el orden y la ocasión", () => {
    useStore.getState().duplicateList("p1");

    const copia = abierta();
    expect(copia.id).not.toBe("p1");
    expect(copia.nombre).toBe("Culto (copia)");
    expect(copia.ocasion).toBe("Servicio dominical");
    expect(useStore.getState().plOrder[copia.id]).toEqual(["a", "b", "c"]);
  });

  it("abre la copia, no deja al usuario en la original", () => {
    useStore.getState().duplicateList("p1");

    expect(useStore.getState().view).toBe("lista");
    expect(useStore.getState().curPlaylist).not.toBe("p1");
  });

  it("la copia lleva su propio orden, no el mismo arreglo", () => {
    // Compartir el arreglo haría que reordenar la copia reordenara el culto
    // que ya pasó, sin que nada lo dijera.
    useStore.getState().duplicateList("p1");
    const copia = useStore.getState().curPlaylist;
    const { plOrder } = useStore.getState();

    expect(plOrder[copia]).toEqual(plOrder.p1);
    expect(plOrder[copia]).not.toBe(plOrder.p1);
  });

  it("no duplica una lista que ya no está", () => {
    const antes = useStore.getState().playlists.length;

    useStore.getState().duplicateList("no-existe");

    expect(useStore.getState().playlists).toHaveLength(antes);
  });
});

describe("duplicar una lista, en la app", () => {
  beforeEach(() => {
    enTauri = true;
  });

  it("pide la copia al backend y abre la que devuelve", async () => {
    duplicatePlaylistCmd.mockResolvedValue("77");

    useStore.getState().duplicateList("p1");

    await vi.waitFor(() => expect(useStore.getState().curPlaylist).toBe("77"));
    expect(duplicatePlaylistCmd).toHaveBeenCalledWith("p1");
  });

  it("si el backend falla lo dice y no mueve al usuario", async () => {
    duplicatePlaylistCmd.mockRejectedValue(new Error("disco lleno"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    useStore.getState().duplicateList("p1");

    await vi.waitFor(() => expect(useStore.getState().toast?.type).toBe("error"));
    expect(useStore.getState().toast?.titulo).toContain("No se pudo duplicar");
    expect(useStore.getState().curPlaylist).toBe("p1");
  });
});

describe("partir de una plantilla", () => {
  it("la lista nueva empieza con el repertorio de la plantilla", () => {
    useStore.getState().createList("Culto 11 Ene", "Servicio dominical", "p9");

    const nueva = abierta();
    expect(useStore.getState().plOrder[nueva.id]).toEqual(["b", "a"]);
    // Una lista hecha desde una plantilla es un culto, no otra plantilla.
    expect(nueva.plantilla).toBe(false);
  });

  it("sin plantilla la lista nace vacía", () => {
    useStore.getState().createList("Culto 11 Ene", "Servicio dominical");

    expect(useStore.getState().plOrder[abierta().id]).toEqual([]);
  });

  it("copiar la plantilla no la vacía ni comparte su arreglo", () => {
    useStore.getState().createList("Culto 11 Ene", "", "p9");

    const { plOrder, curPlaylist } = useStore.getState();
    expect(plOrder.p9).toEqual(["b", "a"]);
    expect(plOrder[curPlaylist]).not.toBe(plOrder.p9);
  });

  it("en la app el id de la plantilla viaja con la orden", async () => {
    enTauri = true;
    createPlaylistCmd.mockResolvedValue("77");

    useStore.getState().createList("Culto", "Servicio dominical", "p9");

    await vi.waitFor(() => expect(useStore.getState().curPlaylist).toBe("77"));
    expect(createPlaylistCmd).toHaveBeenCalledWith("Culto", "Servicio dominical", "p9");
  });
});

describe("marcar una lista como plantilla", () => {
  it("la marca y la desmarca", () => {
    useStore.getState().toggleCurrentTemplate();
    expect(abierta().plantilla).toBe(true);

    useStore.getState().toggleCurrentTemplate();
    expect(abierta().plantilla).toBe(false);
  });

  it("en la app manda lo contrario de lo que hay", async () => {
    enTauri = true;
    setPlaylistTemplateCmd.mockResolvedValue({
      tracks: [],
      folders: [],
      playlists: [],
    } as unknown as Snapshot);

    useStore.getState().toggleCurrentTemplate();

    await vi.waitFor(() => expect(setPlaylistTemplateCmd).toHaveBeenCalledWith("p1", true));
  });

  it("si el backend falla no se queda marcada en pantalla", async () => {
    enTauri = true;
    setPlaylistTemplateCmd.mockRejectedValue(new Error("base bloqueada"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    useStore.getState().toggleCurrentTemplate();

    await vi.waitFor(() => expect(useStore.getState().toast?.type).toBe("error"));
    expect(abierta().plantilla).toBe(false);
  });
});
