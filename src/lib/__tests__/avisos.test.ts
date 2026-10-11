// Lo que falla tiene que decirlo (#128). Una copia de seguridad que no llegó
// a escribirse no puede terminar callada, y un corazón que el núcleo rechazó
// no puede quedarse encendido en pantalla.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../types";

const pickSavePath = vi.fn<() => Promise<string | null>>();
const backupDatabase = vi.fn<(dest: string) => Promise<string | null>>();
const setTrackFav = vi.fn<(id: string, fav: boolean) => Promise<void>>();
const closeProjectionCmd = vi.fn<() => Promise<void>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  assetUrl: (p: string) => p,
  pickSavePath: () => pickSavePath(),
  backupDatabase: (dest: string) => backupDatabase(dest),
  setTrackFav: (id: string, fav: boolean) => setTrackFav(id, fav),
  closeProjectionCmd: () => closeProjectionCmd(),
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
    formato: "MP3",
    carpeta: "Himnos",
    fav: false,
    missing: false,
    added: 1,
    ...over,
  };
}

/** Let every pending promise callback run. */
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  useStore.setState(initial, true);
  for (const m of [pickSavePath, backupDatabase, setTrackFav, closeProjectionCmd]) m.mockReset();
  pickSavePath.mockResolvedValue("/copias/cantoral.db");
  setTrackFav.mockResolvedValue(undefined);
  closeProjectionCmd.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  useStore.setState(initial, true);
});

describe("crear copia de seguridad", () => {
  it("si la copia falla lo dice, con el motivo, y no la da por hecha", async () => {
    backupDatabase.mockRejectedValue("Permission denied (os error 13)");

    useStore.getState().backup();
    await settle();

    const toast = useStore.getState().toast;
    expect(toast?.type).toBe("error");
    expect(toast?.titulo).toMatch(/no se pudo crear la copia/i);
    expect(toast?.detalle).toMatch(/permission denied/i);
    expect(useStore.getState().ultimaCopia).toBeNull();
  });

  it("si sale bien dice dónde quedó y recuerda cuándo", async () => {
    backupDatabase.mockResolvedValue("2026-09-27T10:00:00+00:00");

    useStore.getState().backup();
    await settle();

    const toast = useStore.getState().toast;
    expect(toast?.type).not.toBe("error");
    expect(toast?.detalle).toBe("/copias/cantoral.db");
    expect(useStore.getState().ultimaCopia).toBe("2026-09-27T10:00:00+00:00");
  });

  it("cancelar el diálogo no copia ni avisa", async () => {
    pickSavePath.mockResolvedValue(null);

    useStore.getState().backup();
    await settle();

    expect(backupDatabase).not.toHaveBeenCalled();
    expect(useStore.getState().toast).toBeFalsy();
  });
});

describe("marcar favorita", () => {
  beforeEach(() => {
    useStore.setState({ tracks: [track("a")] });
  });

  it("si el núcleo la rechaza, el corazón vuelve como estaba y avisa", async () => {
    setTrackFav.mockRejectedValue("database is locked");

    useStore.getState().onFav("a");
    expect(useStore.getState().tracks[0].fav).toBe(true);
    await settle();

    expect(useStore.getState().tracks[0].fav).toBe(false);
    expect(useStore.getState().toast?.type).toBe("error");
    expect(useStore.getState().toast?.titulo).toMatch(/no se pudo guardar/i);
  });

  it("no pisa un segundo clic que llegó antes del rechazo", async () => {
    let rechazar!: (e: unknown) => void;
    setTrackFav.mockReturnValueOnce(new Promise((_, r) => (rechazar = r)));

    useStore.getState().onFav("a"); // → true, will fail
    useStore.getState().onFav("a"); // → false, saved
    rechazar("database is locked");
    await settle();

    expect(useStore.getState().tracks[0].fav).toBe(false);
  });

  it("si se guarda, se queda", async () => {
    useStore.getState().onFav("a");
    await settle();

    expect(useStore.getState().tracks[0].fav).toBe(true);
    expect(useStore.getState().toast).toBeFalsy();
  });
});

describe("cortar la proyección", () => {
  it("si la ventana no se cierra lo dice: sigue en el proyector", async () => {
    closeProjectionCmd.mockRejectedValue("window not found");
    useStore.setState({ proyectando: true });

    useStore.getState().alternarProyeccion();
    await settle();

    expect(useStore.getState().toast?.type).toBe("error");
    expect(useStore.getState().toast?.titulo).toMatch(/no se pudo cerrar la proyección/i);
  });
});
