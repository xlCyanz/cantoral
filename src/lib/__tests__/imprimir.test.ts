// Abrir la vista previa de impresión de un culto.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Snapshot } from "../api";
import type { Track } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  assetUrl: (p: string) => p,
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
    formato: "MP3",
    carpeta: "Himnos",
    fav: false,
    missing: false,
    added: 1,
    ...over,
  };
}

function conLista(ids: string[] = ["a", "b"]) {
  useStore.setState({
    tracks: [track("a"), track("b")],
    playlists: [{ id: "p1", nombre: "Culto", tocada: "", ids, plantilla: false }],
    plOrder: { p1: ids },
    curPlaylist: "p1",
    view: "lista",
  });
}

beforeEach(() => {
  useStore.setState(initial, true);
  conLista();
});

describe("abrir la vista previa", () => {
  it("se abre sobre la lista abierta", () => {
    useStore.getState().openPrintPreview();

    expect(useStore.getState().dialog).toBe("printPreview");
  });

  it("una lista vacía no se imprime, y lo dice", () => {
    conLista([]);

    useStore.getState().openPrintPreview();

    expect(useStore.getState().dialog).toBeNull();
    expect(useStore.getState().toast?.titulo).toContain("vacía");
  });

  it("una lista cuyas pistas ya no están tampoco", () => {
    // El orden guardado puede apuntar a pistas que desaparecieron del
    // catálogo; la hoja saldría en blanco.
    useStore.setState({ tracks: [] });

    useStore.getState().openPrintPreview();

    expect(useStore.getState().dialog).toBeNull();
    expect(useStore.getState().toast?.titulo).toContain("vacía");
  });

  it("sin lista abierta no hace nada", () => {
    useStore.setState({ curPlaylist: "no-existe" });

    useStore.getState().openPrintPreview();

    expect(useStore.getState().dialog).toBeNull();
  });
});
