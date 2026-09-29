// Un momento sin música en la proyección (#145).
//
// El criterio de la propuesta, tal cual: un culto «Adoración 1 → Oración →
// Adoración 2» proyectado con «Pasar al siguiente». La primera canción acaba,
// sale «Oración» sobre negro y se queda; «Siguiente» arranca la segunda. Y lo
// que va alrededor: que «Reproducir todo» pase de largo, que el atril no pida
// letras de un momento, y que importar un culto con momentos los deje en su
// sitio.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EstadoProyeccion, SalidaProyeccion } from "../api";
import type { Momento, Playlist, Track } from "../types";

const setProjectionCmd = vi.fn<(c: SalidaProyeccion) => Promise<void>>();
let contestar: ((e: EstadoProyeccion) => void) | null = null;

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  setProjectionCmd: (c: SalidaProyeccion) => setProjectionCmd(c),
  onProjectionState: (cb: (e: EstadoProyeccion) => void) => {
    contestar = cb;
    return Promise.resolve(() => (contestar = null));
  },
  onProjectionReady: () => Promise.resolve(() => {}),
}));

const { useStore } = await import("../../store");
const { usarBackend } = await import("../backend");
const { crearMemoria } = await import("../backend/memoria");
const { assetUrl } = await import("../api");
const initial = useStore.getState();

function pista(id: string, over: Partial<Track> = {}): Track {
  return {
    id,
    titulo: `Adoración ${id}`,
    artista: "Coro",
    album: "",
    dur: "3:00",
    durSec: 180,
    ocasion: "",
    formato: "MP3",
    carpeta: "Música",
    fav: false,
    missing: false,
    added: 0,
    tieneHoja: false,
    path: `/m/${id}.mp3`,
    ...over,
  };
}

const ORACION: Momento = { id: "m:1", tipo: "oracion", titulo: "Oración", texto: "Pastor Luis" };

/** «Adoración 1 → Oración → Adoración 2», abierto y con la salida en marcha. */
function culto() {
  const tracks = [pista("1"), pista("2")];
  const pl: Playlist = { id: "p1", nombre: "Domingo", ocasion: "", ids: ["1", "m:1", "2"], momentos: [ORACION], plantilla: false, tocada: "" };
  useStore.setState({
    tracks,
    playlists: [pl],
    plOrder: { p1: pl.ids.slice() },
    curPlaylist: "p1",
    proyectando: true,
    proyeccionIdx: -1,
    avanceProyeccion: "siguiente",
  });
  usarBackend(crearMemoria({ tracks, playlists: [pl] }));
}

const ultimo = (): SalidaProyeccion => {
  const llamadas = setProjectionCmd.mock.calls;
  return llamadas[llamadas.length - 1][0];
};

beforeEach(() => {
  useStore.setState(initial, true);
  setProjectionCmd.mockReset();
  setProjectionCmd.mockResolvedValue(undefined);
  contestar = null;
});

describe("un momento en la proyección", () => {
  it("al acabarse la canción sale el título sobre negro y la cola se queda ahí", async () => {
    culto();
    await useStore.getState().escucharProyeccion();
    useStore.getState().proyectarElemento(0);

    contestar!({ src: assetUrl("/m/1.mp3"), pos: 180, dur: 180, fin: true });

    expect(useStore.getState().proyeccionIdx).toBe(1);
    expect(useStore.getState().proyeccionEnNegro).toBe(false);
    expect(ultimo().vista).toEqual({ modo: "titulo", titulo: "Oración", sub: "Pastor Luis" });
  });

  it("mientras dura, se va cargando la canción de después", () => {
    culto();
    useStore.getState().proyectarElemento(1);

    expect(ultimo().precarga).toBe(assetUrl("/m/2.mp3"));
  });

  it("y la canción de antes precarga la de después del momento, no el hueco", () => {
    culto();
    useStore.getState().proyectarElemento(0);

    expect(ultimo().precarga).toBe(assetUrl("/m/2.mp3"));
  });

  it("un «fin» rezagado de la canción anterior no lo hace avanzar solo", async () => {
    culto();
    await useStore.getState().escucharProyeccion();
    useStore.getState().proyectarElemento(1);

    contestar!({ src: assetUrl("/m/1.mp3"), pos: 180, dur: 180, fin: true });

    expect(useStore.getState().proyeccionIdx).toBe(1);
    expect(ultimo().vista.modo).toBe("titulo");
  });

  it("«Siguiente» arranca la canción de después, con su transición", () => {
    culto();
    useStore.getState().setTransicionProyeccion("cuenta");
    useStore.getState().proyectarElemento(1);

    useStore.getState().proyeccionSiguiente();

    expect(useStore.getState().proyeccionIdx).toBe(2);
    expect(ultimo().vista).toMatchObject({ modo: "media", src: assetUrl("/m/2.mp3"), titulo: "Adoración 2" });
    expect(ultimo().transicion).toBe("cuenta");
  });

  it("no tiene estrofas: «Siguiente» no se queda recorriendo una letra que no hay", () => {
    culto();
    useStore.setState({ salidaDeAudio: "letra" });
    useStore.getState().proyectarElemento(1);

    useStore.getState().proyeccionSiguiente();

    expect(useStore.getState().proyeccionIdx).toBe(2);
  });

  it("con el momento sin texto, sale solo el título", () => {
    culto();
    useStore.setState({ playlists: [{ ...useStore.getState().playlists[0], momentos: [{ ...ORACION, texto: "" }] }] });

    useStore.getState().proyectarElemento(1);

    expect(ultimo().vista).toEqual({ modo: "titulo", titulo: "Oración", sub: undefined });
  });
});

