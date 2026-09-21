// Una lista importada que trae la canción equivocada es peor que una a la que
// le faltan dos: la segunda se ve de inmediato, la primera se descubre en el
// culto. Por eso el emparejado tiene solo dos vías y las dos son estrictas.

import { describe, expect, it } from "vitest";
import type { Playlist, Track } from "../types";
import {
  VERSION,
  armarArchivo,
  emparejar,
  idsParaLaLista,
  nombreDeArchivo,
  parsearArchivo,
  soloElNombre,
} from "../compartir";

function pista(over: Partial<Track> = {}): Track {
  return {
    id: "1",
    titulo: "Sublime Gracia",
    artista: "Coro Congregacional",
    album: "Himnos",
    dur: "4:12",
    durSec: 252,
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

const lista: Playlist = {
  id: "p1",
  nombre: "Culto 4 Ene",
  fecha: "2026-01-04",
  ocasion: "Servicio dominical",
  ids: ["1"],
  plantilla: false,
};

/** What the exported file says about one track, to feed straight back in. */
const comoVienen = (t: Track[]) => armarArchivo(lista, t).pistas;

describe("soloElNombre", () => {
  it("se queda con el nombre y tira la ruta", () => {
    expect(soloElNombre("/Users/ana/Música/coro.mp3")).toBe("coro.mp3");
    expect(soloElNombre("C:\\Musica\\coro.mp3")).toBe("coro.mp3");
    expect(soloElNombre("coro.mp3")).toBe("coro.mp3");
  });

  it("aguanta no tener ruta", () => {
    expect(soloElNombre(undefined)).toBe("");
    expect(soloElNombre("")).toBe("");
  });
});

describe("armarArchivo", () => {
  it("no se lleva la ruta del disco de quien exporta", () => {
    // Lo único que hace falta para emparejar es el nombre; la ruta contaría
    // cómo tiene organizado el disco quien mandó el archivo.
    const archivo = armarArchivo(lista, [pista({ path: "/Users/ana/Música/coro.mp3" })]);

    expect(JSON.stringify(archivo)).not.toContain("/Users/ana");
    expect(archivo.pistas[0].archivo).toBe("coro.mp3");
  });

  it("lleva la versión del formato, para que un lector viejo pueda negarse", () => {
    expect(armarArchivo(lista, []).cantoral).toBe(VERSION);
  });

  it("guarda lo que sirve para volver a encontrar la pista", () => {
    const [p] = comoVienen([pista({ tags: ["lenta", "apertura"] })]);

    expect(p.titulo).toBe("Sublime Gracia");
    expect(p.artista).toBe("Coro Congregacional");
    expect(p.durSec).toBe(252);
    expect(p.tono).toBe("Sol");
    expect(p.etiquetas).toEqual(["lenta", "apertura"]);
  });

  it("copia las etiquetas en vez de compartirlas", () => {
    const original = pista({ tags: ["lenta"] });

    armarArchivo(lista, [original]).pistas[0].etiquetas.push("intrusa");

    expect(original.tags).toEqual(["lenta"]);
  });

  it("conserva los datos de la lista, plantilla incluida", () => {
    const archivo = armarArchivo({ ...lista, plantilla: true }, []);

    expect(archivo.lista).toEqual({
      nombre: "Culto 4 Ene",
      fecha: "2026-01-04",
      ocasion: "Servicio dominical",
      plantilla: true,
    });
  });
});

describe("nombreDeArchivo", () => {
  it("propone un nombre que se reconoce", () => {
    expect(nombreDeArchivo("Culto 4 Ene")).toBe("Culto 4 Ene.cantoral.json");
  });

  it("quita lo que un sistema de archivos no acepta", () => {
    expect(nombreDeArchivo("Santa Cena: 4/1")).toBe("Santa Cena- 4-1.cantoral.json");
  });

  it("no deja un nombre vacío", () => {
    expect(nombreDeArchivo("   ")).toBe("lista.cantoral.json");
  });
});

describe("emparejar por el nombre del archivo", () => {
  it("encuentra la pista aunque le hayan cambiado el título", () => {
    // El nombre del archivo es lo que de verdad identifica la misma pista
    // entre dos copias de la misma biblioteca.
    const vienen = comoVienen([pista({ path: "/a/coro.mp3" })]);
    const catalogo = [pista({ id: "9", titulo: "Otro título", path: "/otro/sitio/coro.mp3" })];

    const { encontradas, faltantes } = emparejar(vienen, catalogo);

    expect(encontradas).toEqual([{ pista: vienen[0], id: "9", por: "archivo" }]);
    expect(faltantes).toEqual([]);
  });

  it("no le importan las mayúsculas del nombre", () => {
    const vienen = comoVienen([pista({ path: "/a/Coro.MP3" })]);

    expect(emparejar(vienen, [pista({ id: "9", path: "/b/coro.mp3" })])[
      "encontradas"
    ]).toHaveLength(1);
  });

  it("entre dos con el mismo nombre prefiere la que sí está en el disco", () => {
    const vienen = comoVienen([pista({ path: "/a/coro.mp3" })]);
    const catalogo = [
      pista({ id: "2", path: "/x/coro.mp3", missing: true }),
      pista({ id: "7", path: "/y/coro.mp3" }),
    ];

    expect(emparejar(vienen, catalogo).encontradas[0].id).toBe("7");
  });

  it("con dos igual de buenas elige siempre la misma", () => {
    // Importar el mismo archivo dos veces debe dar la misma lista.
    const vienen = comoVienen([pista({ path: "/a/coro.mp3" })]);
    const catalogo = [pista({ id: "12", path: "/x/coro.mp3" }), pista({ id: "3", path: "/y/coro.mp3" })];

    expect(emparejar(vienen, catalogo).encontradas[0].id).toBe("3");
    expect(emparejar(vienen, [...catalogo].reverse()).encontradas[0].id).toBe("3");
  });
});

describe("emparejar por título, artista y duración", () => {
  it("encuentra la pista aunque el archivo se llame distinto", () => {
    const vienen = comoVienen([pista({ path: "/a/01-sublime.mp3" })]);
    const catalogo = [pista({ id: "9", path: "/b/sublime-gracia-final.mp3" })];

    const { encontradas } = emparejar(vienen, catalogo);

    expect(encontradas).toEqual([{ pista: vienen[0], id: "9", por: "datos" }]);
  });

  it("no le importan acentos ni mayúsculas ni espacios de sobra", () => {
    const vienen = comoVienen([pista({ titulo: "Oración  de  Paz", artista: "Coro Á" })]);
    const catalogo = [pista({ id: "9", titulo: "oracion de paz", artista: "coro a", path: "" })];

    expect(emparejar(vienen, catalogo).encontradas).toHaveLength(1);
  });

  it("aguanta un par de segundos de diferencia", () => {
    // Re-codificar o redondear metadatos mueve la duración un poco.
    const vienen = comoVienen([pista({ durSec: 252, path: "" })]);

    expect(emparejar(vienen, [pista({ id: "9", durSec: 254, path: "" })]).encontradas).toHaveLength(1);
  });

  it("pero no una grabación que dura otra cosa", () => {
    // Misma canción, otra toma: al culto no entra sin que nadie lo diga.
    const vienen = comoVienen([pista({ durSec: 252, path: "" })]);

    const { encontradas, faltantes } = emparejar(vienen, [pista({ id: "9", durSec: 540, path: "" })]);

    expect(encontradas).toEqual([]);
    expect(faltantes).toHaveLength(1);
  });

  it("el mismo título de otro artista no es la misma pista", () => {
    const vienen = comoVienen([pista({ path: "" })]);
    const catalogo = [pista({ id: "9", artista: "Otro Coro", path: "" })];

    expect(emparejar(vienen, catalogo).encontradas).toEqual([]);
  });
});

describe("lo que no está", () => {
  it("sale en faltantes con lo que se buscaba, en su orden", () => {
    const vienen = comoVienen([
      pista({ id: "a", titulo: "Está", path: "/a/esta.mp3" }),
      pista({ id: "b", titulo: "No está", path: "/a/no.mp3" }),
      pista({ id: "c", titulo: "Tampoco", path: "/a/tampoco.mp3" }),
    ]);
    const catalogo = [pista({ id: "9", titulo: "Está", path: "/b/esta.mp3" })];

    const { encontradas, faltantes } = emparejar(vienen, catalogo);

    expect(encontradas).toHaveLength(1);
    expect(faltantes.map((p) => p.titulo)).toEqual(["No está", "Tampoco"]);
  });

  it("no pierde ni duplica ninguna entrada", () => {
    const vienen = comoVienen([pista({ id: "a" }), pista({ id: "b", titulo: "Otra" })]);

    const { encontradas, faltantes } = emparejar(vienen, [pista({ id: "9" })]);

    expect(encontradas.length + faltantes.length).toBe(vienen.length);
  });

  it("un catálogo vacío deja todo como faltante y no revienta", () => {
    const vienen = comoVienen([pista()]);

    expect(emparejar(vienen, []).faltantes).toHaveLength(1);
  });

  it("una lista sin pistas se importa sin nada que buscar", () => {
    expect(emparejar([], [pista()])).toEqual({ encontradas: [], faltantes: [] });
  });
});

describe("idsParaLaLista", () => {
  it("mantiene el orden del culto", () => {
    const vienen = comoVienen([
      pista({ id: "a", titulo: "Tercera", path: "/a/3.mp3" }),
      pista({ id: "b", titulo: "Primera", path: "/a/1.mp3" }),
    ]);
    const catalogo = [
      pista({ id: "30", titulo: "Tercera", path: "/b/3.mp3" }),
      pista({ id: "10", titulo: "Primera", path: "/b/1.mp3" }),
    ];

    expect(idsParaLaLista(emparejar(vienen, catalogo).encontradas)).toEqual(["30", "10"]);
  });

  it("no mete la misma pista dos veces", () => {
    // `playlist_tracks` tiene por clave primaria (lista, pista): repetir una
    // haría fallar el guardado entero.
    const vienen = comoVienen([
      pista({ id: "a", path: "/a/coro.mp3" }),
      pista({ id: "b", titulo: "Otra cosa", path: "/a/coro.mp3" }),
    ]);
    const catalogo = [pista({ id: "9", path: "/b/coro.mp3" })];

    const { encontradas } = emparejar(vienen, catalogo);

    expect(encontradas).toHaveLength(2);
    expect(idsParaLaLista(encontradas)).toEqual(["9"]);
  });
});

// Los mismos casos que `compartir::tests` en Rust. Si esta regla y la de allá
// dejan de coincidir, el modo navegador deja de mostrar lo que hace la app.
describe("parsearArchivo", () => {
  const minimo = '{"cantoral":1,"lista":{"nombre":"Culto"},"pistas":[]}';

  it("lee lo que esta app escribe", () => {
    const escrito = JSON.stringify(armarArchivo(lista, [pista({ path: "/a/coro.mp3" })]));

    const leido = parsearArchivo(escrito);

    expect(leido.lista.nombre).toBe("Culto 4 Ene");
    expect(leido.pistas[0].archivo).toBe("coro.mp3");
    expect(leido.pistas[0].durSec).toBe(252);
  });

  it("los campos opcionales pueden faltar", () => {
    const leido = parsearArchivo(minimo);

    expect(leido.lista.fecha).toBe("");
    expect(leido.lista.plantilla).toBe(false);
    expect(leido.pistas).toEqual([]);
  });

  it("lo que no es JSON lo dice", () => {
    expect(() => parsearArchivo("esto no es json")).toThrow(/JSON/);
  });

  it("un JSON que no es una lista de Cantoral se rechaza", () => {
    // Un `package.json` elegido por error se parsea perfectamente.
    expect(() => parsearArchivo('{"name":"algo","version":"1.0.0"}')).toThrow(/no es una lista/);
    expect(() => parsearArchivo("[1,2,3]")).toThrow(/no es una lista/);
    expect(() => parsearArchivo("null")).toThrow(/no es una lista/);
  });

  it("un formato más nuevo se rechaza en vez de leerse a medias", () => {
    expect(() => parsearArchivo('{"cantoral":99,"lista":{"nombre":"X"},"pistas":[]}')).toThrow(
      /versión más nueva/,
    );
  });

  it("una lista sin nombre se rechaza", () => {
    expect(() => parsearArchivo('{"cantoral":1,"lista":{"nombre":"  "},"pistas":[]}')).toThrow(
      /no tiene nombre/,
    );
  });

  it("un campo con el tipo equivocado no envenena la lista", () => {
    // El archivo pudo editarse a mano entre las dos instalaciones.
    const raro = '{"cantoral":1,"lista":{"nombre":"Culto"},"pistas":[{"titulo":"X","durSec":"largo","etiquetas":"no es lista"}]}';

    const [p] = parsearArchivo(raro).pistas;

    expect(p.durSec).toBe(0);
    expect(p.etiquetas).toEqual([]);
    expect(p.artista).toBe("");
  });
});
