// Un escaneo corre junto a la biblioteca, no encima de ella. Lo que se fija
// aquí es que `libState` y la vista sobrevivan al escaneo, que la carpeta a
// pantalla completa quede solo para cuando no hay nada detrás, y que las pistas
// ya indexadas aparezcan sin esperar al final.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Novedades, Snapshot } from "../api";
import type { Track } from "../types";

const getLibrary = vi.fn<() => Promise<Snapshot | null>>();
const getTracksSince = vi.fn<(after: string) => Promise<Novedades | null>>();
const addAndScanFolder = vi.fn<(path: string, recursive: boolean) => Promise<Snapshot>>();
const rescanFolderCmd = vi.fn<(id: string) => Promise<Snapshot>>();
const cancelScanCmd = vi.fn<() => Promise<void>>();
const updateTrackCmd = vi.fn<() => Promise<void>>();
const removeFolderCmd = vi.fn<(id: string) => Promise<Snapshot>>();
const relocateFolderCmd = vi.fn<(id: string, path: string) => Promise<Snapshot>>();
const restoreDatabaseCmd = vi.fn<(src: string) => Promise<Snapshot>>();
const pickFolder = vi.fn<() => Promise<string | null>>();
const pickDbFile = vi.fn<() => Promise<string | null>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  // The store decides at module-eval time whether it is running under Tauri;
  // without this it would load the browser seed and never call a command.
  isTauri: () => true,
  getLibrary: () => getLibrary(),
  getTracksSince: (after: string) => getTracksSince(after),
  addAndScanFolder: (path: string, recursive: boolean) => addAndScanFolder(path, recursive),
  rescanFolderCmd: (id: string) => rescanFolderCmd(id),
  cancelScanCmd: () => cancelScanCmd(),
  updateTrackCmd: () => updateTrackCmd(),
  removeFolderCmd: (id: string) => removeFolderCmd(id),
  relocateFolderCmd: (id: string, path: string) => relocateFolderCmd(id, path),
  restoreDatabaseCmd: (src: string) => restoreDatabaseCmd(src),
  pickFolder: () => pickFolder(),
  pickDbFile: () => pickDbFile(),
  assetUrl: (p: string) => p,
}));

const { useStore, escaneoAPantallaCompleta } = await import("../../store");
const initial = useStore.getState();

function track(id: string): Track {
  return {
    id,
    titulo: `Pista ${id}`,
    artista: "Artista",
    album: "Album",
    dur: "3:00",
    durSec: 180,
    formato: "MP3",
    carpeta: "Himnos",
    fav: false,
    missing: false,
    added: 1,
  };
}

function snapshot(ids: string[]): Snapshot {
  return { tracks: ids.map(track), folders: [], playlists: [] };
}

function novedades(ids: string[]): Novedades {
  return { tracks: ids.map(track), folders: [] };
}

/** A promise whose resolution this test controls. */
function diferida<T>() {
  let resolver!: (v: T) => void;
  const promesa = new Promise<T>((r) => (resolver = r));
  return { promesa, resolver };
}

beforeEach(() => {
  vi.useFakeTimers();
  useStore.setState(initial, true);
  for (const m of [
    getLibrary,
    getTracksSince,
    addAndScanFolder,
    rescanFolderCmd,
    cancelScanCmd,
    updateTrackCmd,
    removeFolderCmd,
    relocateFolderCmd,
    restoreDatabaseCmd,
    pickFolder,
    pickDbFile,
  ]) {
    m.mockReset();
  }
  getLibrary.mockResolvedValue(null);
  cancelScanCmd.mockResolvedValue(undefined);
  updateTrackCmd.mockResolvedValue(undefined);
  addAndScanFolder.mockResolvedValue(snapshot(["a"]));
  rescanFolderCmd.mockResolvedValue(snapshot(["a"]));
});

afterEach(() => {
  // The refresh poll and the edit debounce live in module scope, so they
  // outlive useStore.setState() and would fire inside the next test.
  useStore.getState().cancelScan();
  useStore.getState().flushEdit();
  vi.useRealTimers();
});

