// Una instantánea del núcleo trae el catálogo entero en objetos nuevos. Las
// pistas que llegan iguales se quedan con el objeto que ya había, para que lo
// que se recuerda por objeto —filas memorizadas, la búsqueda sin tildes, el
// orden de la tabla— sobreviva. Y la búsqueda no vuelve a quitar las tildes
// de lo que ya conocía aunque llegue en otro objeto.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../../store";
import { applyFilters } from "../../store/selectores";
import { usarBackend } from "../backend";
import { crearMemoria } from "../backend/memoria";
import { coincideEnCampos, sinTildes } from "../buscar";
import { conservarIguales, mismaPista } from "../reutilizar";
import type { Folder, Track } from "../types";

function pista(id: string, over: Partial<Track> = {}): Track {
  return { id, titulo: `Canción ${id} del Señor`, artista: "Coro", album: "Álbum", dur: "3:00", durSec: 180, formato: "MP3", carpeta: "Himnos", fav: false, missing: false, singers: [], added: Number(id), path: `/m/${id}.mp3`, ...over };
}

const CARPETAS: Folder[] = [{ id: "f1", nombre: "Himnos", ruta: "/m", count: 3 }];

describe("conservarIguales", () => {
  it("devuelve el mismo catálogo si todo llega igual", () => {
    const antes = [pista("1"), pista("2")];
    expect(conservarIguales(antes, structuredClone(antes))).toBe(antes);
  });

  it("una pista cambiada llega nueva; las demás, las de antes", () => {
    const antes = [pista("1"), pista("2"), pista("3")];
    const nuevas = structuredClone(antes);
    nuevas[1].fav = true;

    const fuera = conservarIguales(antes, nuevas);

    expect(fuera).not.toBe(antes);
    expect(fuera[0]).toBe(antes[0]);
    expect(fuera[1]).toBe(nuevas[1]);
    expect(fuera[2]).toBe(antes[2]);
  });

  it("una pista con un campo de más o de menos no es la misma", () => {
    expect(mismaPista(pista("1"), pista("1", { video: true }))).toBe(false);
    expect(mismaPista(pista("1", { cover: "a" }), pista("1"))).toBe(false);
    expect(mismaPista(pista("1", { cover: "a" }), pista("1", { cover: "a" }))).toBe(true);
  });

  it("si cambia el orden o el número de pistas, el catálogo es otro aunque los objetos sigan", () => {
    const antes = [pista("1"), pista("2")];
    const alReves = conservarIguales(antes, structuredClone([antes[1], antes[0]]));
    expect(alReves).not.toBe(antes);
    expect(alReves[0]).toBe(antes[1]);

    const sinUna = conservarIguales(antes, structuredClone([antes[0]]));
    expect(sinUna).toEqual([antes[0]]);
    expect(sinUna[0]).toBe(antes[0]);
  });
});

describe("una instantánea en el store", () => {
  const initial = useStore.getState();
  beforeEach(() => {
    useStore.setState(initial, true);
    usarBackend(crearMemoria({ tracks: [pista("1"), pista("2"), pista("3")], folders: CARPETAS, playlists: [] }));
  });
  afterEach(() => {
    usarBackend(null);
    vi.restoreAllMocks();
  });

  it("sin cambios, conserva el catálogo y sus carpetas", async () => {
    await useStore.getState().hydrate();
    const { tracks, folders } = useStore.getState();

    await useStore.getState().hydrate();

    expect(useStore.getState().tracks).toBe(tracks);
    expect(useStore.getState().folders).toBe(folders);
  });

  it("una pista cambiada en el núcleo llega en un objeto nuevo, y solo ella", async () => {
    await useStore.getState().hydrate();
    const antes = useStore.getState().tracks;
    // El corazón va al núcleo; la pantalla se pone como estaba, para que la
    // instantánea sea la que lo trae.
    useStore.getState().onFav("2");
    useStore.setState({ tracks: antes });

    await useStore.getState().hydrate();

    const ahora = useStore.getState().tracks;
    expect(ahora[0]).toBe(antes[0]);
    expect(ahora[1]).not.toBe(antes[1]);
    expect(ahora[1].fav).toBe(true);
    expect(ahora[2]).toBe(antes[2]);
  });

  it("la primera búsqueda después de una instantánea no vuelve a quitar tildes", async () => {
    await useStore.getState().hydrate();
    useStore.getState().onQuery("senor");
    expect(applyFilters(useStore.getState())).toHaveLength(3);
    useStore.getState().clearQuery();

    await useStore.getState().hydrate();
    applyFilters(useStore.getState());
    const nfd = vi.spyOn(String.prototype, "normalize");
    useStore.getState().onQuery("senor");
    applyFilters(useStore.getState());

    // Solo lo escrito; ninguna pista.
    expect(nfd).toHaveBeenCalledTimes(1);
  });
});

describe("la caché de la búsqueda", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reconoce el texto aunque llegue en otro objeto", () => {
    const antes = [pista("10"), pista("11")];
    const q = sinTildes("señor");
    antes.forEach((t) => coincideEnCampos(t, q));
    const nfd = vi.spyOn(String.prototype, "normalize");

    expect(structuredClone(antes).every((t) => coincideEnCampos(t, q))).toBe(true);
    expect(nfd).not.toHaveBeenCalled();
  });

  it("pero un texto cambiado se vuelve a leer", () => {
    const t = pista("12");
    coincideEnCampos(t, "x");
    expect(coincideEnCampos({ ...t, artista: "Ñoño" }, "nono")).toBe(true);
  });
});
