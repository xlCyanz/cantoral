// Una acción en bloque toca varias pistas a la vez, así que lo caro de
// equivocarse sube con la selección. Lo que se fija aquí es que lo que se
// manda sea exactamente lo que el usuario tiene elegido y ve en pantalla, y
// que quitar pistas no ocurra sin confirmar.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Snapshot } from "../api";
import type { Track } from "../types";

const addTracksToPlaylistCmd = vi.fn<(pl: string, ids: string[]) => Promise<Snapshot | null>>();
const setTracksFavCmd = vi.fn<(ids: string[], fav: boolean) => Promise<Snapshot | null>>();
const tagTracksCmd = vi.fn<(ids: string[], tag: string, add: boolean) => Promise<Snapshot | null>>();
const deleteTracksCmd = vi.fn<(ids: string[]) => Promise<Snapshot | null>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  assetUrl: (p: string) => p,
  addTracksToPlaylistCmd: (pl: string, ids: string[]) => addTracksToPlaylistCmd(pl, ids),
  setTracksFavCmd: (ids: string[], fav: boolean) => setTracksFavCmd(ids, fav),
  tagTracksCmd: (ids: string[], tag: string, add: boolean) => tagTracksCmd(ids, tag, add),
  deleteTracksCmd: (ids: string[]) => deleteTracksCmd(ids),
}));

const { useStore, pistasParaAgregar, seleccionVigente } = await import("../../store");
const initial = useStore.getState();

function track(id: string, over: Partial<Track> = {}): Track {
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
    tags: [],
    fav: false,
    missing: false,
    tieneHoja: false,
    added: 1,
    ...over,
  };
}

/** Five tracks whose titles sort a, b, c, d, e. */
const CINCO = ["a", "b", "c", "d", "e"].map((id) => track(id, { titulo: `Pista ${id}` }));

beforeEach(() => {
  useStore.setState(initial, true);
  for (const m of [addTracksToPlaylistCmd, setTracksFavCmd, tagTracksCmd, deleteTracksCmd]) m.mockReset();
  for (const m of [addTracksToPlaylistCmd, setTracksFavCmd, tagTracksCmd, deleteTracksCmd]) {
    m.mockResolvedValue(null);
  }
  useStore.setState({
    tracks: CINCO,
    playlists: [{ id: "p1", nombre: "Culto", fecha: "", ocasion: "", ids: [], plantilla: false }],
    plOrder: { p1: [] },
    curPlaylist: "p1",
    selection: [],
    selAnchor: null,
  });
});

afterEach(() => {
  useStore.setState(initial, true);
});

describe("elegir filas", () => {
  it("un clic normal elige una y abre el detalle", () => {
    useStore.getState().onRowClick("c");

    expect(useStore.getState().selection).toEqual(["c"]);
    expect(useStore.getState().detailOpen).toBe(true);
  });

  it("⌘/Ctrl suma sin abrir el detalle", () => {
    useStore.getState().onRowClick("b", { meta: true });
    useStore.getState().onRowClick("d", { meta: true });

    expect(useStore.getState().selection).toEqual(["b", "d"]);
    expect(useStore.getState().detailOpen).toBe(false);
  });

  it("Mayús toma el tramo en el orden que se ve", () => {
    useStore.getState().onRowClick("b");
    useStore.getState().onRowClick("d", { shift: true });

    expect(seleccionVigente(useStore.getState())).toEqual(["b", "c", "d"]);
  });

  it("«todo» elige lo que la biblioteca muestra, no el catálogo entero", () => {
    // Con un filtro puesto, seleccionar todo no puede alcanzar lo que está
    // fuera de la vista.
    useStore.setState({ query: "Pista b" });

    useStore.getState().selectAllVisible();

    expect(seleccionVigente(useStore.getState())).toEqual(["b"]);
  });
});

describe("seleccionVigente", () => {
  it("devuelve lo elegido en el orden de la pantalla", () => {
    useStore.setState({ selection: ["d", "a", "c"] });

    expect(seleccionVigente(useStore.getState())).toEqual(["a", "c", "d"]);
  });

  it("suelta lo que un filtro dejó fuera", () => {
    // Una acción en bloque no puede tocar pistas que el usuario ya no ve.
    useStore.setState({ selection: ["a", "b", "c"], query: "Pista a" });

    expect(seleccionVigente(useStore.getState())).toEqual(["a"]);
  });

  it("suelta lo que desapareció del catálogo", () => {
    useStore.setState({ selection: ["a", "fantasma"] });

    expect(seleccionVigente(useStore.getState())).toEqual(["a"]);
  });
});

