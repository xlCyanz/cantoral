// Un escaneo corre junto a la biblioteca, no encima de ella. Lo que se fija
// aquí es que `libState` y la vista sobrevivan al escaneo, que la carpeta a
// pantalla completa quede solo para cuando no hay nada detrás, y que las pistas
// ya indexadas aparezcan sin esperar al final.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Snapshot } from "../api";
import type { Track } from "../types";

const getLibrary = vi.fn<() => Promise<Snapshot | null>>();
const addAndScanFolder = vi.fn<(path: string, recursive: boolean) => Promise<Snapshot>>();
const rescanFolderCmd = vi.fn<(id: string) => Promise<Snapshot>>();
const cancelScanCmd = vi.fn<() => Promise<void>>();
const updateTrackCmd = vi.fn<() => Promise<void>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  // The store decides at module-eval time whether it is running under Tauri;
  // without this it would load the browser seed and never call a command.
  isTauri: () => true,
  getLibrary: () => getLibrary(),
  addAndScanFolder: (path: string, recursive: boolean) => addAndScanFolder(path, recursive),
  rescanFolderCmd: (id: string) => rescanFolderCmd(id),
  cancelScanCmd: () => cancelScanCmd(),
  updateTrackCmd: () => updateTrackCmd(),
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
    tono: "Do",
    bpm: 80,
    ocasion: "Adoración",
    formato: "MP3",
    carpeta: "Himnos",
    tags: [],
    fav: false,
    missing: false,
    added: 1,
  };
}

function snapshot(ids: string[]): Snapshot {
  return { tracks: ids.map(track), folders: [], playlists: [] };
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
  for (const m of [getLibrary, addAndScanFolder, rescanFolderCmd, cancelScanCmd, updateTrackCmd]) {
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
    getLibrary.mockResolvedValue(snapshot(["a", "b"]));

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
    getLibrary.mockResolvedValue(snapshot(["a"]));

    useStore.getState().indexFolder("/musica", true);
    await vi.advanceTimersByTimeAsync(4000);
    const consultas = getLibrary.mock.calls.length;
    expect(consultas).toBeGreaterThanOrEqual(2);

    final.resolver(snapshot(["a"]));
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(6000);

    expect(getLibrary).toHaveBeenCalledTimes(consultas);
  });

  it("descarta un snapshot que llega tarde, cuando el definitivo ya está", async () => {
    const tardio = diferida<Snapshot | null>();
    const final = diferida<Snapshot>();
    addAndScanFolder.mockReturnValue(final.promesa);
    getLibrary.mockReturnValue(tardio.promesa);

    useStore.getState().indexFolder("/musica", true);
    await vi.advanceTimersByTimeAsync(2000);

    final.resolver(snapshot(["definitiva"]));
    await vi.runOnlyPendingTimersAsync();
    tardio.resolver(snapshot(["a", "b", "c"]));
    await vi.runOnlyPendingTimersAsync();

    expect(useStore.getState().tracks.map((t) => t.id)).toEqual(["definitiva"]);
  });

  it("no pisa una edición que aún se está escribiendo", async () => {
    const final = diferida<Snapshot>();
    addAndScanFolder.mockReturnValue(final.promesa);
    getLibrary.mockResolvedValue(snapshot(["a"]));
    useStore.setState({ tracks: [track("a")], libState: "content" });

    useStore.getState().indexFolder("/musica", true);
    // Casi a punto de consultar, el usuario teclea en el panel de detalle.
    await vi.advanceTimersByTimeAsync(1800);
    useStore.getState().onRowClick("a");
    useStore.getState().setEdit("tono", "Solm");

    // La consulta tocaba ahora; la edición sigue esperando su debounce.
    await vi.advanceTimersByTimeAsync(200);

    expect(getLibrary).not.toHaveBeenCalled();
    expect(useStore.getState().tracks[0].tono).toBe("Solm");

    final.resolver(snapshot(["a"]));
    await vi.runOnlyPendingTimersAsync();
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
    expect(useStore.getState().toast?.message).toMatch(/escaneo en curso/i);
  });

  it("no lanza un segundo escaneo desde Configuración", () => {
    useStore.getState().indexFolder("/musica", true);

    useStore.getState().rescanFolder("f1");

    expect(rescanFolderCmd).not.toHaveBeenCalled();
    expect(useStore.getState().toast?.message).toMatch(/escaneo en curso/i);
  });

  it("ni siquiera abre el diálogo de agregar carpeta mientras escanea", () => {
    useStore.getState().indexFolder("/musica", true);

    useStore.getState().openAddFolder();

    expect(useStore.getState().dialog).toBeNull();
    expect(useStore.getState().toast?.message).toMatch(/escaneo en curso/i);
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
