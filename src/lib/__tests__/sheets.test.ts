// Las hojas no viajan con el catálogo: se piden cuando alguien va a leerlas y
// se guardan solas mientras se escriben. Lo que se fija aquí es que no se pidan
// dos veces, que lo que se escribe no se pierda, y que el modo culto no lleve a
// una canción el tono que se eligió para la anterior.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Sheet, Snapshot } from "../api";
import type { Track } from "../types";

const getTrackSheet = vi.fn<(id: string) => Promise<Sheet | null>>();
const getSheets = vi.fn<(ids: string[]) => Promise<Sheet[] | null>>();
const updateTrackSheet = vi.fn<(id: string, letra: string, acordes: string) => Promise<void>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  assetUrl: (p: string) => p,
  getTrackSheet: (id: string) => getTrackSheet(id),
  getSheets: (ids: string[]) => getSheets(ids),
  updateTrackSheet: (id: string, letra: string, acordes: string) => updateTrackSheet(id, letra, acordes),
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
    bpm: 80,
    ocasion: "Adoración",
    formato: "MP3",
    carpeta: "Himnos",
    fav: false,
    missing: false,
    tieneHoja: false,
    added: 1,
    ...over,
  };
}

const LISTA = ["a", "b", "c"];

function conLista() {
  useStore.setState({
    tracks: LISTA.map((id) => track(id)),
    playlists: [{ id: "p1", nombre: "Culto", fecha: "", ocasion: "", ids: LISTA, plantilla: false }],
    plOrder: { p1: LISTA },
    curPlaylist: "p1",
    playerId: "",
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  useStore.setState(initial, true);
  for (const m of [getTrackSheet, getSheets, updateTrackSheet]) m.mockReset();
  getTrackSheet.mockResolvedValue({ trackId: "a", letra: "Aleluya", acordes: "[Sol]Aleluya" });
  getSheets.mockResolvedValue([]);
  updateTrackSheet.mockResolvedValue(undefined);
});

afterEach(() => {
  // El debounce vive en el módulo y dispararía dentro de la prueba siguiente.
  useStore.getState().flushSheet();
  vi.useRealTimers();
});

describe("pedir una hoja", () => {
  it("la trae una vez y no vuelve a preguntar", async () => {
    useStore.getState().loadSheet("a");
    await vi.runOnlyPendingTimersAsync();
    expect(useStore.getState().sheets.a.letra).toBe("Aleluya");

    useStore.getState().loadSheet("a");
    await vi.runOnlyPendingTimersAsync();

    expect(getTrackSheet).toHaveBeenCalledTimes(1);
  });

  it("recuerda también las pistas que no tienen nada escrito", async () => {
    // El backend solo devuelve las que tienen algo; sin esto, cada vista de una
    // pista vacía volvería a preguntar por ella para siempre.
    getSheets.mockResolvedValue([{ trackId: "b", letra: "Algo", acordes: "" }]);

    await useStore.getState().loadSheets(["a", "b"]);

    expect(useStore.getState().sheets.a).toEqual({ trackId: "a", letra: "", acordes: "" });
    expect(useStore.getState().sheets.b.letra).toBe("Algo");
  });

  it("solo pide las que faltan", async () => {
    await useStore.getState().loadSheets(["a"]);
    getSheets.mockClear();

    await useStore.getState().loadSheets(["a", "b"]);

    expect(getSheets).toHaveBeenCalledWith(["b"]);
  });
});

describe("escribir una hoja", () => {
  beforeEach(() => {
    // Una pista sin nada escrito, que es de donde se parte al escribir.
    getTrackSheet.mockResolvedValue({ trackId: "a", letra: "", acordes: "" });
    useStore.setState({ tracks: [track("a")], sheets: { a: { trackId: "a", letra: "", acordes: "" } } });
    useStore.getState().openSheetEditor("a");
  });

  it("agrupa el tecleo en una sola escritura, con el texto final", async () => {
    useStore.getState().setSheet("acordes", "[So");
    useStore.getState().setSheet("acordes", "[Sol");
    useStore.getState().setSheet("acordes", "[Sol]Santo");

    expect(updateTrackSheet).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);

    expect(updateTrackSheet).toHaveBeenCalledTimes(1);
    expect(updateTrackSheet.mock.calls[0][2]).toBe("[Sol]Santo");
  });

  it("enciende el indicador del catálogo sin esperar al backend", () => {
    useStore.getState().setSheet("letra", "Aleluya");

    // El catálogo solo lleva la bandera, y la vista que la muestra está abierta.
    expect(useStore.getState().tracks[0].tieneHoja).toBe(true);
  });

  it("lo apaga cuando la hoja se queda en blanco", () => {
    useStore.getState().setSheet("letra", "Aleluya");
    expect(useStore.getState().tracks[0].tieneHoja).toBe(true);

    // Solo saltos de línea: abrir el editor y volver a cerrarlo no cuenta como
    // haber escrito algo.
    useStore.getState().setSheet("letra", "   \n  ");

    expect(useStore.getState().tracks[0].tieneHoja).toBe(false);
  });

  it("escribe lo pendiente al cerrar el editor", () => {
    useStore.getState().setSheet("letra", "Aleluya");

    useStore.getState().closeSheetEditor();

    expect(updateTrackSheet).toHaveBeenCalledOnce();
    expect(useStore.getState().sheetDialog).toBeNull();
  });

  it("no se disfraza un fallo de guardado", async () => {
    updateTrackSheet.mockRejectedValue(new Error("disco lleno"));

    useStore.getState().setSheet("letra", "Aleluya");
    await vi.advanceTimersByTimeAsync(600);

    expect(useStore.getState().sheetState).toBe("error");
    // Y lo escrito sigue en pantalla: quitárselo sería perder su trabajo.
    expect(useStore.getState().sheets.a.letra).toBe("Aleluya");
  });
});

describe("modo culto", () => {
  beforeEach(conLista);

  it("arranca en la canción que está sonando, si es de esta lista", () => {
    useStore.setState({ playerId: "c" });

    useStore.getState().openService();

    expect(useStore.getState().serviceIdx).toBe(2);
    expect(useStore.getState().serviceOpen).toBe(true);
  });

  it("arranca por el principio si lo que suena no es de la lista", () => {
    useStore.setState({ playerId: "otra" });

    useStore.getState().openService();

    expect(useStore.getState().serviceIdx).toBe(0);
  });

  it("no se abre sobre una lista vacía", () => {
    useStore.setState({ plOrder: { p1: [] } });

    useStore.getState().openService();

    expect(useStore.getState().serviceOpen).toBe(false);
    expect(useStore.getState().toast?.titulo).toMatch(/vacía/i);
  });

  it("no se pasa de los extremos de la lista", () => {
    useStore.getState().openService();

    useStore.getState().serviceGo(-1);
    expect(useStore.getState().serviceIdx).toBe(0);

    useStore.getState().serviceGo(5);
    expect(useStore.getState().serviceIdx).toBe(2);
  });

  it("mantiene el tamaño de letra dentro de lo legible", () => {
    for (let i = 0; i < 40; i++) useStore.getState().scaleService(0.1);
    expect(useStore.getState().serviceScale).toBe(2.4);

    for (let i = 0; i < 40; i++) useStore.getState().scaleService(-0.1);
    expect(useStore.getState().serviceScale).toBe(0.7);
  });

  it("pide las hojas de toda la lista al abrirse", () => {
    useStore.getState().openService();

    expect(getSheets).toHaveBeenCalledWith(LISTA);
  });
});