describe("agregar a una lista", () => {
  it("manda la selección en el orden que se ve, no en el de los clics", () => {
    useStore.setState({ selection: ["d", "a", "c"] });

    useStore.getState().bulkAddToPlaylist("p1");

    expect(addTracksToPlaylistCmd).toHaveBeenCalledWith("p1", ["a", "c", "d"]);
  });

  it("no manda nada sin selección", () => {
    useStore.getState().bulkAddToPlaylist("p1");

    expect(addTracksToPlaylistCmd).not.toHaveBeenCalled();
  });

  it("si ya estaban todas lo dice, en vez de contar cero agregadas", () => {
    // «0 pistas agregadas» se lee como que algo falló. Ya estaban, que es un
    // resultado y no un fallo.
    useStore.setState({ plOrder: { p1: ["a", "b"] }, selection: ["a", "b"] });
    addTracksToPlaylistCmd.mockResolvedValue(null);

    useStore.getState().bulkAddToPlaylist("p1");

    return vi.waitFor(() => {
      expect(useStore.getState().toast?.message).toContain("Ya estaban todas");
      expect(useStore.getState().toast?.type).toBe("info");
    });
  });

  it("y con una sola pista lo dice en singular", () => {
    useStore.setState({ plOrder: { p1: ["a"] }, selection: ["a"] });

    useStore.getState().bulkAddToPlaylist("p1");

    return vi.waitFor(() => expect(useStore.getState().toast?.message).toContain("Ya estaba en"));
  });
});

describe("una sola forma de agregar a un culto", () => {
  it("con selección, actúa sobre la selección", () => {
    useStore.setState({ selection: ["b", "a"] });

    expect(pistasParaAgregar(useStore.getState())).toEqual(["a", "b"]);
  });

  it("sin selección, sobre lo que el panel de detalle tiene abierto", () => {
    useStore.setState({ selection: [], selId: "c", detailOpen: true });

    expect(pistasParaAgregar(useStore.getState())).toEqual(["c"]);
  });

  it("la selección manda sobre el panel, que puede llevar abierto desde hace rato", () => {
    useStore.setState({ selection: ["d"], selId: "c", detailOpen: true });

    expect(pistasParaAgregar(useStore.getState())).toEqual(["d"]);
  });

  it("un panel cerrado no cuenta aunque recuerde una pista", () => {
    useStore.setState({ selection: [], selId: "c", detailOpen: false });

    expect(pistasParaAgregar(useStore.getState())).toEqual([]);
  });

  it("no abre un diálogo que no tendría nada que agregar", () => {
    // Un diálogo vacío con un «Cancelar» es peor que no responder al atajo.
    useStore.setState({ selection: [], detailOpen: false });

    useStore.getState().openAddToList();

    expect(useStore.getState().dialog).toBeNull();
  });

  it("y al abrirlo cierra el menú contextual, que es desde donde se pudo pedir", () => {
    useStore.setState({ selection: ["a"], rowMenu: { id: "a", x: 0, y: 0 } });

    useStore.getState().openAddToList();

    expect(useStore.getState().dialog).toBe("addToList");
    expect(useStore.getState().rowMenu).toBeNull();
  });

  it("al elegir el culto agrega, cierra y deshace la selección", () => {
    useStore.setState({ selection: ["a", "b"] });
    useStore.getState().openAddToList();

    useStore.getState().addToListConfirm("p1");

    expect(addTracksToPlaylistCmd).toHaveBeenCalledWith("p1", ["a", "b"]);
    expect(useStore.getState().dialog).toBeNull();
    // Lo que se quería hacer con ella ya está hecho; dejarla puesta deja la
    // fila de herramientas ocupada por una barra sin trabajo.
    expect(useStore.getState().selection).toEqual([]);
  });

  it("también agrega la pista del panel cuando no hay selección", () => {
    useStore.setState({ selection: [], selId: "e", detailOpen: true });

    useStore.getState().addToListConfirm("p1");

    expect(addTracksToPlaylistCmd).toHaveBeenCalledWith("p1", ["e"]);
  });
});

describe("favoritas en bloque", () => {
  it("marca al instante y lo persiste", () => {
    useStore.setState({ selection: ["a", "c"] });

    useStore.getState().bulkFav(true);

    const favs = useStore.getState().tracks.filter((t) => t.fav).map((t) => t.id);
    expect(favs).toEqual(["a", "c"]);
    expect(setTracksFavCmd).toHaveBeenCalledWith(["a", "c"], true);
  });

  it("y las desmarca", () => {
    useStore.setState({ tracks: CINCO.map((t) => ({ ...t, fav: true })), selection: ["a"] });

    useStore.getState().bulkFav(false);

    expect(useStore.getState().tracks.find((t) => t.id === "a")!.fav).toBe(false);
    expect(useStore.getState().tracks.find((t) => t.id === "b")!.fav).toBe(true);
  });
});

