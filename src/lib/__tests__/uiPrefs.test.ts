// Lo que se guarda entre sesiones sale de un archivo que el usuario pudo haber
// restaurado desde otra versión de la app, así que nada se aplica sin mirarlo.
// Y lo que se escribe tiene que salir de donde el usuario lo cambió, no de una
// lista de acciones que alguien recuerde actualizar.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Snapshot } from "../api";
import { UI_PREFS_KEY, parsePrefs, resolveView, serialisePrefs } from "../uiPrefs";
import type { UiPrefs } from "../uiPrefs";

const getSetting = vi.fn<(key: string) => Promise<string | null>>();
const setSetting = vi.fn<(key: string, value: string) => Promise<void>>();
const getLibrary = vi.fn<() => Promise<Snapshot | null>>();
const reconcileLibraryCmd = vi.fn<() => Promise<Snapshot | null>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  assetUrl: (p: string) => p,
  getSetting: (k: string) => getSetting(k),
  setSetting: (k: string, v: string) => setSetting(k, v),
  getLibrary: () => getLibrary(),
  reconcileLibraryCmd: () => reconcileLibraryCmd(),
}));

const { useStore, flushUiPrefs } = await import("../../store");
const initial = useStore.getState();

const GUARDADAS: UiPrefs = {
  volume: 0.2,
  muted: true,
  shuffle: true,
  repeat: true,
  sortKey: "album",
  sortDir: "desc",
  groupBy: "ocasion",
  view: "colecciones",
  curPlaylist: "p2",
};

/** What `setSetting` was last asked to store under the ui key. */
function ultimoGuardado(): Partial<UiPrefs> {
  const llamadas = setSetting.mock.calls.filter(([k]) => k === UI_PREFS_KEY);
  return JSON.parse(llamadas[llamadas.length - 1][1]) as Partial<UiPrefs>;
}

describe("parsePrefs", () => {
  it("reads back what serialisePrefs wrote", () => {
    expect(parsePrefs(serialisePrefs(GUARDADAS))).toEqual(GUARDADAS);
  });

  it("gives up quietly on something that is not even JSON", () => {
    // A preference that cannot be read is worth losing. Failing startup is not.
    expect(parsePrefs("{rota")).toEqual({});
    expect(parsePrefs("null")).toEqual({});
    expect(parsePrefs("[1,2]")).toEqual({});
    expect(parsePrefs(null)).toEqual({});
    expect(parsePrefs("")).toEqual({});
  });

  it("drops a field whose value is not one the app knows", () => {
    const raro = JSON.stringify({
      sortKey: "colorFavorito",
      sortDir: "arriba",
      groupBy: "banda",
      view: "karaoke",
      muted: "sí",
      volume: "alto",
      curPlaylist: 7,
      shuffle: true,
    });

    // Only the one field that held up survives; the rest fall back to defaults.
    expect(parsePrefs(raro)).toEqual({ shuffle: true });
  });

  it("clamps a volume outside the range instead of dropping it", () => {
    // Whoever stored 1.4 meant «as loud as it goes»; starting at 0.72 would be
    // a worse answer than either end of the range.
    expect(parsePrefs('{"volume":1.4}')).toEqual({ volume: 1 });
    expect(parsePrefs('{"volume":-3}')).toEqual({ volume: 0 });
    expect(parsePrefs('{"volume":0.35}')).toEqual({ volume: 0.35 });
  });

  it("refuses a volume that is not a real number", () => {
    expect(parsePrefs('{"volume":null}')).toEqual({});
    // JSON has no NaN, but a hand-edited file can carry a string.
    expect(parsePrefs('{"volume":"0.5"}')).toEqual({});
  });

  it("keeps nothing it was not asked to keep", () => {
    const con_extras = JSON.stringify({ volume: 0.5, query: "santo", qf: "fav", ocasion: "Navidad" });

    // Opening the app with the library filtered and no memory of why is worse
    // than not remembering the filter at all.
    expect(parsePrefs(con_extras)).toEqual({ volume: 0.5 });
  });
});

describe("resolveView", () => {
  const listas = [{ id: "p1" }, { id: "p2" }];

  it("reopens the list the user left open", () => {
    expect(resolveView({ view: "lista", curPlaylist: "p2" }, listas)).toEqual({
      view: "lista",
      curPlaylist: "p2",
    });
  });

  it("lands on the library when that list no longer exists", () => {
    // Deleted, or belonging to a library restored from somewhere else. An
    // empty list view with no way of telling why is the worst outcome.
    expect(resolveView({ view: "lista", curPlaylist: "borrada" }, listas)).toEqual({
      view: "biblioteca",
    });
  });

  it("leaves the other views alone even when the list is gone", () => {
    expect(resolveView({ view: "config", curPlaylist: "borrada" }, listas)).toEqual({
      view: "config",
    });
  });

  it("says nothing about a view it was never given", () => {
    expect(resolveView({}, listas)).toEqual({});
  });
});

