// Filtro, gestión y aviso post-canción de los cantantes.
//
// En el store todo va por `backend()`, igual que en producción: aquí la base
// en memoria hace de núcleo (ver `lib/backend/memoria.ts`), así que las"
// acciones también ejercen el camino de la instantánea que responde a cada
// cambio, no solo su optimismo.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CantoralState } from "../../store";
import type { Track } from "../types";

const { useStore, applyFilters, visibleListRows } = await import("../../store");
const { usarBackend } = await import("../backend");
const { crearMemoria } = await import("../backend/memoria");

const initial = useStore.getState();

function track(id: string, singers: string[] = [], over: Partial<Track> = {}): Track {
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
    singers,
    ...over,
  };
}

const TODAS = [track("a", ["Ana"]), track("b", ["José"]), track("c", ["Ana", "José"]), track("d", [])];

/** La base de memoria con el mismo catálogo que ve el store. */
function crearBackendCon() {
  usarBackend(
    crearMemoria({
      tracks: structuredClone(TODAS),
      folders: [],
      playlists: [],
      singers: [
        { id: "c1", nombre: "Ana" },
        { id: "c2", nombre: "José" },
      ],
    }),
  );
}

beforeEach(() => {
  crearBackendCon();
  // El estado como lo deja un arranque: catálogo e instantánea ya aplicados.
  useStore.setState(
    {
      ...initial,
      tracks: structuredClone(TODAS),
      singers: [
        { id: "c1", nombre: "Ana" },
        { id: "c2", nombre: "José" },
      ],
    },
    true,
  );
});

afterEach(() => {
  usarBackend(null);
});

