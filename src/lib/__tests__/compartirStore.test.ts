// Importar no crea nada hasta que alguien ha visto qué se encontró. Lo que se
// fija aquí es esa espera —leer y emparejar deja una vista previa, no una
// lista— y que lo que sí se crea lleve el orden del culto que venía en el
// archivo, sin las pistas que esta biblioteca no tiene.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Playlist, Track } from "../types";
import type { ArchivoDeLista } from "../compartir";

let enTauri = false;
const exportPlaylistJsonCmd = vi.fn<(dest: string, json: string) => Promise<void>>();
const pickShareExportPath = vi.fn<(nombre: string) => Promise<string | null>>();
const pickPlaylistFile = vi.fn<() => Promise<string | null>>();
const readPlaylistFileCmd = vi.fn<(src: string) => Promise<ArchivoDeLista>>();
const leerArchivoDelNavegador = vi.fn<() => Promise<ArchivoDeLista | null>>();
const createPlaylistCmd = vi.fn<(n: string, f: string, o: string) => Promise<string>>();
const setPlaylistOrderCmd = vi.fn<(pl: string, ids: string[]) => Promise<void>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => enTauri,
  exportPlaylistJsonCmd: (dest: string, json: string) => exportPlaylistJsonCmd(dest, json),
  pickShareExportPath: (nombre: string) => pickShareExportPath(nombre),
  pickPlaylistFile: () => pickPlaylistFile(),
  readPlaylistFileCmd: (src: string) => readPlaylistFileCmd(src),
  leerArchivoDelNavegador: () => leerArchivoDelNavegador(),
  createPlaylistCmd: (n: string, f: string, o: string) => createPlaylistCmd(n, f, o),
  setPlaylistOrderCmd: (pl: string, ids: string[]) => setPlaylistOrderCmd(pl, ids),
  getLibrary: () => Promise.resolve(null),
}));

const { useStore } = await import("../../store");
const initial = useStore.getState();

function pista(id: string, over: Partial<Track> = {}): Track {
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
    path: `/m/${id}.mp3`,
    ...over,
  };
}

const lista: Playlist = {
  id: "p1",
  nombre: "Culto 4 Ene",
  fecha: "2026-01-04",
  ocasion: "Servicio dominical",
  ids: ["a", "b"],
  plantilla: false,
};

function conLista() {
  useStore.setState({
    tracks: [pista("a"), pista("b"), pista("c")],
    playlists: [lista],
    plOrder: { p1: ["b", "a"] },
    curPlaylist: "p1",
    view: "lista",
  });
}

/** A file as this app would have written it, for feeding back in. */
function archivoDe(titulos: string[], nombre = "Culto de otra iglesia"): ArchivoDeLista {
  return {
    cantoral: 1,
    lista: { nombre, fecha: "2026-02-01", ocasion: "Comunión", plantilla: false },
    pistas: titulos.map((t) => ({
      titulo: t,
      artista: "Coro",
      album: "Album",
      durSec: 180,
      tono: "Sol",
      ocasion: "Adoración",
      etiquetas: [],
      archivo: "",
    })),
    exportado: "2026-01-01T00:00:00Z",
  };
}

beforeEach(() => {
  useStore.setState(initial, true);
  enTauri = false;
  [
    exportPlaylistJsonCmd,
    pickShareExportPath,
    pickPlaylistFile,
    readPlaylistFileCmd,
    leerArchivoDelNavegador,
    createPlaylistCmd,
    setPlaylistOrderCmd,
  ].forEach((m) => m.mockReset());
  setPlaylistOrderCmd.mockResolvedValue(undefined);
  exportPlaylistJsonCmd.mockResolvedValue(undefined);
  conLista();
});