describe("escaneoAPantallaCompleta", () => {
  const estado = (over: Partial<ReturnType<typeof useStore.getState>>) =>
    ({ ...initial, ...over }) as ReturnType<typeof useStore.getState>;

  it("ocupa la vista solo mientras no haya nada detrás que mostrar", () => {
    expect(escaneoAPantallaCompleta(estado({ scanning: true, libState: "empty", view: "biblioteca" }))).toBe(true);
  });

  it("cede el sitio en cuanto hay catálogo", () => {
    expect(escaneoAPantallaCompleta(estado({ scanning: true, libState: "content", view: "biblioteca" }))).toBe(false);
  });

  it("no ocupa nada si no hay escaneo", () => {
    expect(escaneoAPantallaCompleta(estado({ scanning: false, libState: "empty", view: "biblioteca" }))).toBe(false);
  });

  it("no se queda con una vista que el usuario dejó atrás", () => {
    // Estando en Configuración, la tarjeta va a la esquina: la vista entera de
    // la biblioteca ni siquiera está montada.
    expect(escaneoAPantallaCompleta(estado({ scanning: true, libState: "empty", view: "config" }))).toBe(false);
  });
});

describe("escanear con una biblioteca ya cargada", () => {
  beforeEach(() => {
    useStore.setState({ tracks: [track("vieja")], libState: "content" });
  });

  it("no reemplaza la biblioteca por el escaneo", () => {
    useStore.getState().indexFolder("/musica", true);

    const s = useStore.getState();
    expect(s.scanning).toBe(true);
    expect(s.libState).toBe("content");
    expect(escaneoAPantallaCompleta(s)).toBe(false);
  });

  it("no arrastra al usuario fuera de Configuración al volver a escanear", () => {
    useStore.setState({ view: "config" });

    useStore.getState().rescanFolder("f1");

    expect(useStore.getState().view).toBe("config");
    expect(useStore.getState().scanning).toBe(true);
  });

  it("sí lleva a la biblioteca cuando el usuario acaba de agregar la carpeta", () => {
    useStore.setState({ view: "config" });

    useStore.getState().indexFolder("/musica", true);

    expect(useStore.getState().view).toBe("biblioteca");
  });

  it("deja la biblioteca como estaba al cancelar", () => {
    useStore.getState().indexFolder("/musica", true);

    useStore.getState().cancelScan();

    const s = useStore.getState();
    expect(s.scanning).toBe(false);
    expect(s.libState).toBe("content");
    expect(s.tracks.map((t) => t.id)).toEqual(["vieja"]);
    expect(cancelScanCmd).toHaveBeenCalledOnce();
  });

  it("apaga el escaneo aunque falle", async () => {
    addAndScanFolder.mockRejectedValue(new Error("unidad desconectada"));

    useStore.getState().indexFolder("/musica", true);
    await vi.runOnlyPendingTimersAsync();

    expect(useStore.getState().scanning).toBe(false);
    expect(useStore.getState().libState).toBe("error");
  });
});

