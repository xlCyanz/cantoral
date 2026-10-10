// El backend en memoria es lo que ve quien abre `pnpm dev`. Tiene que contestar
// como el núcleo y hacer cumplir las mismas reglas que SQLite hace cumplir en
// la app; si no, el navegador enseña una app que no existe (#135).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoDisponible } from "../backend";
import { CARPETA_DE_EJEMPLO, crearMemoria } from "../backend/memoria";
import type { Backend } from "../backend";
import type { ScanProgressEvent } from "../api";
import type { Playlist, Track } from "../types";

function pista(id: string, over: Partial<Track> = {}): Track {
  return {
    id,
    titulo: `Pista ${id}`,
    artista: "Coro",
    album: "",
    dur: "3:00",
    durSec: 180,
    ocasion: "",
    formato: "MP3",
    carpeta: "Himnos",
    fav: false,
    missing: false,
    added: 1,
    path: `C:\\Himnos\\${id}.mp3`,
    ...over,
  };
}

function lista(id: string, ids: string[], over: Partial<Playlist> = {}): Playlist {
  return { id, nombre: `Culto ${id}`, ocasion: "", ids, plantilla: false, tocada: "", ...over };
}

let b: Backend;

beforeEach(() => {
  b = crearMemoria({
    tracks: [pista("a"), pista("b", { fav: true }), pista("c", { carpeta: "Coros" })],
    folders: [
      { id: "f1", nombre: "Himnos", ruta: "C:\\Himnos", count: 2 },
      { id: "f2", nombre: "Coros", ruta: "C:\\Coros", count: 1 },
    ],
    playlists: [lista("p1", ["a", "b"]), lista("p2", ["c", "a"])],
  });
});

const orden = async (id: string) => (await b.getPlaylists()).find((p) => p.id === id)?.ids;

describe("lo que devuelve es una copia", () => {
  it("cambiar la respuesta no cambia la base", async () => {
    const snap = await b.getLibrary();
    snap.tracks[0].titulo = "otro";
    snap.playlists[0].ids.push("zz");

    const otra = await b.getLibrary();
    expect(otra.tracks[0].titulo).toBe("Pista a");
    expect(otra.playlists[0].ids).toEqual(["a", "b"]);
  });

  it("por defecto trae el catálogo de ejemplo", async () => {
    expect((await crearMemoria().getLibrary()).tracks.length).toBeGreaterThan(10);
  });
});

describe("quitar pistas, como SQLite", () => {
  // La divergencia que abrió el issue: en el navegador, quitar una pista la
  // dejaba en los cultos. Aquí hay una sola regla para las dos formas.
  it("una pista sale también de los cultos", async () => {
    await b.deleteTrack("b");

    expect(await orden("p1")).toEqual(["a"]);
  });

  it("varias a la vez, igual", async () => {
    const snap = await b.deleteTracks(["a", "c"]);

    expect(snap.tracks.map((t) => t.id)).toEqual(["b"]);
    expect(snap.playlists.map((p) => p.ids)).toEqual([["b"], []]);
  });

  it("quitar una carpeta se lleva sus pistas", async () => {
    const snap = await b.removeFolder("f2");

    expect(snap.folders.map((f) => f.id)).toEqual(["f1"]);
    expect(snap.tracks.some((t) => t.id === "c")).toBe(false);
    expect(snap.playlists.find((p) => p.id === "p2")?.ids).toEqual(["a"]);
  });
});

describe("cultos", () => {
  it("agregar no repite lo que ya estaba, ni lo repetido en la misma orden", async () => {
    const listas = await b.addTracksToPlaylist("p1", ["b", "c", "c"]);

    expect(listas.find((p) => p.id === "p1")?.ids).toEqual(["a", "b", "c"]);
  });

  it("una lista nueva desde una plantilla copia su orden", async () => {
    const id = await b.createPlaylist("Nueva", "Adoración", "p2");

    const nueva = (await b.getPlaylists()).find((p) => p.id === id)!;
    expect(nueva.ids).toEqual(["c", "a"]);
    expect(nueva.plantilla).toBe(false);
  });

  it("duplicar nombra la copia y le da su propio orden", async () => {
    const id = await b.duplicatePlaylist("p1");
    await b.setPlaylistOrder(id, ["b"]);

    const listas = await b.getPlaylists();
    expect(listas.find((p) => p.id === id)?.nombre).toBe("Culto p1 (copia)");
    expect(listas.find((p) => p.id === "p1")?.ids).toEqual(["a", "b"]);
  });

  it("borrar una lista no toca las pistas", async () => {
    await b.deletePlaylist("p1");

    expect((await b.getLibrary()).tracks).toHaveLength(3);
    expect((await b.getPlaylists()).map((p) => p.id)).toEqual(["p2"]);
  });
});

