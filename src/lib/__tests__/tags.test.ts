// Renombrar una etiqueta reescribe todas las pistas que la llevan, y unir dos
// no se deshace renombrando de vuelta. Lo que se fija aquí es que nada de eso
// pase sin que el usuario lo pida, y que dos formas de escribir la misma
// etiqueta no lleguen a existir.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Snapshot } from "../api";
import type { Track } from "../types";
import { etiquetaEquivalente, normalizarEtiqueta } from "../tags";

const renameTagCmd = vi.fn<(from: string, to: string) => Promise<Snapshot | null>>();
const deleteTagCmd = vi.fn<(name: string) => Promise<Snapshot | null>>();
const updateTrackCmd = vi.fn<() => Promise<void>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  assetUrl: (p: string) => p,
  renameTagCmd: (from: string, to: string) => renameTagCmd(from, to),
  deleteTagCmd: (name: string) => deleteTagCmd(name),
  updateTrackCmd: () => updateTrackCmd(),
}));

const { useStore, etiquetas } = await import("../../store");
const initial = useStore.getState();

function track(id: string, tags: string[]): Track {
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
    tags,
    fav: false,
    missing: false,
    tieneHoja: false,
    added: 1,
  };
}

describe("normalizarEtiqueta", () => {
  it("recorta y colapsa los espacios", () => {
    expect(normalizarEtiqueta("  muy   lento  ")).toBe("muy lento");
    expect(normalizarEtiqueta("lento")).toBe("lento");
  });

  it("deja en nada lo que era solo espacios", () => {
    expect(normalizarEtiqueta("   ")).toBe("");
    expect(normalizarEtiqueta("")).toBe("");
  });
});

describe("etiquetaEquivalente", () => {
  it("encuentra la que ya existe aunque se escriba distinto", () => {
    expect(etiquetaEquivalente("Lento", ["lento", "clásico"])).toBe("lento");
    expect(etiquetaEquivalente("  LENTO ", ["lento"])).toBe("lento");
  });

  it("devuelve nada cuando de verdad es nueva", () => {
    expect(etiquetaEquivalente("júbilo", ["lento"])).toBeNull();
    expect(etiquetaEquivalente("   ", ["lento"])).toBeNull();
  });
});

