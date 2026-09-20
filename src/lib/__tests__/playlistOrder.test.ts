// Reordenar y quitar pistas de una lista escriben de forma optimista. Lo que se
// fija aquí es la otra mitad: que un fallo del backend no se quede en silencio
// con la pantalla mostrando un orden que la base nunca recibió.

import { beforeEach, describe, expect, it, vi } from "vitest";

const setPlaylistOrderCmd = vi.fn<(playlist: string, ids: string[]) => Promise<void>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  setPlaylistOrderCmd: (playlist: string, ids: string[]) => setPlaylistOrderCmd(playlist, ids),
}));

const { useStore } = await import("../../store");
const initial = useStore.getState();

beforeEach(() => {
  useStore.setState(initial, true);
  setPlaylistOrderCmd.mockReset();
  setPlaylistOrderCmd.mockResolvedValue(undefined);
});

/** Ids of the list currently open, in order. */
const orden = () => useStore.getState().plOrder[useStore.getState().curPlaylist];

describe("quitar una pista de la lista", () => {
  it("la quita al instante y lo persiste", async () => {
    const [primero, ...resto] = orden();

    useStore.getState().removeFromPl(primero);

    expect(orden()).toEqual(resto);
    expect(setPlaylistOrderCmd).toHaveBeenCalledWith(useStore.getState().curPlaylist, resto);
  });

  it("devuelve el orden anterior si el backend falla, y lo dice", async () => {
    const antes = orden();
    setPlaylistOrderCmd.mockRejectedValue(new Error("disco lleno"));

    useStore.getState().removeFromPl(antes[0]);
    await vi.waitFor(() => expect(useStore.getState().toast?.type).toBe("error"));

    expect(orden()).toEqual(antes);
    expect(useStore.getState().toast?.message).toContain("No se pudo guardar el orden");
  });
});

describe("reordenar arrastrando", () => {
  it("mueve la pista y lo persiste", () => {
    const antes = orden();
    const s = useStore.getState();

    s.setDragging(antes[0]);
    s.reorderPl(antes[2]);

    const despues = orden();
    expect(despues).not.toEqual(antes);
    expect(despues).toHaveLength(antes.length);
    expect(despues[2]).toBe(antes[0]);
    expect(setPlaylistOrderCmd).toHaveBeenCalledWith(s.curPlaylist, despues);
  });

  it("devuelve el orden anterior si el backend falla", async () => {
    const antes = orden();
    setPlaylistOrderCmd.mockRejectedValue(new Error("no"));
    const s = useStore.getState();

    s.setDragging(antes[0]);
    s.reorderPl(antes[2]);
    await vi.waitFor(() => expect(useStore.getState().toast?.type).toBe("error"));

    expect(orden()).toEqual(antes);
  });
});