describe("las pistas aparecen mientras el escaneo avanza", () => {
  it("trae lo ya indexado sin esperar al final", async () => {
    const final = diferida<Snapshot>();
    addAndScanFolder.mockReturnValue(final.promesa);
    getTracksSince.mockResolvedValue(novedades(["a", "b"]));

    useStore.getState().indexFolder("/musica", true);
    expect(useStore.getState().tracks).toEqual([]);

    await vi.advanceTimersByTimeAsync(2000);

    const s = useStore.getState();
    expect(s.tracks.map((t) => t.id)).toEqual(["a", "b"]);
    // Ya hay algo que mostrar, así que la tarjeta se va a la esquina.
    expect(s.libState).toBe("content");
    expect(s.scanning).toBe(true);

    final.resolver(snapshot(["a", "b", "c"]));
    await vi.runOnlyPendingTimersAsync();
    expect(useStore.getState().tracks.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(useStore.getState().scanning).toBe(false);
  });

  it("deja de consultar en cuanto el escaneo termina", async () => {
    const final = diferida<Snapshot>();
    addAndScanFolder.mockReturnValue(final.promesa);
    getTracksSince.mockResolvedValue(novedades(["a"]));

    useStore.getState().indexFolder("/musica", true);
    await vi.advanceTimersByTimeAsync(4000);
    const consultas = getTracksSince.mock.calls.length;
    expect(consultas).toBeGreaterThanOrEqual(2);

    final.resolver(snapshot(["a"]));
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(20000);

    expect(getTracksSince).toHaveBeenCalledTimes(consultas);
  });

  it("descarta un snapshot que llega tarde, cuando el definitivo ya está", async () => {
    const tardio = diferida<Novedades | null>();
    const final = diferida<Snapshot>();
    addAndScanFolder.mockReturnValue(final.promesa);
    getTracksSince.mockReturnValue(tardio.promesa);

    useStore.getState().indexFolder("/musica", true);
    await vi.advanceTimersByTimeAsync(2000);

    final.resolver(snapshot(["definitiva"]));
    await vi.runOnlyPendingTimersAsync();
    tardio.resolver(novedades(["a", "b", "c"]));
    await vi.runOnlyPendingTimersAsync();

    expect(useStore.getState().tracks.map((t) => t.id)).toEqual(["definitiva"]);
  });

  it("no pisa una edición que aún se está escribiendo", async () => {
    const final = diferida<Snapshot>();
    addAndScanFolder.mockReturnValue(final.promesa);
    getTracksSince.mockResolvedValue(novedades([]));
    useStore.setState({ tracks: [track("a")], libState: "content" });

    useStore.getState().indexFolder("/musica", true);
    // Casi a punto de consultar, el usuario teclea en el panel de detalle.
    await vi.advanceTimersByTimeAsync(1800);
    useStore.getState().onRowClick("a");
    useStore.getState().setEdit("artista", "Coro Emanuel");

    // La consulta tocaba ahora; la edición sigue esperando su debounce.
    await vi.advanceTimersByTimeAsync(200);

    expect(getTracksSince).not.toHaveBeenCalled();
    expect(useStore.getState().tracks[0].artista).toBe("Coro Emanuel");

    final.resolver(snapshot(["a"]));
    await vi.runOnlyPendingTimersAsync();
  });
  it("pide solo lo indexado después de la última pista que ya tiene", async () => {
    // Con ids numéricos, como los del núcleo: «10» va después de «9».
    const final = diferida<Snapshot>();
    addAndScanFolder.mockReturnValue(final.promesa);
    useStore.setState({ tracks: [track("9"), track("10")], libState: "content" });
    getTracksSince.mockResolvedValueOnce(novedades(["11", "12"]));
    getTracksSince.mockResolvedValue(novedades([]));

    useStore.getState().indexFolder("/musica", true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(getTracksSince).toHaveBeenLastCalledWith("10");
    expect(useStore.getState().tracks.map((t) => t.id)).toEqual(["9", "10", "11", "12"]);

    await vi.advanceTimersByTimeAsync(2000);
    expect(getTracksSince).toHaveBeenLastCalledWith("12");

    final.resolver(snapshot(["9", "10", "11", "12"]));
    await vi.runOnlyPendingTimersAsync();
  });

  it("no mete dos veces una pista que ya llegó", async () => {
    const final = diferida<Snapshot>();
    addAndScanFolder.mockReturnValue(final.promesa);
    getTracksSince.mockResolvedValue(novedades(["1", "2"]));

    useStore.getState().indexFolder("/musica", true);
    await vi.advanceTimersByTimeAsync(4000);
    expect(useStore.getState().tracks.map((t) => t.id)).toEqual(["1", "2"]);

    final.resolver(snapshot(["1", "2"]));
    await vi.runOnlyPendingTimersAsync();
  });

  it("espera más entre consultas mientras no llega nada nuevo", async () => {
    const final = diferida<Snapshot>();
    addAndScanFolder.mockReturnValue(final.promesa);
    getTracksSince.mockResolvedValue(novedades([]));

    useStore.getState().indexFolder("/musica", true);
    // A los 2 s, 6 s y 14 s (2, 4 y 8 de espera), y de ahí cada 8: en 21 s
    // son tres consultas, no las diez de antes.
    await vi.advanceTimersByTimeAsync(21000);
    expect(getTracksSince).toHaveBeenCalledTimes(3);

    // La cuarta, a los 22 s, trae algo: la siguiente vuelve a ir a los 2 s.
    getTracksSince.mockResolvedValueOnce(novedades(["1"]));
    await vi.advanceTimersByTimeAsync(1000);
    expect(getTracksSince).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(2000);
    expect(getTracksSince).toHaveBeenCalledTimes(5);

    final.resolver(snapshot(["1"]));
    await vi.runOnlyPendingTimersAsync();
  });

  it("un escaneo que empieza con una consulta del anterior en vuelo no deja dos relojes", async () => {
    const primero = diferida<Snapshot>();
    const enVuelo = diferida<Novedades | null>();
    addAndScanFolder.mockReturnValueOnce(primero.promesa);
    getTracksSince.mockReturnValueOnce(enVuelo.promesa);
    getTracksSince.mockResolvedValue(novedades([]));

    useStore.getState().indexFolder("/musica", true);
    await vi.advanceTimersByTimeAsync(2000);
    primero.resolver(snapshot([]));
    await vi.runOnlyPendingTimersAsync();

    const segundo = diferida<Snapshot>();
    addAndScanFolder.mockReturnValueOnce(segundo.promesa);
    useStore.getState().indexFolder("/otra", true);
    // La consulta del primer escaneo vuelve ahora, con el segundo en marcha.
    // Vacía, así que la cadena vieja se reprogramaría a 4 s: la ventana tiene
    // que llegar hasta ahí para verla. La nueva consulta a los 2 s y la
    // siguiente, también vacía, no llega hasta los 6.
    enVuelo.resolver(novedades([]));
    const antes = getTracksSince.mock.calls.length;
    await vi.advanceTimersByTimeAsync(4500);
    expect(getTracksSince).toHaveBeenCalledTimes(antes + 1);

    segundo.resolver(snapshot([]));
    await vi.runOnlyPendingTimersAsync();
  });
});

describe("la tarjeta de la esquina se puede esconder", () => {
  beforeEach(() => {
    useStore.setState({ tracks: [track("vieja")], libState: "content" });
  });

  it("esconderla no para el escaneo", () => {
    // Son dos cosas distintas: quitarse la tarjeta de delante y cancelar.
    useStore.getState().indexFolder("/musica", true);

    useStore.getState().ocultarTarjetaEscaneo();

    expect(useStore.getState().tarjetaEscaneoOculta).toBe(true);
    expect(useStore.getState().scanning).toBe(true);
    expect(cancelScanCmd).not.toHaveBeenCalled();
  });

  it("y el siguiente escaneo la vuelve a mostrar", () => {
    // Si no, esconderla una vez la escondería para siempre y el escaneo
    // siguiente correría sin que nada lo dijera.
    useStore.setState({ tarjetaEscaneoOculta: true });

    useStore.getState().indexFolder("/musica", true);

    expect(useStore.getState().tarjetaEscaneoOculta).toBe(false);
  });

  it("también al volver a escanear una carpeta desde Configuración", () => {
    useStore.setState({ tarjetaEscaneoOculta: true });

    useStore.getState().rescanFolder("f1");

    expect(useStore.getState().tarjetaEscaneoOculta).toBe(false);
  });
});

describe("un solo escaneo a la vez", () => {
  // El núcleo rechaza el segundo escaneo de plano; esto es lo que evita que el
  // usuario llegue siquiera a pedirlo, y que la negativa acabe pintada como
  // una pantalla de error.
  beforeEach(() => {
    useStore.setState({ tracks: [track("vieja")], libState: "content" });
    const nunca = diferida<Snapshot>();
    addAndScanFolder.mockReturnValue(nunca.promesa);
    rescanFolderCmd.mockReturnValue(nunca.promesa);
  });

  it("no lanza un segundo escaneo desde el diálogo", () => {
    useStore.getState().indexFolder("/musica", true);
    expect(addAndScanFolder).toHaveBeenCalledOnce();

    useStore.getState().indexFolder("/otra", true);

    expect(addAndScanFolder).toHaveBeenCalledOnce();
    expect(useStore.getState().toast?.titulo).toMatch(/escaneo en curso/i);
  });

  it("no lanza un segundo escaneo desde Configuración", () => {
    useStore.getState().indexFolder("/musica", true);

    useStore.getState().rescanFolder("f1");

    expect(rescanFolderCmd).not.toHaveBeenCalled();
    expect(useStore.getState().toast?.titulo).toMatch(/escaneo en curso/i);
  });

  it("ni siquiera abre el diálogo de agregar carpeta mientras escanea", () => {
    useStore.getState().indexFolder("/musica", true);

    useStore.getState().openAddFolder();

    expect(useStore.getState().dialog).toBeNull();
    expect(useStore.getState().toast?.titulo).toMatch(/escaneo en curso/i);
  });

  it("vuelve a dejar escanear en cuanto el anterior termina", async () => {
    const primero = diferida<Snapshot>();
    addAndScanFolder.mockReturnValue(primero.promesa);
    useStore.getState().indexFolder("/musica", true);

    primero.resolver(snapshot(["a"]));
    await vi.runOnlyPendingTimersAsync();
    expect(useStore.getState().scanning).toBe(false);

    useStore.getState().openAddFolder();
    expect(useStore.getState().dialog).toBe("addFolder");
  });
});

describe("nada reescribe lo que un escaneo está escribiendo", () => {
  // Quitar o reapuntar la carpeta que se escanea, o restaurar la base debajo
  // del escaneo, acababa en pistas perdidas o en una pantalla de error que
  // culpaba a la unidad (#127). El núcleo lo rechaza igual; esto evita que el
  // usuario llegue a pedirlo.
  beforeEach(() => {
    useStore.setState({
      tracks: [track("vieja")],
      folders: [{ id: "f1", nombre: "Himnos", ruta: "/musica", count: 1 }],
      libState: "content",
    });
    addAndScanFolder.mockReturnValue(diferida<Snapshot>().promesa);
    pickFolder.mockResolvedValue("/nueva");
    pickDbFile.mockResolvedValue("/copia.db");
    useStore.getState().indexFolder("/musica", true);
  });

  it("no deja quitar una carpeta", () => {
    useStore.getState().removeFolder("f1");

    expect(useStore.getState().confirm).toBeFalsy();
    expect(removeFolderCmd).not.toHaveBeenCalled();
    expect(useStore.getState().toast?.titulo).toMatch(/escaneo en curso/i);
  });

  it("no deja reapuntar una carpeta", async () => {
    useStore.getState().relocateFolder("f1");
    // Before the timers run: the toast dismisses itself on one of them.
    expect(useStore.getState().toast?.titulo).toMatch(/escaneo en curso/i);
    await vi.runOnlyPendingTimersAsync();

    expect(pickFolder).not.toHaveBeenCalled();
    expect(relocateFolderCmd).not.toHaveBeenCalled();
  });

  it("no deja restaurar una copia", async () => {
    useStore.getState().restore();
    // Before the timers run: the toast dismisses itself on one of them.
    expect(useStore.getState().toast?.titulo).toMatch(/escaneo en curso/i);
    await vi.runOnlyPendingTimersAsync();

    expect(pickDbFile).not.toHaveBeenCalled();
    expect(restoreDatabaseCmd).not.toHaveBeenCalled();
  });
});
