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

/**
 * Si `ruta` está dentro de `raiz`.
 *
 * Compara por segmentos enteros: sin eso, `C:\Música\Iglesia` se llevaría por
 * delante las pistas de `C:\Música\IglesiaVieja`. Y sin ignorar mayúsculas,
 * una raíz guardada como `C:\Musica` dejaría de reconocer sus propios archivos
 * en Windows, donde las dos grafías son la misma carpeta.
 */
function dentroDe(ruta: string, raiz: string): boolean {
  if (!ruta || !raiz) return false;
  const r = normalizar(ruta).toLowerCase();
  const b = normalizar(raiz).toLowerCase();
  return r === b || r.startsWith(b + "/");
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
  const ruta = t.path ?? "";
  let raiz: Folder | null = null;
  for (const f of folders) {
    if (!dentroDe(ruta, f.ruta)) continue;
    if (!raiz || normalizar(f.ruta).length > normalizar(raiz.ruta).length) raiz = f;
  }
  if (!raiz) return porLoQueDiceLaPista(t);

  const resto = normalizar(ruta)
    .slice(normalizar(raiz.ruta).length)
    .split("/")
    .filter(Boolean)
    // Lo último es el archivo, no una carpeta.
    .slice(0, -1);

  return {
    // El id de la carpeta va delante para que dos raíces con una subcarpeta
    // del mismo nombre no acaben en el mismo grupo: «Coros» bajo Himnos y
    // «Coros» bajo Pistas 2025 son dos sitios distintos del disco.
    clave: [raiz.id, ...resto].join("/"),
    nombre: [raiz.nombre, ...resto].join(" / "),
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
  for (const t of pistas) {
    if (!t.missing) continue;
    let elegida: Folder | null = null;
    for (const f of carpetas) {
      if (!dentroDe(t.path ?? "", f.ruta)) continue;
      if (!elegida || normalizar(f.ruta).length > normalizar(elegida.ruta).length) elegida = f;
    }
    if (elegida) fuera[elegida.id] = (fuera[elegida.id] ?? 0) + 1;
  }
  return fuera;
}
