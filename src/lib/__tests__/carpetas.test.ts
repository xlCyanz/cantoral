// Agrupar por carpeta solo sirve si la carpeta es la del disco. Lo que se fija
// aquí es que la raíz indexada se reste bien —con los dos separadores, con
// raíces anidadas y sin llevarse por delante una carpeta que solo empieza
// igual— y que una pista sin ruta caiga en algo con nombre en vez de en un
// grupo vacío.

import { describe, expect, it } from "vitest";
import { carpetaReal } from "../carpetas";
import type { Folder, Track } from "../types";

function pista(path: string, over: Partial<Track> = {}): Track {
  return {
    id: "t1",
    titulo: "Pista",
    artista: "Artista",
    album: "Album",
    dur: "3:00",
    durSec: 180,
    tono: "Do",
    bpm: 80,
    ocasion: "Adoración",
    formato: "MP3",
    carpeta: "Himnos",
    tags: [],
    fav: false,
    missing: false,
    tieneHoja: false,
    added: 1,
    path,
    ...over,
  };
}

const HIMNOS: Folder = { id: "f1", nombre: "Himnos", ruta: "C:\\Música\\Iglesia\\Himnos", count: 0 };
const PISTAS: Folder = { id: "f2", nombre: "Pistas 2025", ruta: "D:\\Alabanza\\Pistas 2025", count: 0 };
const CARPETAS = [HIMNOS, PISTAS];

describe("carpetaReal", () => {
  it("resta la raíz indexada y deja la subcarpeta", () => {
    const c = carpetaReal(pista("C:\\Música\\Iglesia\\Himnos\\Clásicos\\sublime.mp3"), CARPETAS);

    expect(c.nombre).toBe("Himnos / Clásicos");
    expect(c.ruta).toBe("C:\\Música\\Iglesia\\Himnos\\Clásicos");
  });

  it("baja tantos niveles como haya", () => {
    const c = carpetaReal(pista("C:\\Música\\Iglesia\\Himnos\\Clásicos\\Vol 1\\a.mp3"), CARPETAS);

    expect(c.nombre).toBe("Himnos / Clásicos / Vol 1");
  });

  it("un archivo en la propia raíz es la raíz, no un grupo sin nombre", () => {
    const c = carpetaReal(pista("C:\\Música\\Iglesia\\Himnos\\suelta.mp3"), CARPETAS);

    expect(c.nombre).toBe("Himnos");
    expect(c.ruta).toBe("C:\\Música\\Iglesia\\Himnos");
  });

  it("entiende rutas con barra, que es lo que manda macOS y Linux", () => {
    const carpetas: Folder[] = [{ id: "f9", nombre: "Coros", ruta: "/Users/ana/Música/Coros", count: 0 }];
    const c = carpetaReal(pista("/Users/ana/Música/Coros/Especiales/x.flac"), carpetas);

    expect(c.nombre).toBe("Coros / Especiales");
    expect(c.ruta).toBe("/Users/ana/Música/Coros/Especiales");
  });

  it("una raíz con separador al final no deja un nivel en blanco", () => {
    const carpetas: Folder[] = [{ id: "f9", nombre: "Coros", ruta: "/Users/ana/Coros/", count: 0 }];

    expect(carpetaReal(pista("/Users/ana/Coros/Nuevos/x.mp3"), carpetas).nombre).toBe("Coros / Nuevos");
  });

  it("no se lleva una carpeta que solo empieza igual", () => {
    // `…\Himnos` no contiene a `…\HimnosViejos`: el prefijo tiene que caer en
    // un borde de segmento o son dos carpetas distintas del disco.
    const c = carpetaReal(pista("C:\\Música\\Iglesia\\HimnosViejos\\a.mp3", { carpeta: "Otra" }), CARPETAS);

    expect(c.nombre).toBe("Otra");
    expect(c.ruta).toBe("");
  });

  it("ignora mayúsculas, porque en Windows son la misma carpeta", () => {
    const c = carpetaReal(pista("c:\\música\\iglesia\\himnos\\Coritos\\a.mp3"), CARPETAS);

    expect(c.nombre).toBe("Himnos / Coritos");
  });

  it("entre raíces anidadas gana la más específica", () => {
    const carpetas: Folder[] = [
      { id: "todo", nombre: "Música", ruta: "C:\\Música", count: 0 },
      HIMNOS,
    ];
    const c = carpetaReal(pista("C:\\Música\\Iglesia\\Himnos\\Clásicos\\a.mp3"), carpetas);

    expect(c.nombre).toBe("Himnos / Clásicos");
  });

  it("dos subcarpetas con el mismo nombre bajo raíces distintas no se juntan", () => {
    const a = carpetaReal(pista("C:\\Música\\Iglesia\\Himnos\\Coros\\a.mp3"), CARPETAS);
    const b = carpetaReal(pista("D:\\Alabanza\\Pistas 2025\\Coros\\b.mp3"), CARPETAS);

    expect(a.nombre).toBe("Himnos / Coros");
    expect(b.nombre).toBe("Pistas 2025 / Coros");
    expect(a.clave).not.toBe(b.clave);
  });

  it("sin ruta se queda con la carpeta que la pista recuerda", () => {
    // El modo navegador y una carpeta quitada de Configuración llegan aquí.
    expect(carpetaReal(pista("", { carpeta: "Coros" }), CARPETAS).nombre).toBe("Coros");
    expect(carpetaReal(pista("C:\\Otro\\sitio\\a.mp3", { carpeta: "Coros" }), CARPETAS).nombre).toBe("Coros");
  });

  it("y si tampoco recuerda una, dice algo antes que nada", () => {
    expect(carpetaReal(pista("", { carpeta: "   " }), CARPETAS).nombre).toBe("—");
    expect(carpetaReal(pista("", { carpeta: "" }), []).nombre).toBe("—");
  });
});