describe("fuera de la proyección", () => {
  it("«Reproducir todo» se salta los momentos", () => {
    culto();

    useStore.getState().playAll();

    expect(useStore.getState().queue).toEqual(["1", "2"]);
  });

  it("el atril no pide la letra de un momento", async () => {
    culto();
    const hojas = vi.fn(async () => []);
    usarBackend({ ...crearMemoria(), getSheets: hojas });

    await useStore.getState().loadSheets(["1", "m:1", "2"]);

    expect(hojas).toHaveBeenCalledWith(["1", "2"]);
  });

  it("quitar un momento de la tabla lo saca del culto", async () => {
    culto();

    useStore.getState().removeFromPl("m:1");
    await vi.waitFor(async () => {
      const { backend } = await import("../backend");
      const pl = (await backend().getPlaylists())[0];
      expect(pl.momentos).toEqual([]);
    });

    expect(useStore.getState().plOrder.p1).toEqual(["1", "2"]);
  });

  it("subirlo con el teclado lo dice por su título", () => {
    culto();

    useStore.getState().moveInPlaylist("m:1", -1);

    expect(useStore.getState().plOrder.p1).toEqual(["m:1", "1", "2"]);
    expect(useStore.getState().reorderNotice).toBe("«Oración», posición 1 de 3");
  });

  it("guardar el diálogo añade el momento al final del culto abierto", async () => {
    culto();
    useStore.getState().nuevoMomento();
    expect(useStore.getState().dialog).toBe("momento");

    useStore.getState().guardarMomento("anuncios", "Anuncios", "");

    await vi.waitFor(() => expect(useStore.getState().plOrder.p1).toHaveLength(4));
    const pl = useStore.getState().playlists.find((p) => p.id === "p1")!;
    expect(pl.momentos!.map((m) => m.titulo)).toEqual(["Oración", "Anuncios"]);
    expect(useStore.getState().dialog).toBe(null);
  });

  it("importar un culto con momentos los deja en su sitio", async () => {
    culto();
    useStore.setState({
      importPreview: {
        archivo: {
          cantoral: 2,
          lista: { nombre: "Importado", ocasion: "", plantilla: false },
          pistas: [
            { titulo: "Adoración 1", artista: "Coro", album: "", durSec: 180, ocasion: "", archivo: "1.mp3" },
            { titulo: "Adoración 2", artista: "Coro", album: "", durSec: 180, ocasion: "", archivo: "2.mp3" },
          ],
          momentos: [{ trasPistas: 1, tipo: "lectura", titulo: "Lectura", texto: "Salmo 23" }],
          exportado: "",
        },
        resultado: { encontradas: [], faltantes: [] },
      },
    });
    const previo = useStore.getState().importPreview!;
    const { emparejar } = await import("../compartir");
    useStore.setState({ importPreview: { ...previo, resultado: emparejar(previo.archivo.pistas, useStore.getState().tracks) } });

    useStore.getState().confirmImport();

    await vi.waitFor(() => expect(useStore.getState().playlists.some((p) => p.nombre === "Importado")).toBe(true));
    const nuevo = useStore.getState().playlists.find((p) => p.nombre === "Importado")!;
    expect(nuevo.ids[0]).toBe("1");
    expect(nuevo.ids[2]).toBe("2");
    expect(nuevo.momentos).toEqual([{ id: nuevo.ids[1], tipo: "lectura", titulo: "Lectura", texto: "Salmo 23" }]);
  });
});
