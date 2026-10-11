// Al abrir, la app aplica una sola instantánea: la de `get_library`. La
// reconciliación con el disco contesta solo con lo que cambió, y eso se apunta
// encima sin volver a reemplazar el catálogo.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Reconciliacion, Snapshot } from "../api";
import type { Track } from "../types";

function pista(id: string, over: Partial<Track> = {}): Track {
  return { id, titulo: `T${id}`, artista: "", album: "", dur: "3:00", durSec: 180, formato: "MP3", carpeta: "Himnos", fav: false, missing: false, added: 0, path: `/m/${id}.mp3`, ...over };
}

const getLibrary = vi.fn<() => Promise<Snapshot | null>>();
const reconcileLibraryCmd = vi.fn<() => Promise<Reconciliacion | null>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  registrar: () => {},
  getSetting: () => Promise.resolve(null),
  setSetting: () => Promise.resolve(),
  getLibrary: () => getLibrary(),
  reconcileLibraryCmd: () => reconcileLibraryCmd(),
}));

const { useStore } = await import("../../store");
const initial = useStore.getState();

async function arrancar() {
  await useStore.getState().hydrate();
  await vi.waitFor(() => expect(useStore.getState().arranqueListo).toBe(true));
}

describe("el arranque", () => {
  beforeEach(() => {
    useStore.setState(initial, true);
    getLibrary.mockReset();
    reconcileLibraryCmd.mockReset();
    getLibrary.mockResolvedValue({ tracks: [pista("1"), pista("2"), pista("3")], folders: [], playlists: [] });
  });

  it("sin cambios en el disco, el catálogo se escribe una sola vez", async () => {
    reconcileLibraryCmd.mockResolvedValue({ cambiados: [] });
    const escrituras: Track[][] = [];
    const soltar = useStore.subscribe((s, antes) => {
      if (s.tracks !== antes.tracks) escrituras.push(s.tracks);
    });

    await arrancar();
    soltar();

    expect(getLibrary).toHaveBeenCalledTimes(1);
    expect(escrituras).toHaveLength(1);
  });

  it("un archivo que desapareció se marca, y las demás pistas siguen siendo las mismas", async () => {
    reconcileLibraryCmd.mockResolvedValue({ cambiados: [{ id: "2", missing: true }] });
    let primera: Track[] | null = null;
    const soltar = useStore.subscribe((s, antes) => {
      if (s.tracks !== antes.tracks && !primera) primera = s.tracks;
    });

    await arrancar();
    soltar();

    const ahora = useStore.getState().tracks;
    expect(ahora.map((t) => t.missing)).toEqual([false, true, false]);
    expect(ahora[0]).toBe(primera![0]);
    expect(ahora[2]).toBe(primera![2]);
  });

  it("un archivo que volvió deja de estar marcado", async () => {
    getLibrary.mockResolvedValue({ tracks: [pista("1", { missing: true })], folders: [], playlists: [] });
    reconcileLibraryCmd.mockResolvedValue({ cambiados: [{ id: "1", missing: false }, { id: "99", missing: true }] });

    await arrancar();

    expect(useStore.getState().tracks.map((t) => t.missing)).toEqual([false]);
  });
});
