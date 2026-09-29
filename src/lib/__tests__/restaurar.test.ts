// Una restauración que falla deja la biblioteca anterior en su sitio, y eso se
// dice con un aviso. Pero si la base anterior tampoco se pudo reabrir, el núcleo
// queda sobre una base vacía en memoria y solo reiniciar la recupera: eso no
// cabe en un aviso de cinco segundos, ocupa la biblioteca (#124).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { BIBLIOTECA_SIN_ABRIR, type BackupInfo, type Snapshot } from "../api";
import type { Track } from "../types";

const getLibrary = vi.fn<() => Promise<Snapshot | null>>();
const pickDbFile = vi.fn<() => Promise<string | null>>();
const inspectBackup = vi.fn<(src: string) => Promise<BackupInfo>>();
const restoreDatabaseCmd = vi.fn<(src: string) => Promise<Snapshot>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  // The store decides at module-eval time whether it is running under Tauri;
  // without this it would load the browser seed and never call a command.
  isTauri: () => true,
  getLibrary: () => getLibrary(),
  pickDbFile: () => pickDbFile(),
  inspectBackup: (src: string) => inspectBackup(src),
  restoreDatabaseCmd: (src: string) => restoreDatabaseCmd(src),
  assetUrl: (p: string) => p,
}));

const { useStore } = await import("../../store");
const initial = useStore.getState();

function track(id: string): Track {
  return {
    id,
    titulo: `Pista ${id}`,
    artista: "Artista",
    album: "Album",
    dur: "3:00",
    durSec: 180,
    ocasion: "Adoración",
    formato: "MP3",
    carpeta: "Himnos",
    fav: false,
    missing: false,
    tieneHoja: false,
    added: 1,
  };
}

/** Pick the file, get through the confirmation and let the restore settle. */
async function restaurar() {
  useStore.getState().restore();
  await vi.waitFor(() => expect(useStore.getState().confirm).toBeTruthy());
  useStore.getState().confirm!.onConfirm();
  await vi.waitFor(() => expect(restoreDatabaseCmd).toHaveBeenCalled());
  // One more turn for the rejection to reach the store's `.catch`.
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  useStore.setState(initial, true);
  useStore.setState({ tracks: [track("a")], libState: "content" });
  for (const m of [getLibrary, pickDbFile, inspectBackup, restoreDatabaseCmd]) m.mockReset();
  getLibrary.mockResolvedValue(null);
  pickDbFile.mockResolvedValue("/respaldo.db");
  inspectBackup.mockResolvedValue({ tracks: 3, folders: 1, playlists: 0, version: 10, appVersion: 10 });
});

describe("la versión del respaldo en la confirmación", () => {
  async function confirmacion() {
    useStore.getState().restore();
    await vi.waitFor(() => expect(useStore.getState().confirm).toBeTruthy());
    return useStore.getState().confirm!;
  }

  it("un respaldo de la versión actual no añade nada", async () => {
    expect((await confirmacion()).detail).not.toMatch(/versión anterior/);
  });

  it("uno anterior avisa de que se actualizará al restaurarlo", async () => {
    inspectBackup.mockResolvedValue({ tracks: 3, folders: 1, playlists: 0, version: 0, appVersion: 10 });
    expect((await confirmacion()).detail).toMatch(/versión anterior de Cantoral: se actualizará al restaurarlo/);
  });

  it("uno más nuevo, rechazado al leerlo, no llega a preguntar", async () => {
    const msg = "Este respaldo es de una versión más nueva de Cantoral. Actualiza la app antes de restaurarlo.";
    inspectBackup.mockRejectedValue(msg);
    const silencio = vi.spyOn(console, "error").mockImplementation(() => {});

    useStore.getState().restore();

    await vi.waitFor(() => expect(useStore.getState().toast?.titulo).toBe(msg));
    expect(useStore.getState().confirm).toBeFalsy();
    expect(restoreDatabaseCmd).not.toHaveBeenCalled();
    silencio.mockRestore();
  });
});

describe("restaurar un respaldo que falla", () => {
  it("con la biblioteca anterior reabierta, lo dice un aviso y la biblioteca sigue", async () => {
    restoreDatabaseCmd.mockRejectedValue("file is not a database");

    await restaurar();

    const st = useStore.getState();
    expect(st.libState).toBe("content");
    expect(st.scanError).toBeNull();
    expect(st.toast?.titulo).toMatch(/no se pudo restaurar/i);
  });

  it("sin poder reabrirla, ocupa la biblioteca con el error y no se queda en un aviso", async () => {
    restoreDatabaseCmd.mockRejectedValue(BIBLIOTECA_SIN_ABRIR);

    await restaurar();

    const st = useStore.getState();
    expect(st.libState).toBe("error");
    expect(st.scanError).toBe(BIBLIOTECA_SIN_ABRIR);
    expect(st.toast?.titulo ?? "").not.toMatch(/no se pudo restaurar/i);
  });

  it("y «Volver a intentarlo» no recarga la base vacía que quedó en su lugar", async () => {
    restoreDatabaseCmd.mockRejectedValue(BIBLIOTECA_SIN_ABRIR);
    await restaurar();

    // Twice: the retry action is consumed on use and must re-arm itself.
    for (let i = 0; i < 2; i++) {
      useStore.getState().retryError();
      await new Promise((r) => setTimeout(r, 0));
      expect(useStore.getState().libState).toBe("error");
      expect(useStore.getState().scanError).toBe(BIBLIOTECA_SIN_ABRIR);
    }
    expect(getLibrary).not.toHaveBeenCalled();
  });
});
