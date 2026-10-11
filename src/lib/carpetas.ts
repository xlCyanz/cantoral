// A qué carpeta pertenece una pista, de verdad.
//
// `Track.carpeta` dice la carpeta *indexada*: la raíz que alguien eligió en
// Configuración. Con eso, agrupar por carpeta mete las 128 pistas de
// `C:\Música\Iglesia\Himnos` en un solo montón, aunque en el disco estén
// repartidas en «Clásicos», «Coritos» y «Especiales» —que es justo el orden
// que la persona que las guardó ya se tomó el trabajo de construir—.
//
// Aquí se recupera ese orden restando la raíz indexada de la ruta del archivo.
// No hace falta tocar el núcleo: el catálogo ya viaja con `path` en cada pista
// y con `ruta` en cada carpeta.

import type { Folder, Track } from "./types";

/** La carpeta de una pista, lista para encabezar un grupo. */
export interface CarpetaDeLaPista {
  /** Clave de agrupación; única por carpeta del disco. */
  clave: string;
  /** Lo que se lee en el encabezado: «Himnos / Clásicos». */
  nombre: string;
  /** La carpeta tal como está en el disco, para la letra pequeña. */
  ruta: string;
}

/** Los dos separadores plegados a «/», y sin uno al final. */
function normalizar(p: string): string {
  return p.replace(/[\\/]+/g, "/").replace(/\/+$/, "");
}

/** Una carpeta indexada, con su ruta ya preparada para comparar. */
interface Raiz {
  folder: Folder;
  /** La ruta normalizada, para recortarla de la del archivo. */
  normal: string;
  /** Y en minúsculas, para preguntar si un archivo cae dentro. */
  comparable: string;
}

/**
 * Las carpetas indexadas, la más larga primero.
 *
 * Así la primera que contiene un archivo es la más profunda, que es la que
 * gana. El orden es estable: entre dos igual de largas sigue ganando la
 * primera de la lista, como cuando se recorrían todas buscando la mayor.
 * Una carpeta sin ruta no contiene nada.
 */
function prepararRaices(folders: readonly Folder[]): Raiz[] {
  return folders
    .filter((f) => f.ruta)
    .map((folder) => {
      const normal = normalizar(folder.ruta);
      return { folder, normal, comparable: normal.toLowerCase() };
    })
    .sort((a, b) => b.normal.length - a.normal.length);
}

/**
 * La raíz que contiene `ruta`, o ninguna.
 *
 * Compara por segmentos enteros: sin eso, `C:\Música\Iglesia` se llevaría por
 * delante las pistas de `C:\Música\IglesiaVieja`. Y sin ignorar mayúsculas,
 * una raíz guardada como `C:\Musica` dejaría de reconocer sus propios archivos
 * en Windows, donde las dos grafías son la misma carpeta.
 */
function raizDe(ruta: string, raices: readonly Raiz[]): Raiz | null {
  if (!ruta) return null;
  return raizDeNormal(normalizar(ruta), raices);
}

/** Lo mismo, para una ruta ya normalizada. */
function raizDeNormal(normal: string, raices: readonly Raiz[]): Raiz | null {
  if (raices.length === 0) return null;
  const r = normal.toLowerCase();
  for (const raiz of raices) {
    const b = raiz.comparable;
    if (r === b || r.startsWith(b + "/")) return raiz;
  }
  return null;
}

/**
 * Lo preparado para una lista de carpetas, y la carpeta de cada pista ya
 * calculada con ella.
 *
 * Agrupar por carpeta preguntaba esto por cada pista y por cada carpeta, con
 * expresiones regulares y minúsculas cada vez, en cada corazón y en cada
 * grupo que se plegaba: con diez mil pistas, decenas de milisegundos. Las
 * raíces se preparan una vez por lista de carpetas, y la respuesta de cada
 * pista se guarda con la pista; una pista que cambia es un objeto nuevo y se
 * vuelve a calcular sola.
 *
 * Además, por directorio: las pistas de un mismo directorio caen casi siempre
 * en el mismo grupo (ver `porSuDirectorio`), así que la primera vez que se
 * agrupa —con todas las pistas recién llegadas— se calcula una vez por
 * directorio y no una por pista.
 *
 * Solo cuentan el id, el nombre y la ruta: que cambie cuántas pistas tiene una
 * carpeta, o cuándo se escaneó, no mueve ninguna pista de grupo.
 */
interface Preparadas {
  folders: readonly Folder[];
  firma: string;
  raices: Raiz[];
  /** Los directorios que contienen una raíz, comparables. */
  padres: Set<string>;
  porPista: WeakMap<Track, CarpetaDeLaPista>;
  /**
   * La carpeta de cada directorio ya visto: `null` si no cae bajo ninguna
   * raíz, `false` si no se puede deducir del directorio.
   */
  porDirectorio: Map<string, CarpetaDeLaPista | null | false>;
}

let preparadas: Preparadas | null = null;

function preparadasPara(folders: readonly Folder[]): Preparadas {
  if (preparadas?.folders === folders) return preparadas;
  const firma = folders.map((f) => `${f.id}\u0000${f.nombre}\u0000${f.ruta}`).join("\u0001");
  if (preparadas?.firma === firma) {
    preparadas.folders = folders;
    return preparadas;
  }
  const raices = prepararRaices(folders);
  const padres = new Set(raices.map((r) => r.comparable.slice(0, Math.max(0, r.comparable.lastIndexOf("/")))));
  preparadas = { folders, firma, raices, padres, porPista: new WeakMap(), porDirectorio: new Map() };
  return preparadas;
}

/** La ruta sin el nombre del archivo, con el separador que traía. */
function carpetaDe(p: string): string {
  const i = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
  return i > 0 ? p.slice(0, i) : "";
}

