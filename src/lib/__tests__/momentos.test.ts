// Los momentos del culto que no son pistas (#145): una oración, una lectura,
// los anuncios. Lo que se fija aquí es que viven en el orden del culto como un
// sitio más —se guardan, se reordenan, se copian con la plantilla—, que salen
// en la hoja impresa como una fila sin duración, y que el archivo compartido
// los lleva sin dejar de abrirse en una instalación de antes cuando no hay
// ninguno.

import { beforeEach, describe, expect, it } from "vitest";
import type { Momento, Playlist, Track } from "../types";
import { elementosDe, esMomento, resumenDeOrden, soloPistas, tipoDeMomento } from "../momentos";
import {
  VERSION,
  VERSION_SIN_MOMENTOS,
  armarArchivoDeCulto,
  emparejar,
  ordenDelImportado,
  parsearArchivo,
} from "../compartir";
import { playlistSheetHtml } from "../exportSheet";
import { crearMemoria } from "../backend/memoria";

function pista(id: string, over: Partial<Track> = {}): Track {
  return {
    id,
    titulo: `Pista ${id}`,
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

const ORACION: Momento = { id: "m:1", tipo: "oracion", titulo: "Oración", texto: "" };
const LECTURA: Momento = { id: "m:2", tipo: "lectura", titulo: "Lectura", texto: "Salmo 23" };

function culto(over: Partial<Playlist> = {}): Playlist {
  return {
    id: "p1",
    nombre: "Domingo",
    ids: ["a", "m:1", "b"],
    momentos: [ORACION],
    plantilla: false,
    tocada: "",
    ...over,
  };
}

describe("el orden de un culto con momentos", () => {
  const pistas = new Map([pista("a"), pista("b")].map((t) => [t.id, t] as const));
  const momentos = new Map([[ORACION.id, ORACION]]);

  it("distingue un momento de una pista por su id", () => {
    expect(esMomento("m:1")).toBe(true);
    expect(esMomento("12")).toBe(false);
    expect(esMomento("t1")).toBe(false);
    expect(soloPistas(["a", "m:1", "b"])).toEqual(["a", "b"]);
  });

  it("resuelve cada sitio en lo que hay, en su orden", () => {
    const elementos = elementosDe(["a", "m:1", "b"], pistas, momentos);

    expect(elementos.map((e) => `${e.clase}:${e.id}`)).toEqual(["pista:a", "momento:m:1", "pista:b"]);
  });

  it("se salta lo que ya no existe, pista o momento", () => {
    expect(elementosDe(["a", "m:9", "zz", "b"], pistas, momentos).map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("cuenta los momentos aparte de las pistas", () => {
    expect(resumenDeOrden(["a", "b"])).toBe("2 pistas");
    expect(resumenDeOrden(["a", "m:1"])).toBe("1 pista · 1 momento");
    expect(resumenDeOrden(["a", "m:1", "b", "m:2"])).toBe("2 pistas · 2 momentos");
  });

  it("un tipo desconocido es «otro»", () => {
    expect(tipoDeMomento("lectura")).toBe("lectura");
    expect(tipoDeMomento("bautismo")).toBe("otro");
    expect(tipoDeMomento(undefined)).toBe("otro");
  });
});

describe("la hoja impresa", () => {
  const elementos = elementosDe(
    ["a", "m:2", "b"],
    new Map([pista("a"), pista("b")].map((t) => [t.id, t] as const)),
    new Map([[LECTURA.id, LECTURA]]),
  );

  it("saca el momento en su sitio, como una fila sin duración en cursiva", () => {
    const html = playlistSheetHtml(culto(), elementos, "6 min");
    const filas = html.match(/<tr( class="momento")?>[\s\S]*?<\/tr>/g)!.slice(1);

    expect(filas).toHaveLength(3);
    expect(filas[1]).toContain('class="momento"');
    expect(filas[1]).toContain("Lectura");
    expect(filas[1]).toContain("Salmo 23");
    expect(filas[1]).not.toContain("3:00");
    // Las mismas columnas que una pista, para que la tabla no se descuadre.
    expect(filas[1].match(/<td[ >]/g)).toHaveLength(4);
    expect(html).toMatch(/tr\.momento td \{[^}]*font-style: italic/);
  });

  it("y la cabecera cuenta las pistas y los momentos por separado", () => {
    const html = playlistSheetHtml(culto(), elementos, "6 min");

    expect(html).toContain("2 pistas · 1 momento · 6 min");
  });
});

describe("el archivo compartido", () => {
  const a = pista("a", { path: "/m/a.mp3" });
  const b = pista("b", { path: "/m/b.mp3" });

  it("sin momentos sigue siendo el formato de antes, sin la clave nueva", () => {
    const archivo = armarArchivoDeCulto(culto(), [
      { clase: "pista", id: "a", pista: a },
      { clase: "pista", id: "b", pista: b },
    ]);

    expect(archivo.cantoral).toBe(VERSION_SIN_MOMENTOS);
    expect("momentos" in archivo).toBe(false);
  });

  it("con momentos sube de formato y cuenta su sitio en pistas", () => {
    const archivo = armarArchivoDeCulto(culto(), [
      { clase: "momento", id: "m:2", momento: LECTURA },
      { clase: "pista", id: "a", pista: a },
      { clase: "momento", id: "m:1", momento: ORACION },
      { clase: "pista", id: "b", pista: b },
    ]);

    expect(archivo.cantoral).toBe(VERSION);
    expect(archivo.pistas.map((p) => p.archivo)).toEqual(["a.mp3", "b.mp3"]);
    expect(archivo.momentos).toEqual([
      { trasPistas: 0, tipo: "lectura", titulo: "Lectura", texto: "Salmo 23" },
      { trasPistas: 1, tipo: "oracion", titulo: "Oración", texto: "" },
    ]);
  });

  it("lo que se escribe se vuelve a leer igual", () => {
    const archivo = armarArchivoDeCulto(culto(), [
      { clase: "pista", id: "a", pista: a },
      { clase: "momento", id: "m:2", momento: LECTURA },
    ]);

    expect(parsearArchivo(JSON.stringify(archivo)).momentos).toEqual(archivo.momentos);
  });

  it("un archivo de antes, sin momentos, se abre igual", () => {
    const viejo = parsearArchivo(`{"cantoral":1,"lista":{"nombre":"Culto"},"pistas":[{"titulo":"Santo"}]}`);

    expect(viejo.pistas).toHaveLength(1);
    expect(viejo.momentos).toBeUndefined();
  });

  it("uno de un formato más nuevo todavía se rechaza", () => {
    expect(() => parsearArchivo(`{"cantoral":${VERSION + 1},"lista":{"nombre":"X"},"pistas":[]}`)).toThrow(
      /versión más nueva/,
    );
  });

  it("un momento sin título se deja fuera, y un tipo raro es «otro»", () => {
    const leido = parsearArchivo(
      `{"cantoral":2,"lista":{"nombre":"X"},"pistas":[],"momentos":[{"titulo":"  "},{"titulo":"Bautismo","tipo":"bautismo","trasPistas":-3}]}`,
    );

    expect(leido.momentos).toEqual([{ trasPistas: 0, tipo: "otro", titulo: "Bautismo", texto: "" }]);
  });

  it("al importar, cada momento cae entre las mismas canciones aunque falte alguna", () => {
    // El archivo: Lectura → a → b → Oración → c. Aquí no está `b`.
    const archivo = armarArchivoDeCulto(culto(), [
      { clase: "momento", id: "m:2", momento: LECTURA },
      { clase: "pista", id: "a", pista: a },
      { clase: "pista", id: "b", pista: b },
      { clase: "momento", id: "m:1", momento: ORACION },
      { clase: "pista", id: "c", pista: pista("c") },
    ]);
    const catalogo = [pista("1", { path: "/x/a.mp3", titulo: "Pista a" }), pista("3", { path: "/x/c.mp3", titulo: "Pista c" })];
    const { encontradas } = emparejar(archivo.pistas, catalogo);

    const orden = ordenDelImportado(archivo.pistas, encontradas, [
      { trasPistas: 0, id: "m:10" },
      { trasPistas: 2, id: "m:11" },
    ]);

    expect(orden).toEqual(["m:10", "1", "m:11", "3"]);
  });

  it("y un momento del final se queda al final", () => {
    const pistas = [{ titulo: "A", artista: "", album: "", durSec: 0, archivo: "a.mp3" }];
    const orden = ordenDelImportado(pistas, [{ pista: pistas[0], id: "1", por: "archivo" }], [{ trasPistas: 1, id: "m:5" }]);

    expect(orden).toEqual(["1", "m:5"]);
  });
});

describe("el backend del navegador", () => {
  let b: ReturnType<typeof crearMemoria>;
  beforeEach(() => {
    b = crearMemoria({ tracks: [pista("a"), pista("b")], playlists: [culto({ ids: ["a", "b"], momentos: [] })] });
  });

  const elCulto = async (id = "p1") => (await b.getPlaylists()).find((p) => p.id === id)!;

  it("un momento nuevo entra al final del culto", async () => {
    await b.addPlaylistMomento("p1", "anuncios", "  Anuncios ", "");

    const pl = await elCulto();
    expect(pl.ids).toHaveLength(3);
    expect(esMomento(pl.ids[2])).toBe(true);
    expect(pl.momentos).toEqual([{ id: pl.ids[2], tipo: "anuncios", titulo: "Anuncios", texto: "" }]);
  });

  it("sin título no se crea", async () => {
    await expect(b.addPlaylistMomento("p1", "oracion", "   ", "")).rejects.toThrow(/título/);
  });

  it("se reordena como una pista, y el orden se guarda", async () => {
    await b.addPlaylistMomento("p1", "oracion", "Oración", "");
    const m = (await elCulto()).ids[2];

    await b.setPlaylistOrder("p1", ["a", m, "b"]);

    expect((await elCulto()).ids).toEqual(["a", m, "b"]);
  });

  it("quitarlo del orden lo borra", async () => {
    await b.addPlaylistMomento("p1", "oracion", "Oración", "");

    await b.setPlaylistOrder("p1", ["b", "a"]);

    const pl = await elCulto();
    expect(pl.ids).toEqual(["b", "a"]);
    expect(pl.momentos).toEqual([]);
  });

  it("se puede cambiar lo que dice sin moverlo", async () => {
    await b.addPlaylistMomento("p1", "oracion", "Oración", "");
    await b.setPlaylistOrder("p1", ["a", (await elCulto()).ids[2], "b"]);
    const m = (await elCulto()).ids[1];

    await b.updatePlaylistMomento(m, "lectura", "Lectura", "Juan 3:16");

    const pl = await elCulto();
    expect(pl.ids[1]).toBe(m);
    expect(pl.momentos![0]).toMatchObject({ tipo: "lectura", titulo: "Lectura", texto: "Juan 3:16" });
  });

  it("duplicar el culto copia los momentos en su sitio, con ids propios", async () => {
    await b.addPlaylistMomento("p1", "oracion", "Oración", "");
    const original = (await elCulto()).ids[2];
    await b.setPlaylistOrder("p1", ["a", original, "b"]);

    const copia = await elCulto(await b.duplicatePlaylist("p1"));

    expect(copia.ids[0]).toBe("a");
    expect(esMomento(copia.ids[1])).toBe(true);
    expect(copia.ids[1]).not.toBe(original);
    expect(copia.ids[2]).toBe("b");
    expect(copia.momentos![0].titulo).toBe("Oración");
  });

  it("y un culto nuevo desde una plantilla, también", async () => {
    await b.addPlaylistMomento("p1", "anuncios", "Anuncios", "");

    const nuevo = await elCulto(await b.createPlaylist("Otro", "p1"));

    expect(nuevo.ids.slice(0, 2)).toEqual(["a", "b"]);
    expect(nuevo.momentos![0].titulo).toBe("Anuncios");
    expect(nuevo.ids[2]).toBe(nuevo.momentos![0].id);
  });

  it("borrar una pista de la biblioteca no se lleva los momentos", async () => {
    await b.addPlaylistMomento("p1", "oracion", "Oración", "");

    await b.deleteTrack("a");

    const pl = await elCulto();
    expect(pl.ids).toHaveLength(2);
    expect(pl.momentos).toHaveLength(1);
  });

  it("un momento de otro culto no se cuela en este", async () => {
    await b.createPlaylist("Otro");
    const otro = (await b.getPlaylists()).find((p) => p.nombre === "Otro")!.id;
    await b.addPlaylistMomento(otro, "oracion", "Ajena", "");
    const ajeno = (await elCulto(otro)).ids[0];

    await b.setPlaylistOrder("p1", ["a", ajeno, "b"]);

    expect((await elCulto()).ids).toEqual(["a", "b"]);
    expect((await elCulto(otro)).ids).toEqual([ajeno]);
  });
});
