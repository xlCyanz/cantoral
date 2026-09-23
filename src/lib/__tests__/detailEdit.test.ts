// Las ediciones del panel de detalle se escriben solas. Lo que se fija aquí es
// que se escriban de verdad —incluidas las que quedan a medio camino cuando el
// usuario cierra el panel o salta a otra pista— y que un fallo no se disfrace.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateTrackCmd =
  vi.fn<
    (id: string, artista: string, tono: string, bpm: number, ocasion: string, tags: string[]) => Promise<void>
  >();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  updateTrackCmd: (
    id: string,
    artista: string,
    tono: string,
    bpm: number,
    ocasion: string,
    tags: string[],
  ) => updateTrackCmd(id, artista, tono, bpm, ocasion, tags),
}));

const { useStore } = await import("../../store");
const initial = useStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  useStore.setState(initial, true);
  updateTrackCmd.mockReset();
  updateTrackCmd.mockResolvedValue(undefined);
  useStore.getState().onRowClick(useStore.getState().tracks[0].id);
});

afterEach(() => {
  // The debounce lives in module scope, so it outlives useStore.setState().
  // Draining it here keeps a half-finished edit from firing inside the next
  // test's mock and being counted as that test's write.
  useStore.getState().flushEdit();
  vi.useRealTimers();
});

const seleccionada = () => {
  const s = useStore.getState();
  return s.tracks.find((t) => t.id === s.selId)!;
};

describe("editar un campo", () => {
  it("lo aplica al catálogo al instante, sin esperar al guardado", () => {
    useStore.getState().setEdit("tono", "Solm");

    expect(seleccionada().tono).toBe("Solm");
    expect(useStore.getState().saveState).toBe("saving");
  });

  it("agrupa una ráfaga de tecleo en una sola escritura", async () => {
    const s = useStore.getState();
    s.setEdit("tono", "S");
    s.setEdit("tono", "So");
    s.setEdit("tono", "Sol");

    expect(updateTrackCmd).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();

    expect(updateTrackCmd).toHaveBeenCalledTimes(1);
    // Manda el valor final, no el que había cuando arrancó el temporizador.
    expect(updateTrackCmd.mock.calls[0][2]).toBe("Sol");
  });

  it("manda el tempo como número, que es lo que espera el i64 de Rust", async () => {
    useStore.getState().setEdit("bpm", 96);
    await vi.runAllTimersAsync();

    const bpm = updateTrackCmd.mock.calls[0][3];
    expect(typeof bpm).toBe("number");
    expect(bpm).toBe(96);
  });

  it("marca «guardado» cuando el backend confirma", async () => {
    useStore.getState().setEdit("ocasion", "Ofrenda");
    await vi.runAllTimersAsync();

    expect(useStore.getState().saveState).toBe("saved");
  });
});

describe("nada queda a medio escribir", () => {
  it("cerrar el panel escribe lo que estaba esperando", () => {
    useStore.getState().setEdit("ocasion", "Bautismo");
    expect(updateTrackCmd).not.toHaveBeenCalled();

    useStore.getState().closeDetail();

    expect(updateTrackCmd).toHaveBeenCalledTimes(1);
    expect(updateTrackCmd.mock.calls[0][4]).toBe("Bautismo");
  });

  it("saltar a otra pista escribe la anterior antes de cambiar", () => {
    const primera = useStore.getState().tracks[0];
    const segunda = useStore.getState().tracks[1];
    useStore.getState().setEdit("tono", "Fa#");

    useStore.getState().onRowClick(segunda.id);

    expect(updateTrackCmd).toHaveBeenCalledTimes(1);
    expect(updateTrackCmd.mock.calls[0][0]).toBe(primera.id);
    expect(updateTrackCmd.mock.calls[0][2]).toBe("Fa#");
  });

  it("flushEdit no escribe nada si no hay nada pendiente", () => {
    useStore.getState().flushEdit();
    expect(updateTrackCmd).not.toHaveBeenCalled();
  });
});

describe("si el guardado falla", () => {
  it("lo dice en vez de aparentar que se guardó", async () => {
    updateTrackCmd.mockRejectedValue(new Error("base bloqueada"));
    useStore.getState().setEdit("tono", "Reb");

    // Only the debounce, not every timer: runAllTimers would also fire the
    // toast's own 2.2s dismissal and clear the very thing being asserted.
    await vi.advanceTimersByTimeAsync(600);

    expect(useStore.getState().saveState).toBe("error");
    expect(useStore.getState().toast?.type).toBe("error");
    expect(useStore.getState().toast?.message).toContain("No se pudieron guardar");
  });

  it("conserva lo tecleado, que el usuario no puede recuperar de otro modo", async () => {
    updateTrackCmd.mockRejectedValue(new Error("no"));
    useStore.getState().setEdit("tono", "Reb");

    await vi.runAllTimersAsync();

    expect(seleccionada().tono).toBe("Reb");
  });
});


describe("corregir el artista", () => {
  it("se escribe como cualquier otro campo", async () => {
    // En una biblioteca de iglesia media el artista viene mal en las etiquetas
    // del archivo —«Track 03», «Unknown Artist»— y hasta ahora se leía y no se
    // podía corregir sin tocar el MP3.
    const id = seleccionada().id;

    useStore.getState().setEdit("artista", "Coro Congregacional");
    await vi.advanceTimersByTimeAsync(600);

    expect(seleccionada().artista).toBe("Coro Congregacional");
    const escrito = updateTrackCmd.mock.calls.find(([llamado]) => llamado === id);
    expect(escrito?.[1]).toBe("Coro Congregacional");
  });

  it("y viaja junto a lo demás, en una sola escritura", async () => {
    useStore.getState().setEdit("artista", "Voces de Gracia");
    useStore.getState().setEdit("tono", "Sol");
    await vi.advanceTimersByTimeAsync(600);

    const llamadas = updateTrackCmd.mock.calls.filter(([id]) => id === seleccionada().id);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0][1]).toBe("Voces de Gracia");
    expect(llamadas[0][2]).toBe("Sol");
  });
});

describe("fijar el panel", () => {
  it("empieza sin fijar y se alterna", () => {
    // Fijado, `Esc` deja de cerrarlo: etiquetando pista por pista, que se
    // cierre al pulsar Esc para salir de un campo es perder el sitio.
    expect(useStore.getState().detailFijado).toBe(false);

    useStore.getState().toggleDetailFijado();
    expect(useStore.getState().detailFijado).toBe(true);

    useStore.getState().toggleDetailFijado();
    expect(useStore.getState().detailFijado).toBe(false);
  });
});