describe("etiquetar en bloque", () => {
  it("pone la etiqueta en todas las elegidas", () => {
    useStore.setState({ selection: ["a", "b"] });

    useStore.getState().bulkTag("navidad", true);

    expect(useStore.getState().tracks.find((t) => t.id === "a")!.tags).toEqual(["navidad"]);
    expect(tagTracksCmd).toHaveBeenCalledWith(["a", "b"], "navidad", true);
  });

  it("se acopla a la etiqueta que ya existe en vez de crear otra", () => {
    // El mismo cuidado que el panel de detalle: una edición en bloque no puede
    // ser lo que invente una segunda forma de escribir la misma etiqueta.
    useStore.setState({
      tracks: [track("a", { tags: ["navidad"] }), track("b")],
      selection: ["b"],
    });

    useStore.getState().bulkTag("Navidad", true);

    expect(useStore.getState().tracks.find((t) => t.id === "b")!.tags).toEqual(["navidad"]);
    expect(tagTracksCmd).toHaveBeenCalledWith(["b"], "navidad", true);
  });

  it("la quita de todas las elegidas", () => {
    useStore.setState({
      tracks: [track("a", { tags: ["navidad", "lento"] }), track("b", { tags: ["navidad"] })],
      selection: ["a"],
    });

    useStore.getState().bulkTag("navidad", false);

    expect(useStore.getState().tracks.find((t) => t.id === "a")!.tags).toEqual(["lento"]);
    expect(useStore.getState().tracks.find((t) => t.id === "b")!.tags).toEqual(["navidad"]);
  });

  it("ignora una etiqueta en blanco", () => {
    useStore.setState({ selection: ["a"] });

    useStore.getState().bulkTag("   ", true);

    expect(tagTracksCmd).not.toHaveBeenCalled();
  });
});

describe("quitar en bloque", () => {
  it("no quita nada hasta que el usuario confirma", () => {
    useStore.setState({ selection: ["a", "b"] });

    useStore.getState().bulkDelete();

    expect(deleteTracksCmd).not.toHaveBeenCalled();
    expect(useStore.getState().confirm?.title).toContain("2 pistas");
  });

  it("nombra los cultos que pierden algo", () => {
    // Un número suelto no deja decidir: quitar una pista del culto del domingo
    // que viene no es lo mismo que quitarla de una plantilla de hace un año.
    useStore.setState({
      selection: ["a", "b"],
      playlists: [
        { id: "p1", nombre: "Domingo de alabanza", fecha: "", ocasion: "", ids: [], plantilla: false },
        { id: "p2", nombre: "Reunión de jóvenes", fecha: "", ocasion: "", ids: [], plantilla: false },
      ],
      plOrder: { p1: ["a"], p2: ["b"] },
    });

    useStore.getState().bulkDelete();

    const msg = useStore.getState().confirm?.message ?? "";
    expect(msg).toContain("2 cultos");
    expect(msg).toContain("Domingo de alabanza");
    expect(msg).toContain("Reunión de jóvenes");
  });

  it("y no nombra el que no pierde nada", () => {
    useStore.setState({
      selection: ["a"],
      playlists: [
        { id: "p1", nombre: "Con la pista", fecha: "", ocasion: "", ids: [], plantilla: false },
        { id: "p2", nombre: "Sin nada suyo", fecha: "", ocasion: "", ids: [], plantilla: false },
      ],
      plOrder: { p1: ["a"], p2: ["z"] },
    });

    useStore.getState().bulkDelete();

    const msg = useStore.getState().confirm?.message ?? "";
    expect(msg).toContain("1 culto (Con la pista)");
    expect(msg).not.toContain("Sin nada suyo");
  });

  it("un culto se nombra una vez aunque se lleve varias de las pistas", () => {
    // Contando apariciones salía un número mayor que la propia selección —
    // «3 pistas» y «6 cultos», que no significa nada.
    useStore.setState({
      selection: ["a", "b"],
      playlists: [
        { id: "p1", nombre: "Uno", fecha: "", ocasion: "", ids: [], plantilla: false },
        { id: "p2", nombre: "Dos", fecha: "", ocasion: "", ids: [], plantilla: false },
        { id: "p3", nombre: "Tres", fecha: "", ocasion: "", ids: [], plantilla: false },
      ],
      plOrder: { p1: ["a"], p2: ["a"], p3: ["a", "b"] },
    });

    useStore.getState().bulkDelete();

    expect(useStore.getState().confirm?.message).toContain("3 cultos");
  });

  it("al aceptar manda la selección y la vacía", async () => {
    useStore.setState({ selection: ["a", "b"] });

    useStore.getState().bulkDelete();
    useStore.getState().acceptConfirm();

    await vi.waitFor(() => expect(deleteTracksCmd).toHaveBeenCalledWith(["a", "b"]));
    expect(useStore.getState().selection).toEqual([]);
  });
});

describe("el menú contextual", () => {
  it("una fila fuera de la selección pasa a ser la selección", () => {
    useStore.setState({ selection: ["a", "b"] });

    useStore.getState().openRowMenu("d", 10, 10);

    expect(useStore.getState().selection).toEqual(["d"]);
  });

  it("una fila dentro de la selección la deja intacta", () => {
    // Si no, clic derecho sobre una de veinte elegidas tiraría las otras
    // diecinueve justo antes de actuar sobre ellas.
    useStore.setState({ selection: ["a", "b"] });

    useStore.getState().openRowMenu("b", 10, 10);

    expect(useStore.getState().selection).toEqual(["a", "b"]);
  });
});