describe("enviar una lista a otra instalación", () => {
  beforeEach(() => {
    enTauri = true;
  });

  it("escribe el orden del culto, no el de la biblioteca", async () => {
    pickShareExportPath.mockResolvedValue("/tmp/culto.cantoral.json");

    useStore.getState().shareCurrentList();

    await vi.waitFor(() => expect(exportPlaylistJsonCmd).toHaveBeenCalled());
    const [dest, json] = exportPlaylistJsonCmd.mock.calls[0];
    expect(dest).toBe("/tmp/culto.cantoral.json");
    expect(JSON.parse(json).pistas.map((p: { titulo: string }) => p.titulo)).toEqual([
      "Pista b",
      "Pista a",
    ]);
  });

  it("propone un nombre con la extensión que el importador espera", async () => {
    pickShareExportPath.mockResolvedValue(null);

    useStore.getState().shareCurrentList();

    await vi.waitFor(() => expect(pickShareExportPath).toHaveBeenCalledWith("Culto 4 Ene.cantoral.json"));
  });

  it("si se cancela el diálogo no se escribe nada", async () => {
    pickShareExportPath.mockResolvedValue(null);

    useStore.getState().shareCurrentList();

    await vi.waitFor(() => expect(pickShareExportPath).toHaveBeenCalled());
    expect(exportPlaylistJsonCmd).not.toHaveBeenCalled();
  });

  it("una lista vacía no se exporta, y lo dice", () => {
    useStore.setState({ plOrder: { p1: [] } });

    useStore.getState().shareCurrentList();

    expect(useStore.getState().toast?.titulo).toContain("vacía");
    expect(pickShareExportPath).not.toHaveBeenCalled();
  });

  it("si el backend falla lo dice", async () => {
    pickShareExportPath.mockResolvedValue("/tmp/culto.cantoral.json");
    exportPlaylistJsonCmd.mockRejectedValue(new Error("disco lleno"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    useStore.getState().shareCurrentList();

    await vi.waitFor(() => expect(useStore.getState().toast?.type).toBe("error"));
  });
});

describe("importar: leer no es crear", () => {
  beforeEach(() => {
    enTauri = true;
    pickPlaylistFile.mockResolvedValue("/tmp/otra.cantoral.json");
  });

  it("deja una vista previa y ninguna lista nueva", async () => {
    readPlaylistFileCmd.mockResolvedValue(archivoDe(["Pista a", "Pista c"]));
    const antes = useStore.getState().playlists.length;

    useStore.getState().importList();

    await vi.waitFor(() => expect(useStore.getState().dialog).toBe("importList"));
    expect(useStore.getState().playlists).toHaveLength(antes);
    expect(useStore.getState().importPreview?.resultado.encontradas).toHaveLength(2);
  });

  it("separa lo que está de lo que no", async () => {
    readPlaylistFileCmd.mockResolvedValue(archivoDe(["Pista a", "Himno que no tengo"]));

    useStore.getState().importList();

    await vi.waitFor(() => expect(useStore.getState().importPreview).not.toBeNull());
    const { encontradas, faltantes } = useStore.getState().importPreview!.resultado;
    expect(encontradas.map((e) => e.id)).toEqual(["a"]);
    expect(faltantes.map((p) => p.titulo)).toEqual(["Himno que no tengo"]);
  });

  it("un archivo que no se puede leer se cuenta y no abre nada", async () => {
    readPlaylistFileCmd.mockRejectedValue(new Error("El archivo no es una lista exportada de Cantoral."));
    vi.spyOn(console, "error").mockImplementation(() => {});

    useStore.getState().importList();

    await vi.waitFor(() => expect(useStore.getState().toast?.type).toBe("error"));
    expect(useStore.getState().dialog).toBeNull();
    expect(useStore.getState().importPreview).toBeNull();
  });

  it("si se cancela el diálogo no pasa nada", async () => {
    pickPlaylistFile.mockResolvedValue(null);

    useStore.getState().importList();

    await vi.waitFor(() => expect(pickPlaylistFile).toHaveBeenCalled());
    expect(readPlaylistFileCmd).not.toHaveBeenCalled();
    expect(useStore.getState().dialog).toBeNull();
  });

  it("en el navegador entra por el selector del navegador", async () => {
    enTauri = false;
    leerArchivoDelNavegador.mockResolvedValue(archivoDe(["Pista a"]));

    useStore.getState().importList();

    await vi.waitFor(() => expect(useStore.getState().dialog).toBe("importList"));
    expect(pickPlaylistFile).not.toHaveBeenCalled();
  });
});

describe("importar: crear la lista", () => {
  async function preparar(titulos: string[]) {
    enTauri = true;
    pickPlaylistFile.mockResolvedValue("/tmp/otra.cantoral.json");
    readPlaylistFileCmd.mockResolvedValue(archivoDe(titulos));
    createPlaylistCmd.mockResolvedValue("77");
    useStore.getState().importList();
    await vi.waitFor(() => expect(useStore.getState().importPreview).not.toBeNull());
  }

  it("crea la lista con los datos del archivo y el orden que traía", async () => {
    await preparar(["Pista c", "Pista a"]);

    useStore.getState().confirmImport();

    await vi.waitFor(() => expect(setPlaylistOrderCmd).toHaveBeenCalled());
    expect(createPlaylistCmd).toHaveBeenCalledWith("Culto de otra iglesia", "2026-02-01", "Comunión");
    expect(setPlaylistOrderCmd).toHaveBeenCalledWith("77", ["c", "a"]);
  });

  it("abre la lista recién creada", async () => {
    await preparar(["Pista a"]);

    useStore.getState().confirmImport();

    await vi.waitFor(() => expect(useStore.getState().curPlaylist).toBe("77"));
    expect(useStore.getState().view).toBe("lista");
  });

  it("deja constancia de lo que faltó en vez de callarlo", async () => {
    await preparar(["Pista a", "Himno que no tengo", "Otro que tampoco"]);

    useStore.getState().confirmImport();

    // El titular dice qué pasó y el detalle qué significa: lo que faltó es lo
    // segundo, no el titular.
    await vi.waitFor(() => expect(useStore.getState().toast?.titulo).toBe("Lista importada"));
    expect(useStore.getState().toast?.detalle).toContain("2 pistas no están");
  });

  it("no crea nada si no se encontró ninguna", async () => {
    await preparar(["Himno que no tengo"]);

    useStore.getState().confirmImport();

    expect(createPlaylistCmd).not.toHaveBeenCalled();
    // El diálogo sigue abierto: cerrarlo sin hacer nada parecería que funcionó.
    expect(useStore.getState().dialog).toBe("importList");
  });

  it("cerrar el diálogo suelta la vista previa", async () => {
    await preparar(["Pista a"]);

    useStore.getState().closeDialog();

    expect(useStore.getState().importPreview).toBeNull();
    expect(useStore.getState().dialog).toBeNull();
  });

  it("si el backend falla lo dice y no deja media lista abierta", async () => {
    await preparar(["Pista a"]);
    createPlaylistCmd.mockRejectedValue(new Error("base bloqueada"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    useStore.getState().confirmImport();

    await vi.waitFor(() => expect(useStore.getState().toast?.type).toBe("error"));
    expect(setPlaylistOrderCmd).not.toHaveBeenCalled();
  });

  it("en el navegador la lista nueva no es una plantilla", async () => {
    enTauri = false;
    leerArchivoDelNavegador.mockResolvedValue(archivoDe(["Pista a"]));
    useStore.getState().importList();
    await vi.waitFor(() => expect(useStore.getState().importPreview).not.toBeNull());

    useStore.getState().confirmImport();

    const s = useStore.getState();
    expect(s.playlists.find((p) => p.id === s.curPlaylist)?.plantilla).toBe(false);
    expect(s.plOrder[s.curPlaylist]).toEqual(["a"]);
  });
});

describe("la vuelta entera", () => {
  it("lo que se exporta se vuelve a importar igual", async () => {
    // El caso del issue: el director arma el repertorio en su portátil y lo
    // pasa al PC de la iglesia, que tiene los mismos archivos.
    enTauri = true;
    pickShareExportPath.mockResolvedValue("/tmp/culto.cantoral.json");
    useStore.getState().shareCurrentList();
    await vi.waitFor(() => expect(exportPlaylistJsonCmd).toHaveBeenCalled());
    const escrito = JSON.parse(exportPlaylistJsonCmd.mock.calls[0][1]) as ArchivoDeLista;

    pickPlaylistFile.mockResolvedValue("/tmp/culto.cantoral.json");
    readPlaylistFileCmd.mockResolvedValue(escrito);
    createPlaylistCmd.mockResolvedValue("77");
    useStore.getState().importList();
    await vi.waitFor(() => expect(useStore.getState().importPreview).not.toBeNull());
    expect(useStore.getState().importPreview!.resultado.faltantes).toEqual([]);

    useStore.getState().confirmImport();

    await vi.waitFor(() => expect(setPlaylistOrderCmd).toHaveBeenCalled());
    expect(createPlaylistCmd).toHaveBeenCalledWith("Culto 4 Ene", "2026-01-04", "Servicio dominical");
    expect(setPlaylistOrderCmd).toHaveBeenCalledWith("77", ["b", "a"]);
  });
});
