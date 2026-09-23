// Un culto no tiene fecha: es una lista preparada para darle y que corra. Lo
// que los ordena es cuándo se tocaron por última vez, y lo que se fija aquí es
// qué cuenta como «tocar» —abrirlo, cambiarle algo— y qué no.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Playlist } from "../types";
import type { Snapshot } from "../api";

let enTauri = false;
const touchPlaylistCmd = vi.fn<(id: string) => Promise<void>>();
const updatePlaylistCmd = vi.fn<(id: string, nombre: string, ocasion: string) => Promise<Snapshot>>();
const setPlaylistOrderCmd = vi.fn<(id: string, ids: string[]) => Promise<void>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => enTauri,
  touchPlaylistCmd: (id: string) => touchPlaylistCmd(id),
  updatePlaylistCmd: (id: string, nombre: string, ocasion: string) => updatePlaylistCmd(id, nombre, ocasion),
  setPlaylistOrderCmd: (id: string, ids: string[]) => setPlaylistOrderCmd(id, ids),
}));

const { useStore, cultos } = await import("../../store");
const initial = useStore.getState();

function lista(id: string, tocada: string, extra: Partial<Playlist> = {}): Playlist {
  return { id, nombre: id, ocasion: "", ids: [], plantilla: false, tocada, ...extra };
}

const ids = () => cultos(useStore.getState()).map((p) => p.id);

beforeEach(() => {
  enTauri = false;
  useStore.setState(initial, true);
  for (const m of [touchPlaylistCmd, updatePlaylistCmd, setPlaylistOrderCmd]) m.mockReset();
  touchPlaylistCmd.mockResolvedValue(undefined);
  setPlaylistOrderCmd.mockResolvedValue(undefined);
  useStore.setState({
    playlists: [
      lista("jovenes", "2026-09-01T10:00:00.000Z"),
      lista("domingo", "2026-09-20T10:00:00.000Z"),
      lista("cena", "2026-09-10T10:00:00.000Z"),
    ],
    plOrder: { jovenes: ["a"], domingo: [], cena: [] },
  });
});

describe("el orden de los cultos", () => {
  it("el último que se tocó, arriba", () => {
    expect(ids()).toEqual(["domingo", "cena", "jovenes"]);
  });

  it("las plantillas no son cultos", () => {
    useStore.setState((s) => ({ playlists: [...s.playlists, lista("base", "2030-01-01T00:00:00.000Z", { plantilla: true })] }));

    expect(ids()).not.toContain("base");
  });

  it("compara el instante, no el texto", () => {
    // El núcleo escribe `+00:00` y el navegador `Z`. Como texto, «…T09:00Z»
    // saldría detrás de «…T08:00+00:00» por la letra, y es una hora después.
    useStore.setState({
      playlists: [lista("nucleo", "2026-09-20T08:00:00+00:00"), lista("navegador", "2026-09-20T09:00:00.000Z")],
    });

    expect(ids()).toEqual(["navegador", "nucleo"]);
  });

  it("un empate conserva el orden que trajo el núcleo", () => {
    useStore.setState({ playlists: [lista("b", ""), lista("a", "")] });

    expect(ids()).toEqual(["b", "a"]);
  });

  it("se recuerda mientras no cambian los cultos", () => {
    // Lo leen la barra lateral y la vista de listas, que están debajo del
    // reproductor: un arreglo nuevo en cada lectura las repintaría sin motivo.
    const s = useStore.getState();
    expect(cultos(s)).toBe(cultos(s));
  });
});

describe("qué cuenta como tocar un culto", () => {
  it("abrirlo lo sube arriba", () => {
    useStore.getState().openPlaylist("jovenes");

    expect(ids()[0]).toBe("jovenes");
  });

  it("y se guarda para la próxima vez", () => {
    useStore.getState().openPlaylist("jovenes");

    expect(touchPlaylistCmd).toHaveBeenCalledWith("jovenes");
  });

  it("agregarle pistas lo sube", () => {
    useStore.getState().agregarPistas("cena", ["x"]);

    expect(ids()[0]).toBe("cena");
  });

  it("pero no si ya estaban todas: no ha cambiado nada", () => {
    useStore.getState().agregarPistas("jovenes", ["a"]);

    expect(ids()[0]).toBe("domingo");
    expect(touchPlaylistCmd).not.toHaveBeenCalled();
  });

  it("reordenarlo lo sube", () => {
    useStore.setState({ curPlaylist: "cena", plOrder: { jovenes: ["a"], domingo: [], cena: ["x", "y"] } });

    useStore.getState().moveInPlaylist("x", 1);

    expect(ids()[0]).toBe("cena");
  });

  it("cambiarle el nombre lo sube", () => {
    useStore.setState({ curPlaylist: "jovenes" });

    useStore.getState().updateList("Jóvenes", "Reunión juvenil");

    expect(ids()[0]).toBe("jovenes");
  });

  it("en la app, lo que vuelve del núcleo no lo devuelve a su sitio", async () => {
    // El núcleo contesta con una instantánea sacada antes de que el toque se
    // escriba. Aplicarla después del toque dejaría el culto donde estaba.
    enTauri = true;
    const viejo = useStore.getState().playlists;
    updatePlaylistCmd.mockResolvedValue({
      tracks: [],
      folders: [],
      playlists: viejo.map((p) => (p.id === "jovenes" ? { ...p, nombre: "Jóvenes" } : p)),
    } as unknown as Snapshot);
    useStore.setState({ curPlaylist: "jovenes" });

    useStore.getState().updateList("Jóvenes", "");

    await vi.waitFor(() => expect(useStore.getState().playlists.find((p) => p.id === "jovenes")?.nombre).toBe("Jóvenes"));
    expect(ids()[0]).toBe("jovenes");
  });

  it("un culto nuevo nace arriba", () => {
    useStore.getState().createList("Vigilia", "");

    expect(cultos(useStore.getState())[0].nombre).toBe("Vigilia");
  });
});
