// La vista previa se abre antes de pedir las letras: la tabla ya es la hoja
// entera para una lista sin nada escrito, y esperar una ida y vuelta al núcleo
// para enseñarla haría que el botón pareciera roto.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sheet, Snapshot } from "../api";
import type { Track } from "../types";

const getSheets = vi.fn<(ids: string[]) => Promise<Sheet[] | null>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  assetUrl: (p: string) => p,
  getSheets: (ids: string[]) => getSheets(ids),
  getTrackSheet: () => Promise.resolve(null),
  getLibrary: (): Promise<Snapshot | null> => Promise.resolve(null),
}));

const { useStore } = await import("../../store");
const initial = useStore.getState();

function track(id: string, over: Partial<Track> = {}): Track {
  return {
    id,
    titulo: `Pista ${id}`,
    artista: "Coro",
    album: "Album",
    dur: "3:00",
    durSec: 180,
    tono: "Sol",
    bpm: 80,
    ocasion: "Adoración",
    formato: "MP3",
    carpeta: "Himnos",
    tags: [],
    fav: false,
    missing: false,
    tieneHoja: false,
    added: 1,
    ...over,
  };
}

function conLista(ids: string[] = ["a", "b"]) {
  useStore.setState({
    tracks: [track("a"), track("b")],
    playlists: [{ id: "p1", nombre: "Culto", fecha: "", ocasion: "", ids, plantilla: false }],
    plOrder: { p1: ids },
    curPlaylist: "p1",
    view: "lista",
    sheets: {},
  });
}

beforeEach(() => {
  useStore.setState(initial, true);
  getSheets.mockReset();
  getSheets.mockResolvedValue([]);
  conLista();
});

describe("abrir la vista previa", () => {
  it("se abre sin esperar a las letras", () => {
    // Sin `await`: la comprobación es justo que no hace falta.
    useStore.getState().openPrintPreview();

    expect(useStore.getState().dialog).toBe("printPreview");
  });

  it("pide las letras de la lista, en su orden", async () => {
    useStore.getState().openPrintPreview();

    await vi.waitFor(() => expect(getSheets).toHaveBeenCalledWith(["a", "b"]));
  });

  it("si las letras no llegan, lo dice y la vista previa sigue abierta", async () => {
    // La tabla es lo que lee quien dirige el culto; las letras son un extra.
    // Pero imprimir sin ellas sin avisar sería enterarse en el atril.
    getSheets.mockRejectedValue(new Error("base bloqueada"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    useStore.getState().openPrintPreview();

    await vi.waitFor(() => expect(useStore.getState().toast?.type).toBe("error"));
    expect(useStore.getState().toast?.message).toContain("No se pudieron leer las letras");
    expect(useStore.getState().dialog).toBe("printPreview");
  });

  it("una lista vacía no se imprime, y lo dice", () => {
    conLista([]);

    useStore.getState().openPrintPreview();

    expect(useStore.getState().dialog).toBeNull();
    expect(useStore.getState().toast?.message).toContain("vacía");
    expect(getSheets).not.toHaveBeenCalled();
  });

  it("una lista cuyas pistas ya no están tampoco", () => {
    // El orden guardado puede apuntar a pistas que desaparecieron del
    // catálogo; la hoja saldría en blanco.
    useStore.setState({ tracks: [] });

    useStore.getState().openPrintPreview();

    expect(useStore.getState().dialog).toBeNull();
    expect(useStore.getState().toast?.message).toContain("vacía");
  });

  it("sin lista abierta no hace nada", () => {
    useStore.setState({ curPlaylist: "no-existe" });

    useStore.getState().openPrintPreview();

    expect(useStore.getState().dialog).toBeNull();
  });
});

describe("qué se imprime", () => {
  it("arranca sin letras, que es la hoja del que dirige", () => {
    expect(useStore.getState().printWithLyrics).toBe(false);
  });

  it("la elección se queda puesta entre una impresión y otra", () => {
    // Quien imprime para el atril imprime para el atril todas las semanas.
    useStore.getState().setPrintWithLyrics(true);
    useStore.getState().closeDialog();

    useStore.getState().openPrintPreview();

    expect(useStore.getState().printWithLyrics).toBe(true);
  });
});