describe("el filtro «Hoy cantan»", () => {
  it("sin filtro se ven todas las pistas", () => {
    useStore.setState({ tracks: structuredClone(TODAS) });
    expect(applyFilters(useStore.getState()).map((t) => t.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("con un cantante se ven las que se sabe", () => {
    useStore.setState({ tracks: structuredClone(TODAS), singingToday: ["Ana"] });
    expect(applyFilters(useStore.getState()).map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("con varios se ven las que se sabe AL MENOS UNO", () => {
    useStore.setState({ tracks: structuredClone(TODAS), singingToday: ["Ana", "José"] });
    expect(applyFilters(useStore.getState()).map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("toggle añade y quita cantantes del filtro", () => {
    useStore.getState().toggleSingingToday("Ana");
    expect(useStore.getState().singingToday).toEqual(["Ana"]);
    useStore.getState().toggleSingingToday("José");
    expect(useStore.getState().singingToday).toEqual(["Ana", "José"]);
    useStore.getState().toggleSingingToday("Ana");
    expect(useStore.getState().singingToday).toEqual(["José"]);
  });

  it("clear vacía el filtro", () => {
    useStore.setState({ singingToday: ["Ana"] });
    useStore.getState().clearSingingToday();
    expect(useStore.getState().singingToday).toEqual([]);
  });
});

describe("la gestión de cantantes", () => {
  it("añadir un cantante lo pone en la lista", async () => {
    useStore.getState().addSinger("Pedro");
    await vi.waitFor(() => expect([...useStore.getState().singers.map((c) => c.nombre)]).toContain("Pedro"));
  });

  it("renombrar actualiza el nombre, en la lista y en el filtro", async () => {
    useStore.setState({ singingToday: ["Ana"] });
    useStore.getState().renameSinger("c1", "Ana María");
    await vi.waitFor(() => expect(useStore.getState().singers[0].nombre).toBe("Ana María"));
    expect(useStore.getState().singingToday).toEqual(["Ana María"]);
  });

  it("borrar un cantante lo quita de las pistas y del filtro", async () => {
    useStore.setState({ tracks: structuredClone(TODAS), singingToday: ["Ana"] });
    useStore.getState().deleteSinger("c1");
    await vi.waitFor(() => expect([...useStore.getState().singers.map((c) => c.nombre)]).toEqual(["José"]));
    expect(useStore.getState().tracks.find((t) => t.id === "c")?.singers).toEqual(["José"]);
    expect(useStore.getState().singingToday).toEqual([]);
  });
});

describe("quién se la sabe", () => {
  it("toggleSingerOnTrack marca y desmarca que se la sabe", async () => {
    useStore.setState({ tracks: structuredClone(TODAS), selId: "a", detailOpen: true });
    useStore.getState().toggleSingerOnTrack("José");
    await vi.waitFor(() =>
      expect(useStore.getState().tracks.find((t) => t.id === "a")?.singers).toEqual(["Ana", "José"]),
    );
    useStore.getState().toggleSingerOnTrack("Ana");
    await vi.waitFor(() =>
      expect(useStore.getState().tracks.find((t) => t.id === "a")?.singers).toEqual(["José"]),
    );
  });
});

describe("el aviso al terminar una canción", () => {
  it("se abre al acabar la pista si hay cantantes elegidos, y la cola sigue", async () => {
    useStore.setState({
      tracks: structuredClone(TODAS),
      singingToday: ["Ana"],
      playerId: "a",
      queue: ["a", "b"],
      repeat: "no",
      playing: true,
    });
    // El núcleo de verdad la cierra el audio; en el store solo avanza el
    // transporte, que es lo que esta prueba mira.
    useStore.setState({ posSec: 180 });
    useStore.getState().tick();
    expect(useStore.getState().singerCheckTrack).toBe("a");
    expect(useStore.getState().playerId).toBe("b");
  });

  it("sin cantantes elegidos no se abre", async () => {
    useStore.setState({ tracks: structuredClone(TODAS), singingToday: [], playerId: "a", queue: ["a", "b"], repeat: "no", playing: true });
    useStore.getState().advance();
    expect(useStore.getState().singerCheckTrack).toBeNull();
  });

  it("en proyección también se abre: el aviso vive en la ventana de control", async () => {
    useStore.setState({ tracks: structuredClone(TODAS), singingToday: ["Ana"], playerId: "a", queue: ["a", "b"], repeat: "no", playing: true, proyectando: true });
    useStore.getState().advance();
    expect(useStore.getState().singerCheckTrack).toBe("a");
    // y la cola sigue, en ambos casos
    expect(useStore.getState().playerId).toBe("b");
  });

  it("desactivado no se abre", async () => {
    useStore.setState({ tracks: structuredClone(TODAS), singingToday: ["Ana"], playerId: "a", queue: ["a", "b"], repeat: "no", playing: true, askSingersAtEnd: false });
    useStore.getState().advance();
    expect(useStore.getState().singerCheckTrack).toBeNull();
  });

  it("con «Repetir la canción» no se abre", async () => {
    useStore.setState({ tracks: structuredClone(TODAS), singingToday: ["Ana"], playerId: "a", queue: ["a", "b"], repeat: "una", playing: true });
    useStore.getState().advance();
    expect(useStore.getState().singerCheckTrack).toBeNull();
    expect(useStore.getState().posSec).toBe(0);
  });

  it("guardar apunta quiénes se la saben y cierra el aviso", async () => {
    useStore.setState({ tracks: structuredClone(TODAS), singerCheckTrack: "a", singingToday: ["Ana"] });
    useStore.getState().saveSingersForTrack(["Ana"]);
    await vi.waitFor(() =>
      expect(useStore.getState().tracks.find((t) => t.id === "a")?.singers).toEqual(["Ana"]),
    );
    expect(useStore.getState().singerCheckTrack).toBeNull();
  });

  it("nadie se la sabe se apunta así y cierra", async () => {
    useStore.setState({ tracks: structuredClone(TODAS), singerCheckTrack: "a", singingToday: ["Ana"] });
    useStore.getState().saveSingersForTrack([]);
    await vi.waitFor(() =>
      expect(useStore.getState().tracks.find((t) => t.id === "a")?.singers).toEqual([]),
    );
    expect(useStore.getState().singerCheckTrack).toBeNull();
  });
});

describe("«Hoy cantan» en la lista del culto", () => {
  const estado = {
    curPlaylist: "p1",
    plOrder: { p1: ["a", "b", "c", "d"] },
    tracks: structuredClone(TODAS),
  } as unknown as CantoralState;

  it("sin filtro, la lista entera en su orden", () => {
    expect(visibleListRows(estado).map((t) => t.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("con filtro, lo que se sabe al menos uno, en su orden", () => {
    const con = { ...estado, singingToday: ["José"] };
    expect(visibleListRows(con).map((t) => t.id)).toEqual(["b", "c"]);
  });

  it("Reproducir todo arranca aunque la primera falte en el disco", () => {
    useStore.setState({
      tracks: structuredClone([...TODAS, track("z", [], { missing: true })]),
      curPlaylist: "p1",
      plOrder: { p1: ["z", "a", "b"] },
      view: "lista",
    });
    useStore.getState().playAll();
    // Antes `play` veía la primera (z, sin archivo) y se rendía: ni un click
    // respondía. Ahora arranca en la segunda y no mira atrás.
    expect(useStore.getState().playerId).toBe("a");
    expect(useStore.getState().queue).toEqual(["a", "b"]);
    expect(useStore.getState().playing).toBe(true);
    expect(useStore.getState().singerCheckTrack).toBeNull();
  });

  it("el filtro no reordena: baja del memorizado; el orden guardado manda", () => {
    const con = { ...estado, singingToday: ["Ana"] };
    expect(visibleListRows(con).map((t) => t.id)).toEqual(["a", "c"]);
  });
});
