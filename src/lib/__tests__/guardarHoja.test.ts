// «Guardar .html» guarda y nada más (#142). Antes, tras escribir la hoja, la
// abría en el navegador: quien la guardaba para mandarla por correo veía saltar
// una ventana que no había pedido, quizá encima de la proyección. Lo que se
// fija aquí es que ya no se abre nada, que el aviso dice dónde quedó, y que la
// ventana principal ya no tiene permiso para abrir URLs.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Playlist, Track } from "../types";
import capacidades from "../../../src-tauri/capabilities/default.json";

const pickExportPath = vi.fn<(nombre: string) => Promise<string | null>>();
const exportPlaylistCmd = vi.fn<(dest: string, html: string) => Promise<void>>();
const revealFile = vi.fn<(path: string) => Promise<void>>();
const openPath = vi.fn();
const openUrl = vi.fn();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  pickExportPath: (nombre: string) => pickExportPath(nombre),
  exportPlaylistCmd: (dest: string, html: string) => exportPlaylistCmd(dest, html),
  revealFile: (path: string) => revealFile(path),
  getSheets: async () => [],
  touchPlaylistCmd: async () => {},
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: (...args: unknown[]) => openPath(...args),
  openUrl: (...args: unknown[]) => openUrl(...args),
  revealItemInDir: async () => {},
}));

const api = await import("../api");
const { useStore } = await import("../../store");
const { usarBackend } = await import("../backend");
const { crearMemoria } = await import("../backend/memoria");
const { tauri } = await import("../backend/tauri");

const initial = useStore.getState();

function pista(id: string): Track {
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
    path: `/m/${id}.mp3`,
  };
}

const lista: Playlist = {
  id: "p1",
  nombre: "Culto 4 Ene",
  tocada: "",
  ocasion: "Servicio dominical",
  ids: ["a"],
  plantilla: false,
};

beforeEach(() => {
  useStore.setState(initial, true);
  [pickExportPath, exportPlaylistCmd, revealFile, openPath, openUrl].forEach((m) => m.mockReset());
  exportPlaylistCmd.mockResolvedValue(undefined);
  useStore.setState({
    tracks: [pista("a")],
    playlists: [lista],
    plOrder: { p1: ["a"] },
    curPlaylist: "p1",
    view: "lista",
  });
  usarBackend(tauri);
});

describe("guardar la hoja en la app", () => {
  it("la escribe y no la abre con nada", async () => {
    pickExportPath.mockResolvedValue("/tmp/Culto 4 Ene.html");

    useStore.getState().exportPl();

    await vi.waitFor(() => expect(useStore.getState().toast?.titulo).toBe("Hoja guardada"));
    expect(exportPlaylistCmd).toHaveBeenCalledWith("/tmp/Culto 4 Ene.html", expect.stringContaining("Pista a"));
    expect(openPath).not.toHaveBeenCalled();
    expect(openUrl).not.toHaveBeenCalled();
    expect(revealFile).not.toHaveBeenCalled();
  });

  it("el aviso dice dónde quedó", async () => {
    pickExportPath.mockResolvedValue("/tmp/Culto 4 Ene.html");

    useStore.getState().exportPl();

    await vi.waitFor(() => expect(useStore.getState().toast?.detalle).toBe("/tmp/Culto 4 Ene.html"));
  });

  it("si se cancela el diálogo no escribe ni avisa", async () => {
    pickExportPath.mockResolvedValue(null);

    useStore.getState().exportPl();

    await vi.waitFor(() => expect(pickExportPath).toHaveBeenCalled());
    expect(exportPlaylistCmd).not.toHaveBeenCalled();
    expect(useStore.getState().toast).toBeFalsy();
  });

  it("el núcleo ya no ofrece un comando para abrir la hoja", () => {
    expect("openExportedSheet" in api).toBe(false);
  });
});

describe("guardar la hoja en el navegador", () => {
  it("devuelve el nombre de la descarga", async () => {
    const b = crearMemoria({ tracks: [], playlists: [] });
    const crear = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
    const soltar = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.stubGlobal("document", { createElement: () => ({ click: () => {} }) });

    expect(await b.saveSheet("Culto.html", "<html></html>")).toBe("Culto.html");

    [crear, soltar].forEach((s) => s.mockRestore());
    vi.unstubAllGlobals();
  });
});

describe("los permisos de la ventana principal", () => {
  const permisos = capacidades.permissions as string[];

  it("no incluyen abrir URLs ni el paquete entero del abridor", () => {
    expect(permisos).not.toContain("opener:default");
    expect(permisos.some((p) => p.includes("open-url") || p.includes("open-path"))).toBe(false);
  });

  it("conservan mostrar un archivo en el explorador", () => {
    expect(permisos).toContain("opener:allow-reveal-item-in-dir");
  });
});