describe("guardar los cambios", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setSetting.mockResolvedValue(undefined);
    // Resetting the store moves the preference fields, which the watcher sees
    // like any other change. Drain that before the test starts counting.
    useStore.setState(initial, true);
    flushUiPrefs();
    setSetting.mockClear();
    getSetting.mockReset();
    getSetting.mockResolvedValue(null);
    getLibrary.mockReset();
    getLibrary.mockResolvedValue({ tracks: [], folders: [], playlists: [] });
    reconcileLibraryCmd.mockReset();
    reconcileLibraryCmd.mockResolvedValue(null);
  });

  afterEach(() => {
    // The debounce lives in module scope and would otherwise fire inside the
    // next test's mock.
    flushUiPrefs();
    vi.useRealTimers();
  });

  it("escribe el volumen después del debounce, no en cada píxel arrastrado", async () => {
    useStore.getState().setVolume(0.1);
    useStore.getState().setVolume(0.2);
    useStore.getState().setVolume(0.3);

    expect(setSetting).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);

    expect(setSetting.mock.calls.filter(([k]) => k === UI_PREFS_KEY)).toHaveLength(1);
    expect(ultimoGuardado().volume).toBe(0.3);
  });

  it("recoge el cambio venga de donde venga", async () => {
    useStore.getState().toggleShuffle();
    useStore.getState().onGroupBy("album");
    useStore.getState().onSortHeader("tono");
    await vi.advanceTimersByTimeAsync(400);

    const g = ultimoGuardado();
    expect(g.shuffle).toBe(true);
    expect(g.groupBy).toBe("album");
    expect(g.sortKey).toBe("tono");
  });

  it("no guarda los filtros de la biblioteca", async () => {
    useStore.getState().onQuery("santo");
    useStore.getState().onQuickFilter("fav");
    useStore.getState().onOcasion("Navidad");
    await vi.advanceTimersByTimeAsync(400);

    expect(setSetting.mock.calls.filter(([k]) => k === UI_PREFS_KEY)).toHaveLength(0);
  });

  it("escribe de inmediato si la ventana se cierra a medio debounce", () => {
    // Bajar el volumen y cerrar es exactamente la secuencia por la que existe
    // todo esto; no puede ser la que se pierda.
    useStore.getState().setVolume(0.05);
    expect(setSetting).not.toHaveBeenCalled();

    flushUiPrefs();

    expect(ultimoGuardado().volume).toBe(0.05);
  });

  it("no escribe nada si no hay nada esperando", () => {
    flushUiPrefs();
    expect(setSetting).not.toHaveBeenCalled();
  });
});

describe("restaurar al arrancar", () => {
  beforeEach(() => {
    setSetting.mockResolvedValue(undefined);
    useStore.setState(initial, true);
    flushUiPrefs();
    setSetting.mockClear();
    getSetting.mockReset();
    getSetting.mockImplementation((k) =>
      Promise.resolve(k === UI_PREFS_KEY ? serialisePrefs(GUARDADAS) : null),
    );
    getLibrary.mockReset();
    getLibrary.mockResolvedValue({
      tracks: [],
      folders: [],
      playlists: [
        { id: "p1", nombre: "Uno", fecha: "", ocasion: "", ids: [], plantilla: false },
        { id: "p2", nombre: "Dos", fecha: "", ocasion: "", ids: [], plantilla: false },
      ],
    });
    reconcileLibraryCmd.mockReset();
    reconcileLibraryCmd.mockResolvedValue(null);
  });

  afterEach(() => {
    flushUiPrefs();
    useStore.setState(initial, true);
  });

  it("deja la interfaz como el usuario la dejó", async () => {
    await useStore.getState().hydrate();

    const s = useStore.getState();
    expect(s.volume).toBe(0.2);
    expect(s.muted).toBe(true);
    expect(s.shuffle).toBe(true);
    expect(s.repeat).toBe(true);
    expect(s.sortKey).toBe("album");
    expect(s.sortDir).toBe("desc");
    expect(s.groupBy).toBe("ocasion");
    expect(s.view).toBe("colecciones");
    expect(s.curPlaylist).toBe("p2");
  });

  it("no vuelve a escribir lo que acaba de leer", async () => {
    vi.useFakeTimers();
    await useStore.getState().hydrate();
    // Incluido el guardado que `applySnapshot` deja programado al elegir lista
    // por su cuenta: lo restaurado es más nuevo que eso.
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();

    expect(setSetting.mock.calls.filter(([k]) => k === UI_PREFS_KEY)).toHaveLength(0);
  });

  it("no abre una lista que ya no está", async () => {
    getSetting.mockImplementation((k) =>
      Promise.resolve(
        k === UI_PREFS_KEY ? serialisePrefs({ ...GUARDADAS, view: "lista", curPlaylist: "borrada" }) : null,
      ),
    );

    await useStore.getState().hydrate();

    expect(useStore.getState().view).toBe("biblioteca");
  });
});
