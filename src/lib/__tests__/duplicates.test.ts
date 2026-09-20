// Fusionar duplicadas borra pistas, así que lo que se fija aquí es que no
// ocurra nada antes de que el usuario lo confirme, que se mande exactamente lo
// que eligió, y que una lista calculada contra un catálogo que ya cambió no se
// quede en pantalla invitando a fusionar pistas que quizá ya no existen.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DuplicateGroup, DuplicateReport, Snapshot } from "../api";

const findDuplicatesCmd = vi.fn<() => Promise<DuplicateReport | null>>();
const mergeDuplicatesCmd = vi.fn<(keep: string, drop: string[]) => Promise<Snapshot | null>>();
const dismissDuplicatesCmd = vi.fn<(signature: string) => Promise<DuplicateReport | null>>();
const restoreDismissedDuplicatesCmd = vi.fn<() => Promise<DuplicateReport | null>>();
const getLibrary = vi.fn<() => Promise<Snapshot | null>>();
const getSetting = vi.fn<() => Promise<string | null>>();
const reconcileLibraryCmd = vi.fn<() => Promise<Snapshot | null>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  assetUrl: (p: string) => p,
  findDuplicatesCmd: () => findDuplicatesCmd(),
  mergeDuplicatesCmd: (keep: string, drop: string[]) => mergeDuplicatesCmd(keep, drop),
  dismissDuplicatesCmd: (s: string) => dismissDuplicatesCmd(s),
  restoreDismissedDuplicatesCmd: () => restoreDismissedDuplicatesCmd(),
  getLibrary: () => getLibrary(),
  getSetting: () => getSetting(),
  reconcileLibraryCmd: () => reconcileLibraryCmd(),
}));

const { useStore } = await import("../../store");
const initial = useStore.getState();

function copia(id: string, formato: string, fsize: number): DuplicateGroup["tracks"][number] {
  return {
    id,
    titulo: "Santo",
    artista: "Coro",
    path: `/m/${id}.${formato.toLowerCase()}`,
    formato,
    carpeta: "Himnos",
    dur: "5:00",
    durSec: 300,
    fsize,
    fav: false,
    missing: false,
    tags: [],
  };
}

const GRUPO: DuplicateGroup = {
  signature: "1-2-3",
  motivo: "titulo",
  sugerido: "1",
  tracks: [copia("1", "WAV", 90_000), copia("2", "MP3", 4_000), copia("3", "OGG", 3_000)],
};

const INFORME: DuplicateReport = { groups: [GRUPO], dismissed: 2 };

beforeEach(() => {
  useStore.setState(initial, true);
  for (const m of [findDuplicatesCmd, mergeDuplicatesCmd, dismissDuplicatesCmd, restoreDismissedDuplicatesCmd, getLibrary, getSetting, reconcileLibraryCmd]) {
    m.mockReset();
  }
  getLibrary.mockResolvedValue({ tracks: [], folders: [], playlists: [] });
  getSetting.mockResolvedValue(null);
  reconcileLibraryCmd.mockResolvedValue(null);
  findDuplicatesCmd.mockResolvedValue(INFORME);
  mergeDuplicatesCmd.mockResolvedValue({ tracks: [], folders: [], playlists: [] });
  dismissDuplicatesCmd.mockResolvedValue({ groups: [], dismissed: 3 });
  restoreDismissedDuplicatesCmd.mockResolvedValue(INFORME);
});

afterEach(() => {
  useStore.setState(initial, true);
});

describe("buscar duplicadas", () => {
  it("guarda los grupos y cuántos había descartados", async () => {
    useStore.getState().findDuplicates();
    expect(useStore.getState().duplicatesState).toBe("buscando");

    await vi.waitFor(() => expect(useStore.getState().duplicatesState).toBe("listo"));
    expect(useStore.getState().duplicates).toEqual([GRUPO]);
    expect(useStore.getState().duplicatesDismissed).toBe(2);
  });

  it("no deja la vista colgada en «buscando» si falla", async () => {
    findDuplicatesCmd.mockRejectedValue(new Error("base bloqueada"));

    useStore.getState().findDuplicates();

    await vi.waitFor(() => expect(useStore.getState().duplicatesState).toBe("idle"));
    expect(useStore.getState().toast?.type).toBe("error");
  });
});

describe("fusionar", () => {
  beforeEach(async () => {
    useStore.getState().findDuplicates();
    await vi.waitFor(() => expect(useStore.getState().duplicatesState).toBe("listo"));
  });

  it("no toca nada hasta que el usuario confirma", () => {
    useStore.getState().mergeDuplicates("1-2-3", "2");

    expect(mergeDuplicatesCmd).not.toHaveBeenCalled();
    expect(useStore.getState().confirm).not.toBeNull();
  });

  it("nombra en la confirmación las copias que se van, no las que se quedan", () => {
    useStore.getState().mergeDuplicates("1-2-3", "2");

    const c = useStore.getState().confirm!;
    expect(c.detail).toContain("/m/1.wav");
    expect(c.detail).toContain("/m/3.ogg");
    expect(c.detail).not.toContain("/m/2.mp3");
  });

  it("manda la elegida y solo las demás", async () => {
    useStore.getState().mergeDuplicates("1-2-3", "2");
    useStore.getState().acceptConfirm();

    await vi.waitFor(() => expect(mergeDuplicatesCmd).toHaveBeenCalled());
    expect(mergeDuplicatesCmd).toHaveBeenCalledWith("2", ["1", "3"]);
  });

  it("vuelve a buscar cuando termina, para no dejar el grupo ya resuelto en pantalla", async () => {
    useStore.getState().mergeDuplicates("1-2-3", "1");
    useStore.getState().acceptConfirm();

    await vi.waitFor(() => expect(findDuplicatesCmd).toHaveBeenCalledTimes(2));
  });

  it("ignora un grupo o una pista que ya no están en la lista", () => {
    useStore.getState().mergeDuplicates("no-existe", "1");
    useStore.getState().mergeDuplicates("1-2-3", "99");

    expect(useStore.getState().confirm).toBeNull();
    expect(mergeDuplicatesCmd).not.toHaveBeenCalled();
  });
});

describe("descartar", () => {
  beforeEach(async () => {
    useStore.getState().findDuplicates();
    await vi.waitFor(() => expect(useStore.getState().duplicatesState).toBe("listo"));
  });

  it("quita el grupo y sube la cuenta de descartados", async () => {
    useStore.getState().dismissDuplicates("1-2-3");

    await vi.waitFor(() => expect(useStore.getState().duplicates).toEqual([]));
    expect(useStore.getState().duplicatesDismissed).toBe(3);
  });

  it("los devuelve al pedirlo", async () => {
    useStore.getState().restoreDismissedDuplicates();

    await vi.waitFor(() => expect(useStore.getState().duplicates).toEqual([GRUPO]));
  });
});

describe("una lista que ya no vale", () => {
  it("se descarta cuando el catálogo se reemplaza", async () => {
    useStore.getState().findDuplicates();
    await vi.waitFor(() => expect(useStore.getState().duplicates).toHaveLength(1));

    // Un escaneo, una fusión o una restauración traen un catálogo nuevo: los
    // grupos anteriores hablan de pistas que quizá ya no están.
    await useStore.getState().hydrate();

    expect(useStore.getState().duplicates).toEqual([]);
    expect(useStore.getState().duplicatesState).toBe("idle");
  });
});
