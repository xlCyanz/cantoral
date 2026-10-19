// Un momento sin música en el culto (#145), fuera del reproductor: que
// «Reproducir todo» pase de largo y que importar un culto con momentos los
// deje en su sitio.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Momento, Playlist, Track } from "../types";

const { useStore } = await import("../../store");
const { usarBackend } = await import("../backend");
const { crearMemoria } = await import("../backend/memoria");
const initial = useStore.getState();

function pista(id: string, over: Partial<Track> = {}): Track {
  return {
    id,
    titulo: `Adoración ${id}`,
    artista: "Coro",
    album: "",
    dur: "3:00",
    durSec: 180,
    formato: "MP3",
    carpeta: "Música",
    fav: false,
    missing: false,
    added: 0,
    path: `/m/${id}.mp3`,
    ...over,
  };
}

const ORACION: Momento = { id: "m:1", tipo: "oracion", titulo: "Oración", texto: "Pastor Luis" };

/** «Adoración 1 → Oración → Adoración 2», abierto y con la salida en marcha. */
function culto() {
  const tracks = [pista("1"), pista("2")];
  const pl: Playlist = { id: "p1", nombre: "Domingo", ids: ["1", "m:1", "2"], momentos: [ORACION], plantilla: false, tocada: "" };
  useStore.setState({
    tracks,
    playlists: [pl],
    plOrder: { p1: pl.ids.slice() },
    curPlaylist: "p1",
  });
  usarBackend(crearMemoria({ tracks, playlists: [pl] }));
}

beforeEach(() => {
  useStore.setState(initial, true);
});

describe("fuera de la proyección", () => {
  it("«Reproducir todo» se salta los momentos", () => {
    culto();

    useStore.getState().playAll();

    expect(useStore.getState().queue).toEqual(["1", "2"]);
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
          lista: { nombre: "Importado", plantilla: false },
          pistas: [
            { titulo: "Adoración 1", artista: "Coro", album: "", durSec: 180, archivo: "1.mp3" },
            { titulo: "Adoración 2", artista: "Coro", album: "", durSec: 180, archivo: "2.mp3" },
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
