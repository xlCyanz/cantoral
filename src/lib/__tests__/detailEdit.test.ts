// El panel de detalle ya edita tono, tempo y ocasión, no solo etiquetas. Lo que
// se fija aquí es que esos tres lleguen al backend con el tipo correcto, y que
// un guardado que falla no se anuncie como exitoso.

import { beforeEach, describe, expect, it, vi } from "vitest";

const updateTrackCmd =
  vi.fn<(id: string, tono: string, bpm: number, ocasion: string, tags: string[]) => Promise<void>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  updateTrackCmd: (id: string, tono: string, bpm: number, ocasion: string, tags: string[]) =>
    updateTrackCmd(id, tono, bpm, ocasion, tags),
}));

const { useStore } = await import("../../store");
const initial = useStore.getState();

beforeEach(() => {
  useStore.setState(initial, true);
  updateTrackCmd.mockReset();
  updateTrackCmd.mockResolvedValue(undefined);
  useStore.getState().onRowClick(useStore.getState().tracks[0].id);
});

const seleccionada = () => {
  const s = useStore.getState();
  return s.tracks.find((t) => t.id === s.selId)!;
};

describe("editar los datos del culto", () => {
  it("manda tono, tempo y ocasión al backend", async () => {
    const s = useStore.getState();
    s.setEdit("tono", "Solm");
    s.setEdit("bpm", 72);
    s.setEdit("ocasion", "Comunión");

    useStore.getState().saveDetail();

    expect(updateTrackCmd).toHaveBeenCalledWith(
      seleccionada().id,
      "Solm",
      72,
      "Comunión",
      expect.any(Array),
    );
  });

  it("el tempo viaja como número, que es lo que espera el i64 de Rust", () => {
    useStore.getState().setEdit("bpm", 96);

    useStore.getState().saveDetail();

    const bpm = updateTrackCmd.mock.calls[0][2];
    expect(typeof bpm).toBe("number");
    expect(bpm).toBe(96);
  });

  it("aplica los cambios al catálogo y descarta el borrador", async () => {
    const id = useStore.getState().selId!;
    useStore.getState().setEdit("ocasion", "Ofrenda");

    useStore.getState().saveDetail();

    expect(seleccionada().ocasion).toBe("Ofrenda");
    expect(useStore.getState().edit[id]).toBeUndefined();
    expect(useStore.getState().saved).toBe(true);
  });

  it("no toca nada cuando no hay cambios pendientes", () => {
    useStore.getState().saveDetail();
    expect(updateTrackCmd).not.toHaveBeenCalled();
  });
});

describe("si el guardado falla", () => {
  it("devuelve los valores anteriores en vez de cantar victoria", async () => {
    const antes = { ...seleccionada() };
    updateTrackCmd.mockRejectedValue(new Error("base bloqueada"));
    useStore.getState().setEdit("tono", "Reb");
    useStore.getState().setEdit("bpm", 140);

    useStore.getState().saveDetail();
    await vi.waitFor(() => expect(useStore.getState().toast?.type).toBe("error"));

    expect(seleccionada().tono).toBe(antes.tono);
    expect(seleccionada().bpm).toBe(antes.bpm);
    expect(useStore.getState().saved).toBe(false);
    expect(useStore.getState().toast?.message).toContain("No se pudieron guardar");
  });

  it("conserva el borrador para no perder lo escrito", async () => {
    const id = useStore.getState().selId!;
    updateTrackCmd.mockRejectedValue(new Error("no"));
    useStore.getState().setEdit("tono", "Reb");

    useStore.getState().saveDetail();
    await vi.waitFor(() => expect(useStore.getState().toast?.type).toBe("error"));

    expect(useStore.getState().edit[id]?.tono).toBe("Reb");
  });
});
