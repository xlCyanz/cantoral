// Las carátulas reducidas: la pasada única del núcleo avisa de las rutas
// nuevas por lotes, y la proyección usa la versión mediana cuando la hay.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaratulaNueva } from "../api";
import type { Track } from "../types";
import { caratulaGrande } from "../covers";

function pista(id: string, over: Partial<Track> = {}): Track {
  return { id, titulo: `T${id}`, artista: "", album: "", dur: "3:00", durSec: 180, formato: "MP3", carpeta: "Himnos", fav: false, missing: false, added: 0, path: `/m/${id}.mp3`, ...over };
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

describe("la carátula de la proyección", () => {
  it("usa la mediana de una carátula reducida, en ruta o en URL de asset", () => {
    expect(caratulaGrande("/c/covers/a-0123456789abcdef.jpg")).toBe("/c/covers/a-0123456789abcdef-g.jpg");
    expect(caratulaGrande("http://asset.localhost/C%3A%5Ccovers%5Ca-0123456789abcdef.jpg")).toBe(
      "http://asset.localhost/C%3A%5Ccovers%5Ca-0123456789abcdef-g.jpg",
    );
    expect(caratulaGrande("asset://localhost/%2Fc%2Fcovers%2Fa-0123456789abcdef.jpg")).toBe(
      "asset://localhost/%2Fc%2Fcovers%2Fa-0123456789abcdef-g.jpg",
    );
  });

  it("deja como está una miniatura de video o una carátula de antes", () => {
    expect(caratulaGrande("/c/covers/12.jpg")).toBe("/c/covers/12.jpg");
    expect(caratulaGrande("/c/covers/a-0123456789abcdef-g.jpg")).toBe("/c/covers/a-0123456789abcdef-g.jpg");
    expect(caratulaGrande("/c/mi-a-0123456789abcdef.jpg")).toBe("/c/mi-a-0123456789abcdef.jpg");
  });
});
