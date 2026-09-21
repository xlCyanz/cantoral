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

describe("reordenar con el teclado", () => {
  it("sube una pista y lo persiste", () => {
    const antes = orden();
    const segunda = antes[1];

    useStore.getState().moveInPlaylist(segunda, -1);

    expect(orden()[0]).toBe(segunda);
    expect(setPlaylistOrderCmd).toHaveBeenCalledWith(useStore.getState().curPlaylist, orden());
  });

  it("baja una pista", () => {
    const antes = orden();

    useStore.getState().moveInPlaylist(antes[0], 1);

    expect(orden()[1]).toBe(antes[0]);
    expect(orden()[0]).toBe(antes[1]);
  });

  it("no se sale por los extremos", () => {
    const antes = orden();

    useStore.getState().moveInPlaylist(antes[0], -1);
    useStore.getState().moveInPlaylist(antes[antes.length - 1], 1);

    // Dar la vuelta mandaría la primera al final de un culto, que nadie quiso.
    expect(orden()).toEqual(antes);
    expect(setPlaylistOrderCmd).not.toHaveBeenCalled();
  });

  it("ignora una pista que no está en la lista", () => {
    const antes = orden();

    useStore.getState().moveInPlaylist("no-existe", 1);

    expect(orden()).toEqual(antes);
    expect(setPlaylistOrderCmd).not.toHaveBeenCalled();
  });

  it("dice en voz alta dónde quedó", () => {
    // Mover una fila con el teclado es mudo si no: la lista se vuelve a pintar
    // y nada cuenta a dónde fue la canción.
    const segunda = orden()[1];
    const titulo = useStore.getState().tracks.find((t) => t.id === segunda)!.titulo;

    useStore.getState().moveInPlaylist(segunda, -1);

    expect(useStore.getState().reorderNotice).toBe(`«${titulo}», posición 1 de ${orden().length}`);
  });

  it("devuelve el orden anterior si el backend falla", async () => {
    const antes = orden();
    setPlaylistOrderCmd.mockRejectedValue(new Error("disco lleno"));

    useStore.getState().moveInPlaylist(antes[1], -1);
    await vi.waitFor(() => expect(useStore.getState().toast?.type).toBe("error"));

    expect(orden()).toEqual(antes);
  });
});