describe("acciones sobre etiquetas", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useStore.setState(initial, true);
    for (const m of [renameTagCmd, deleteTagCmd, updateTrackCmd]) m.mockReset();
    renameTagCmd.mockResolvedValue(null);
    deleteTagCmd.mockResolvedValue(null);
    updateTrackCmd.mockResolvedValue(undefined);
    useStore.setState({
      tracks: [track("1", ["lento", "clásico"]), track("2", ["lento"])],
      tagFilter: [],
    });
  });

  afterEach(() => {
    useStore.getState().flushEdit();
    vi.useRealTimers();
  });

  it("el filtro se enciende y se apaga con el mismo chip", () => {
    useStore.getState().onTagFilter("lento");
    expect(useStore.getState().tagFilter).toEqual(["lento"]);

    useStore.getState().onTagFilter("lento");
    expect(useStore.getState().tagFilter).toEqual([]);
  });

  it("un segundo chip acota en vez de reemplazar", () => {
    useStore.getState().onTagFilter("lento");
    useStore.getState().onTagFilter("clásico");

    expect(useStore.getState().tagFilter).toEqual(["lento", "clásico"]);
  });

  it("renombrar a un nombre libre no pregunta nada", async () => {
    useStore.getState().renameTag("lento", "muy lento");

    expect(useStore.getState().confirm).toBeNull();
    await vi.waitFor(() => expect(renameTagCmd).toHaveBeenCalledWith("lento", "muy lento"));
  });

  it("renombrar sobre una etiqueta que ya existe pide confirmación", () => {
    // Unir dos no se deshace renombrando de vuelta: las pistas de una y otra
    // ya no se distinguen.
    useStore.getState().renameTag("lento", "clásico");

    expect(renameTagCmd).not.toHaveBeenCalled();
    expect(useStore.getState().confirm?.title).toMatch(/unir/i);
    expect(useStore.getState().confirm?.detail).toContain("2 pistas");
  });

  it("y la hace al aceptar", async () => {
    useStore.getState().renameTag("lento", "clásico");
    useStore.getState().acceptConfirm();

    await vi.waitFor(() => expect(renameTagCmd).toHaveBeenCalledWith("lento", "clásico"));
  });

  it("ignora un renombrado que no cambia nada", () => {
    useStore.getState().renameTag("lento", "lento");
    useStore.getState().renameTag("lento", "   ");

    expect(renameTagCmd).not.toHaveBeenCalled();
    expect(useStore.getState().confirm).toBeNull();
  });

  it("el filtro sigue a la etiqueta renombrada", async () => {
    // Si no, queda apuntando a un nombre que ya no existe y la biblioteca se
    // queda vacía sin decir por qué.
    useStore.getState().onTagFilter("lento");

    useStore.getState().renameTag("lento", "muy lento");

    await vi.waitFor(() => expect(useStore.getState().tagFilter).toEqual(["muy lento"]));
  });

  it("borrar pide confirmación y dice a cuántas pistas afecta", () => {
    useStore.getState().deleteTag("lento");

    expect(deleteTagCmd).not.toHaveBeenCalled();
    expect(useStore.getState().confirm?.detail).toContain("2 pistas");
  });

  it("y al aceptar quita también su filtro", async () => {
    useStore.getState().onTagFilter("lento");

    useStore.getState().deleteTag("lento");
    useStore.getState().acceptConfirm();

    await vi.waitFor(() => expect(deleteTagCmd).toHaveBeenCalledWith("lento"));
    expect(useStore.getState().tagFilter).toEqual([]);
  });
});

describe("agregar una etiqueta", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useStore.setState(initial, true);
    updateTrackCmd.mockReset();
    updateTrackCmd.mockResolvedValue(undefined);
    useStore.setState({ tracks: [track("1", ["lento"]), track("2", [])] });
    useStore.getState().onRowClick("2");
  });

  afterEach(() => {
    useStore.getState().flushEdit();
    vi.useRealTimers();
  });

  const etiquetasDe = (id: string) => useStore.getState().tracks.find((t) => t.id === id)!.tags;

  it("usa la que ya existe cuando solo cambia la capitalización", () => {
    // `tags.name` distingue mayúsculas, así que «Lento» y «lento» serían dos
    // filas que nadie ve que son dos. Aquí el par no llega a formarse.
    useStore.getState().addTag("Lento");

    expect(etiquetasDe("2")).toEqual(["lento"]);
    expect(useStore.getState().toast?.titulo).toMatch(/ya existía/);
  });

  it("recorta y colapsa los espacios de una etiqueta nueva", () => {
    useStore.getState().addTag("  muy   lento ");

    expect(etiquetasDe("2")).toEqual(["muy lento"]);
  });

  it("no dice nada cuando la etiqueta es nueva de verdad", () => {
    useStore.getState().addTag("júbilo");

    expect(etiquetasDe("2")).toEqual(["júbilo"]);
    expect(useStore.getState().toast).toBeNull();
  });

  it("no agrega dos veces la misma", () => {
    useStore.getState().addTag("júbilo");
    useStore.getState().addTag("júbilo");

    expect(etiquetasDe("2")).toEqual(["júbilo"]);
  });

  it("no agrega nada en blanco", () => {
    useStore.getState().addTag("   ");

    expect(etiquetasDe("2")).toEqual([]);
  });

  it("la lista de etiquetas recoge la nueva al instante", () => {
    useStore.getState().addTag("júbilo");

    expect(etiquetas(useStore.getState()).map((e) => e.nombre)).toEqual(["júbilo", "lento"]);
  });
});