describe("duplicados", () => {
  beforeEach(() => {
    b = crearMemoria();
  });

  it("fusionar pasa el favorito y el sitio en los cultos a la que se queda", async () => {
    const [grupo] = (await b.findDuplicates()).groups;
    const [queda, copia] = grupo.tracks.map((t) => t.id);
    await b.addTracksToPlaylist("p2", [copia]);

    const snap = await b.mergeDuplicates(queda, [copia]);

    expect(snap.tracks.some((t) => t.id === copia)).toBe(false);
    expect(snap.playlists.find((p) => p.id === "p2")?.ids).toContain(queda);
    expect(snap.playlists.every((p) => new Set(p.ids).size === p.ids.length)).toBe(true);
    // Tras fusionar, ese grupo ya no existe.
    expect((await b.findDuplicates()).groups.some((g) => g.signature === grupo.signature)).toBe(false);
  });

  it("descartar esconde el grupo y lo cuenta; restaurar lo devuelve", async () => {
    const { groups } = await b.findDuplicates();

    const tras = await b.dismissDuplicates(groups[0].signature);
    expect(tras.groups).toHaveLength(groups.length - 1);
    expect(tras.dismissed).toBe(1);

    const vuelta = await b.restoreDismissedDuplicates();
    expect(vuelta.groups).toHaveLength(groups.length);
    expect(vuelta.dismissed).toBe(0);
  });
});

describe("escaneo simulado", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("avisa del progreso y termina con la biblioteca, con la carpeta nueva dentro", async () => {
    const avisos: ScanProgressEvent[] = [];
    await b.onScanProgress((p) => avisos.push(p));

    const fin = b.addAndScanFolder(CARPETA_DE_EJEMPLO, true);
    await vi.runAllTimersAsync();
    const snap = await fin;

    expect(avisos.length).toBeGreaterThan(2);
    expect(avisos[avisos.length - 1].done).toBe(true);
    // Cuenta archivos como el núcleo: hasta el total que encontró.
    expect(avisos[avisos.length - 1]).toMatchObject({ added: 40, total: 40 });
    expect(snap.folders.some((f) => f.ruta === CARPETA_DE_EJEMPLO && f.lastScan)).toBe(true);
  });

  it("cancelar lo termina en el acto", async () => {
    const fin = b.rescanFolder("f1");
    await b.cancelScan();

    await expect(fin).resolves.toMatchObject({ folders: expect.any(Array) });
  });
});

describe("lo que un navegador no sabe hacer", () => {
  it("lo dice como NoDisponible, no como un fallo", async () => {
    for (const intento of [
      () => b.revealFile("C:\\Himnos\\a.mp3"),
      () => b.revealLog(),
      () => b.relocateTrack("a"),
      () => b.relocateFolder("f1"),
      () => b.pickBackup(),
    ]) {
      await expect(intento()).rejects.toBeInstanceOf(NoDisponible);
    }
  });

  it("no finge reproducir archivos", () => {
    expect(b.reproduceArchivos).toBe(false);
  });
});

describe("recién agregadas", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("el catálogo de ejemplo trae algunas, y un escaneo sin novedades las deja en cero", async () => {
    const m = crearMemoria();
    expect((await m.getLibrary()).tracks.some((t) => t.nueva)).toBe(true);

    const fin = m.rescanFolder("f1");
    await vi.runAllTimersAsync();
    await fin;

    expect((await m.getLibrary()).tracks.some((t) => t.nueva)).toBe(false);
  });
});
