// Lo que se guarda entre sesiones sale de un archivo que el usuario pudo haber
// restaurado desde otra versión de la app, así que nada se aplica sin mirarlo.
// Y lo que se escribe tiene que salir de donde el usuario lo cambió, no de una
// lista de acciones que alguien recuerde actualizar.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Reconciliacion, Snapshot } from "../api";
import { UI_PREFS_KEY, parsePrefs, resolveView, serialisePrefs } from "../uiPrefs";
import type { UiPrefs } from "../uiPrefs";

const getSetting = vi.fn<(key: string) => Promise<string | null>>();
const setSetting = vi.fn<(key: string, value: string) => Promise<void>>();
const getLibrary = vi.fn<() => Promise<Snapshot | null>>();
const reconcileLibraryCmd = vi.fn<() => Promise<Reconciliacion | null>>();

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
  repeat: "una",
  sortKey: "album",
  sortDir: "desc",
  groupBy: "carpeta",
  view: "colecciones",
  curPlaylist: "p2",
  densidad: "compacta",
  buscarActualizacionesAlAbrir: false,
  pantallaProyeccion: { sistema: "DELL P2219H", ancho: 1920, alto: 1080, x: 2560, y: 0 },
  tamanoUi: "muyGrande",
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
      densidad: "apretadísima",
      shuffle: true,
    });

    // Only the one field that held up survives; the rest fall back to defaults.
    expect(parsePrefs(raro)).toEqual({ shuffle: true });
  });

  it("olvida el orden por BPM que guardó una versión anterior (#141)", () => {
    // Ya no hay columna que lo active ni forma de verlo: la biblioteca vuelve
    // al orden por defecto en vez de quedarse ordenada por un campo invisible.
    expect(parsePrefs(JSON.stringify({ sortKey: "bpm", sortDir: "desc" }))).toEqual({ sortDir: "desc" });
  });

  it("olvida el orden y el agrupado por ocasión de una versión anterior", () => {
    // La ocasión salió de la app: la biblioteca vuelve al orden y al agrupado
    // por defecto en vez de quedarse sobre un campo que ya no se ve.
    expect(parsePrefs(JSON.stringify({ sortKey: "ocasion", groupBy: "ocasion", sortDir: "desc" }))).toEqual({
      sortDir: "desc",
    });
  });

  it("olvida los ajustes de la vista de Proyección de una versión anterior", () => {
    // La vista se fue: el proyector solo enseña el video que suena. Lo que
    // guardó una versión de antes se ignora sin quejarse, y lo demás se lee.
    const viejo = JSON.stringify({
      salidaDeAudio: "portada",
      transicionProyeccion: "cuenta",
      avanceProyeccion: "siguiente",
      densidad: "compacta",
    });
    expect(parsePrefs(viejo)).toEqual({ densidad: "compacta" });
  });

  it("y quien cerró la app en Proyección vuelve a la biblioteca", () => {
    expect(parsePrefs(JSON.stringify({ view: "proyeccion", volume: 0.5 }))).toEqual({ volume: 0.5 });
    expect(serialisePrefs(GUARDADAS)).not.toMatch(/salidaDeAudio|transicionProyeccion|avanceProyeccion/);
  });

  it("y olvida «con letras» de la hoja impresa", () => {
    expect(parsePrefs(JSON.stringify({ printWithLyrics: true }))).toEqual({});
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
    const con_extras = JSON.stringify({ volume: 0.5, query: "santo", qf: "fav" });

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

  it("ya no guarda si los videos se proyectan: siempre se proyectan", () => {
    // Un «apagado» guardado por una versión anterior se ignora al leerlo.
    expect(parsePrefs(JSON.stringify({ proyectarVideos: false }))).toEqual({});
  });

  it("recoge el cambio venga de donde venga", async () => {
    useStore.getState().toggleShuffle();
    useStore.getState().onGroupBy("album");
    useStore.getState().onSortHeader("dur");
    await vi.advanceTimersByTimeAsync(400);

    const g = ultimoGuardado();
    expect(g.shuffle).toBe(true);
    expect(g.groupBy).toBe("album");
    expect(g.sortKey).toBe("dur");
  });

  it("recuerda la densidad: se elige una vez y vale para siempre", async () => {
    // La densidad no es un filtro, es cómo alguien quiere ver la tabla. Que se
    // olvide al cerrar la app significaría volver a elegirla cada domingo.
    useStore.getState().setDensidad("compacta");
    await vi.advanceTimersByTimeAsync(400);

    expect(ultimoGuardado().densidad).toBe("compacta");
  });

  it("recuerda si se busca actualizaciones al abrir (#146)", async () => {
    // Si no se guardara, la iglesia que la apaga por su política de red
    // volvería a hacer la petición en la siguiente apertura.
    useStore.getState().setBuscarActualizacionesAlAbrir(false);
    await vi.advanceTimersByTimeAsync(400);

    expect(ultimoGuardado().buscarActualizacionesAlAbrir).toBe(false);
  });

  it("no guarda los filtros de la biblioteca", async () => {
    useStore.getState().onQuery("santo");
    useStore.getState().onQuickFilter("fav");
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
        { id: "p1", nombre: "Uno", tocada: "", ids: [] },
        { id: "p2", nombre: "Dos", tocada: "", ids: [] },
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
    expect(s.repeat).toBe("una");
    expect(s.sortKey).toBe("album");
    expect(s.sortDir).toBe("desc");
    expect(s.groupBy).toBe("carpeta");
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
