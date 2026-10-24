// Las carátulas reducidas: la pasada única del núcleo avisa de las rutas
// nuevas por lotes.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaratulaNueva } from "../api";
import type { Track } from "../types";

function pista(id: string, over: Partial<Track> = {}): Track {
  return { id, titulo: `T${id}`, artista: "", album: "", dur: "3:00", durSec: 180, formato: "MP3", carpeta: "Himnos", fav: false, missing: false, singers: [], added: 0, path: `/m/${id}.mp3`, ...over };
}

let oyente: ((lote: CaratulaNueva[]) => void) | null = null;

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  registrar: () => {},
  assetUrl: (p: string) => `asset://${p}`,
  onScanProgress: () => Promise.resolve(() => {}),
  onCaratulasReducidas: (cb: (lote: CaratulaNueva[]) => void) => {
    oyente = cb;
    return Promise.resolve(() => (oyente = null));
  },
}));

const { useStore } = await import("../../store");
const initial = useStore.getState();

describe("la pasada que reduce las carátulas", () => {
  beforeEach(() => {
    useStore.setState(initial, true);
    oyente = null;
  });

  it("cambia solo las pistas del lote y deja las demás como estaban", async () => {
    const tracks = [pista("1", { cover: "asset:///c/1.jpg" }), pista("2", { cover: "asset:///c/2.jpg" }), pista("3")];
    useStore.setState({ tracks });
    const soltar = await useStore.getState().escucharEscaneo();

    oyente!([{ id: "1", cover: "/c/a-0123456789abcdef.jpg" }, { id: "99", cover: "/c/x.jpg" }]);

    const ahora = useStore.getState().tracks;
    expect(ahora[0].cover).toBe("asset:///c/a-0123456789abcdef.jpg");
    expect(ahora[1]).toBe(tracks[1]);
    expect(ahora[2]).toBe(tracks[2]);

    // Un lote que no cambia nada no escribe el catálogo.
    const antes = useStore.getState().tracks;
    oyente!([{ id: "1", cover: "/c/a-0123456789abcdef.jpg" }]);
    expect(useStore.getState().tracks).toBe(antes);

    soltar();
    expect(oyente).toBeNull();
  });
});
