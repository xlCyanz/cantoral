// Las colas de fondo (miniaturas y duraciones de los videos) terminan un video
// cada poco. Cada resultado reescribía el catálogo entero y, como sus hooks
// colgaban de `App`, volvía a pintar la app completa. Lo que se fija aquí:
// que los resultados se junten en una escritura, que lo que piden los hooks
// en cada cambio del store no recorra el catálogo si no cambió, y que nada
// empiece antes de que el arranque termine.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Snapshot } from "../api";
import type { Track } from "../types";

const getLibrary = vi.fn<() => Promise<Snapshot | null>>();
const reconcileLibraryCmd = vi.fn<() => Promise<Snapshot | null>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  assetUrl: (p: string) => p,
  registrar: () => {},
  getSetting: () => Promise.resolve(null),
  setSetting: () => Promise.resolve(),
  getLibrary: () => getLibrary(),
  reconcileLibraryCmd: () => reconcileLibraryCmd(),
}));

const { useStore } = await import("../../store");
const { LOTE_MS, claveDe, crearLote, loteDePistas } = await import("../lote");
const { pendientesDeMiniatura } = await import("../miniaturas");
const { pendientesDeDuracion } = await import("../videoDurations");
const initial = useStore.getState();

function video(id: string, over: Partial<Track> = {}): Track {
  return {
    id,
    titulo: `Video ${id}`,
    artista: "",
    album: "",
    dur: "0:00",
    durSec: 0,
    formato: "MP4",
    carpeta: "Videos",
    fav: false,
    missing: false,
    added: 0,
    path: `/v/${id}.mp4`,
    video: true,
    ...over,
  };
}

afterEach(() => {
  vi.useRealTimers();
  useStore.setState(initial, true);
});

describe("los resultados se escriben juntos", () => {
  it("diez miniaturas seguidas son una sola escritura del catálogo", () => {
    vi.useFakeTimers();
    const pistas = Array.from({ length: 10 }, (_, i) => video(String(i)));
    useStore.setState({ tracks: pistas });
    let escrituras = 0;
    const soltar = useStore.subscribe(() => escrituras++);
    const lote = loteDePistas<string>((t, cover) => ({ ...t, cover }));

    for (const t of pistas) {
      lote.poner(claveDe(t.id, t.path!), `/covers/${t.id}.jpg`);
      vi.advanceTimersByTime(100);
    }
    // Antes: diez escrituras, una por video, cada una con la app repintándose.
    expect(escrituras).toBe(0);
    vi.advanceTimersByTime(LOTE_MS);
    soltar();

    expect(escrituras).toBe(1);
    expect(useStore.getState().tracks.map((t) => t.cover)).toEqual(pistas.map((t) => `/covers/${t.id}.jpg`));
  });

  it("no aplica un resultado a una pista que cambió de archivo", () => {
    vi.useFakeTimers();
    useStore.setState({ tracks: [video("a", { path: "/nuevo.mp4" })] });
    const antes = useStore.getState().tracks;
    const lote = loteDePistas<number>((t, dur) => ({ ...t, durSec: dur }));

    lote.poner(claveDe("a", "/v/a.mp4"), 90);
    vi.advanceTimersByTime(LOTE_MS);

    expect(useStore.getState().tracks).toBe(antes);
  });

  it("lo que llega después de entregar va en el lote siguiente", () => {
    const entregas: string[][] = [];
    const programados: (() => void)[] = [];
    const lote = crearLote<number>((l) => entregas.push([...l.keys()]), 10, (fn) => programados.push(fn));

    lote.poner("a", 1);
    lote.poner("b", 2);
    lote.poner("a", 3);
    expect(programados).toHaveLength(1);
    programados.shift()!();
    lote.poner("c", 4);
    programados.shift()!();

    expect(entregas).toEqual([["a", "b"], ["c"]]);
  });
});

describe("lo que piden los hooks en cada cambio del store", () => {
  it("con el mismo catálogo devuelve lo mismo sin recorrerlo", () => {
    const tracks = [video("a"), video("b", { cover: "/c.jpg", durSec: 30 })];
    const filtro = vi.spyOn(tracks, "filter");

    const primero = pendientesDeMiniatura(tracks);
    expect(pendientesDeMiniatura(tracks)).toBe(primero);
    expect(pendientesDeDuracion(tracks)).toBe(pendientesDeDuracion(tracks));
    // Una vez por selector, no una por llamada.
    expect(filtro).toHaveBeenCalledTimes(2);
    expect(primero).toBe("a:/v/a.mp4");
  });
});

describe("nada empieza antes de que termine el arranque", () => {
  it("el arranque está listo cuando la biblioteca se reconcilió, no al cargarla", async () => {
    let reconciliar!: (s: Snapshot | null) => void;
    getLibrary.mockResolvedValue({ tracks: [video("a")], folders: [], playlists: [] });
    reconcileLibraryCmd.mockReturnValue(new Promise((r) => (reconciliar = r)));

    await useStore.getState().hydrate();
    expect(useStore.getState().libState).toBe("content");
    expect(useStore.getState().arranqueListo).toBe(false);

    reconciliar(null);
    await new Promise((r) => setTimeout(r, 0));
    expect(useStore.getState().arranqueListo).toBe(true);
  });

  it("y también si la reconciliación falla", async () => {
    getLibrary.mockResolvedValue({ tracks: [], folders: [], playlists: [] });
    reconcileLibraryCmd.mockRejectedValue(new Error("usb"));

    await useStore.getState().hydrate();
    await new Promise((r) => setTimeout(r, 0));

    expect(useStore.getState().arranqueListo).toBe(true);
  });
});
