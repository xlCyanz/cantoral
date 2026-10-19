// Quitar, reubicar o fusionar pistas contesta solo con lo que cambió, no con
// el catálogo entero. El store lo pone encima de lo que tenía: las demás
// pistas siguen siendo los mismos objetos, y los cultos, las carpetas, la
// cola y los avisos quedan como quedaban con la instantánea completa.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../../store";
import { usarBackend } from "../backend";
import { crearMemoria } from "../backend/memoria";
import { aplicarParche } from "../reutilizar";
import type { Folder, Playlist, Track } from "../types";

function pista(id: string, over: Partial<Track> = {}): Track {
  return { id, titulo: `T${id}`, artista: "Coro", album: "", dur: "3:00", durSec: 180, formato: "MP3", carpeta: "Himnos", fav: false, missing: false, added: Number(id), path: `/m/${id}.mp3`, ...over };
}

const CARPETAS: Folder[] = [{ id: "f1", nombre: "Himnos", ruta: "/m", count: 3 }];
const CULTOS: Playlist[] = [{ id: "p1", nombre: "Domingo", ids: ["1", "2", "3"], tocada: "2026-01-01T00:00:00Z" }];

describe("aplicarParche", () => {
  it("quita las que se fueron y deja las demás en el mismo objeto", () => {
    const antes = [pista("1"), pista("2"), pista("3")];
    const fuera = aplicarParche(antes, ["2"], []);
    expect(fuera).toEqual([antes[0], antes[2]]);
    expect(fuera[0]).toBe(antes[0]);
    expect(fuera[1]).toBe(antes[2]);
  });

  it("pone en su sitio la que cambió", () => {
    const antes = [pista("1"), pista("2"), pista("3")];
    const movida = pista("2", { path: "/n/2.mp3", carpeta: "Nuevas" });
    const fuera = aplicarParche(antes, [], [movida]);
    expect(fuera[1]).toBe(movida);
    expect(fuera[0]).toBe(antes[0]);
  });

  it("si nada cambió devuelve el mismo catálogo, y nunca añade pistas", () => {
    const antes = [pista("1"), pista("2")];
    expect(aplicarParche(antes, [], [])).toBe(antes);
    expect(aplicarParche(antes, ["99"], [structuredClone(antes[0])])).toBe(antes);
    expect(aplicarParche(antes, [], [pista("7")])).toBe(antes);
  });
});

describe("en el store", () => {
  const initial = useStore.getState();
  beforeEach(async () => {
    useStore.setState(initial, true);
    usarBackend(
      crearMemoria({ tracks: [pista("1"), pista("2"), pista("3")], folders: CARPETAS, playlists: CULTOS }),
    );
    await useStore.getState().hydrate();
  });
  afterEach(() => usarBackend(null));

  it("quitar una pista la saca del catálogo y de los cultos, sin tocar las demás", async () => {
    const antes = useStore.getState().tracks;
    useStore.setState({ queue: ["2", "3"], selId: "2", detailOpen: true });

    useStore.getState().deleteTrack("2");
    useStore.getState().confirm!.onConfirm();

    await expect.poll(() => useStore.getState().tracks.length).toBe(2);
    const s = useStore.getState();
    expect(s.tracks[0]).toBe(antes[0]);
    expect(s.tracks[1]).toBe(antes[2]);
    expect(s.plOrder.p1).toEqual(["1", "3"]);
    expect(s.queue).toEqual(["3"]);
    expect(s.detailOpen).toBe(false);
    expect(s.toast?.titulo).toBe("Pista quitada de la biblioteca");
  });

  it("varias a la vez, con su aviso", async () => {
    useStore.setState({ selection: ["1", "3"] });
    useStore.getState().bulkDelete();
    useStore.getState().confirm!.onConfirm();

    await expect.poll(() => useStore.getState().tracks.map((t) => t.id)).toEqual(["2"]);
    expect(useStore.getState().plOrder.p1).toEqual(["2"]);
    expect(useStore.getState().toast?.titulo).toBe("2 pistas quitadas");
  });

  it("quitar la carpeta se lleva sus pistas y la carpeta", async () => {
    useStore.getState().removeFolder("f1");
    useStore.getState().confirm!.onConfirm();

    await expect.poll(() => useStore.getState().tracks).toEqual([]);
    expect(useStore.getState().folders).toEqual([]);
    expect(useStore.getState().plOrder.p1).toEqual([]);
  });
});