/**
 * Lo que se sabe de una pista cuyo archivo no cae bajo ninguna raíz indexada.
 *
 * Pasa en el modo navegador, con una pista a la que le falta `path`, y con una
 * carpeta que se quitó de Configuración mientras sus pistas seguían en el
 * catálogo. La carpeta indexada que la pista recuerda es peor que la real, pero
 * mucho mejor que un grupo sin nombre.
 */
function porLoQueDiceLaPista(t: Track): CarpetaDeLaPista {
  const n = t.carpeta?.trim() || "—";
  return { clave: n, nombre: n, ruta: "" };
}

/**
 * La carpeta que de verdad contiene el archivo, relativa a su raíz indexada.
 *
 * Cuando hay raíces anidadas gana la más larga: si alguien indexó
 * `C:\Música` y también `C:\Música\Iglesia\Himnos`, un archivo de la segunda
 * pertenece a la segunda, que es la que esa persona se molestó en señalar.
 */
export function carpetaReal(t: Track, folders: readonly Folder[]): CarpetaDeLaPista {
  const prep = preparadasPara(folders);
  let carpeta = prep.porPista.get(t);
  if (!carpeta) {
    carpeta = porSuDirectorio(t, prep) ?? calcularCarpeta(t, prep.raices);
    prep.porPista.set(t, carpeta);
  }
  return carpeta;
}

/**
 * La carpeta de la pista sacada de la de sus vecinas, o `undefined` si hay
 * que calcularla.
 *
 * Dos archivos del mismo directorio caen bajo la misma raíz y en el mismo
 * grupo, con dos excepciones que aquí se dejan fuera: una ruta que acaba en
 * separador —su último tramo se lee como el archivo— y un directorio que
 * contiene una raíz como si fuera un archivo, que solo se lleva ese archivo.
 * Sin raíz, el grupo sale de lo que dice cada pista (`porLoQueDiceLaPista`).
 */
function porSuDirectorio(t: Track, prep: Preparadas): CarpetaDeLaPista | undefined {
  const ruta = t.path ?? "";
  const i = Math.max(ruta.lastIndexOf("\\"), ruta.lastIndexOf("/"));
  if (i <= 0 || i === ruta.length - 1) return undefined;
  const directorio = ruta.slice(0, i);
  let visto = prep.porDirectorio.get(directorio);
  if (visto === undefined) {
    const seguro = !prep.padres.has(normalizar(directorio).toLowerCase());
    visto = seguro ? bajoSuRaiz(t, prep.raices) : false;
    prep.porDirectorio.set(directorio, visto);
  }
  if (visto === false) return undefined;
  return visto ?? porLoQueDiceLaPista(t);
}

function calcularCarpeta(t: Track, raices: readonly Raiz[]): CarpetaDeLaPista {
  return bajoSuRaiz(t, raices) ?? porLoQueDiceLaPista(t);
}

/** La carpeta de la pista relativa a su raíz, o `null` si no cae bajo ninguna. */
function bajoSuRaiz(t: Track, raices: readonly Raiz[]): CarpetaDeLaPista | null {
  const ruta = t.path ?? "";
  const normal = normalizar(ruta);
  const raiz = ruta ? raizDeNormal(normal, raices) : null;
  if (!raiz) return null;

  const resto = normal
    .slice(raiz.normal.length)
    .split("/")
    .filter(Boolean)
    // Lo último es el archivo, no una carpeta.
    .slice(0, -1);

  return {
    // El id de la carpeta va delante para que dos raíces con una subcarpeta
    // del mismo nombre no acaben en el mismo grupo: «Coros» bajo Himnos y
    // «Coros» bajo Pistas 2025 son dos sitios distintos del disco.
    clave: [raiz.folder.id, ...resto].join("/"),
    nombre: [raiz.folder.nombre, ...resto].join(" / "),
    ruta: carpetaDe(ruta),
  };
}


/**
 * La línea de debajo de la ruta en Configuración: cuántas pistas, cuándo se
 * leyó y qué falta.
 *
 * `cuando` viene ya escrito desde fuera porque el formato de la fecha es cosa
 * de la vista —«hoy a las 9:12», «ayer»— y esto solo lo encadena.
 */
export function metaDeCarpeta(
  f: { count: number; lastScan?: string },
  faltantes: number,
  cuando: string,
): string {
  const partes = [`${f.count} ${f.count === 1 ? "pista" : "pistas"}`];
  partes.push(f.lastScan ? `actualizada ${cuando}` : "aún sin escanear");
  if (faltantes > 0) {
    partes.push(`${faltantes} ${faltantes === 1 ? "archivo no encontrado" : "archivos no encontrados"}`);
  }
  return partes.join(" · ");
}

/**
 * Cuántos archivos no se encuentran, por carpeta.
 *
 * Se dicen por carpeta y no solo en el total de la barra lateral: cuando un
 * disco externo se queda sin enchufar, lo que hace falta saber es *qué*
 * carpeta se ha quedado a oscuras.
 *
 * Gana la carpeta más profunda que contenga la pista, igual que en
 * `carpetaReal`: con «Música» y «Música/Coros» indexadas las dos, una pista de
 * Coros cuenta para Coros.
 */
export function faltantesPorCarpetaDe(
  pistas: readonly Track[],
  carpetas: readonly Folder[],
): Record<string, number> {
  const fuera: Record<string, number> = {};
  const { raices } = preparadasPara(carpetas);
  for (const t of pistas) {
    if (!t.missing) continue;
    const elegida = raizDe(t.path ?? "", raices)?.folder;
    if (elegida) fuera[elegida.id] = (fuera[elegida.id] ?? 0) + 1;
  }
  return fuera;
}
