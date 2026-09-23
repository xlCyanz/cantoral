// Una lista que viaja a otra instalación.
//
// El archivo lleva lo justo para volver a encontrar cada pista en otro
// catálogo: nunca el audio —que es lo que la app promete no mover— y nunca la
// ruta absoluta de donde estaba, solo el nombre del archivo. Una ruta completa
// le contaría a quien reciba la lista cómo tiene organizado el disco quien la
// mandó, y para emparejar no hace falta.

import type { Playlist, Track } from "./types";

/** Versión del formato. Debe coincidir con `compartir::VERSION` en Rust. */
export const VERSION = 1;

export interface PistaCompartida {
  titulo: string;
  artista: string;
  album: string;
  durSec: number;
  ocasion: string;
  /** Solo el nombre del archivo, nunca la ruta. */
  archivo: string;
}

export interface ListaCompartida {
  nombre: string;
  fecha: string;
  ocasion: string;
  plantilla: boolean;
}

export interface ArchivoDeLista {
  cantoral: number;
  lista: ListaCompartida;
  pistas: PistaCompartida[];
  exportado: string;
}

/** `C:\Música\coro.mp3` → `coro.mp3`. Vacío si no hay ruta que mirar. */
export function soloElNombre(ruta: string | undefined): string {
  if (!ruta) return "";
  const partes = ruta.split(/[\\/]/);
  return partes[partes.length - 1] ?? "";
}

/** Armar el archivo que se va a escribir. */
export function armarArchivo(
  lista: Playlist,
  pistas: readonly Track[],
  ahora: Date = new Date(),
): ArchivoDeLista {
  return {
    cantoral: VERSION,
    lista: {
      nombre: lista.nombre,
      fecha: lista.fecha,
      ocasion: lista.ocasion,
      plantilla: lista.plantilla,
    },
    pistas: pistas.map((t) => ({
      titulo: t.titulo,
      artista: t.artista,
      album: t.album,
      durSec: t.durSec,
      ocasion: t.ocasion,
      archivo: soloElNombre(t.path),
    })),
    exportado: ahora.toISOString(),
  };
}

/** Nombre sugerido en el diálogo de guardar. */
export function nombreDeArchivo(nombre: string): string {
  const limpio = nombre.trim().replace(/[\\/:*?"<>|]/g, "-") || "lista";
  return `${limpio}.cantoral.json`;
}

/** Plegar para comparar: minúsculas, sin acentos, sin espacios de sobra. */
function plano(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cuántos segundos pueden bailar dos duraciones y seguir siendo la misma toma.
 *
 * Un par de segundos es re-codificación o metadatos redondeados. Más que eso
 * ya es otra grabación, y meterla en el culto sin avisar es peor que decir que
 * falta.
 */
export const MARGEN_SEG = 3;

export type Confianza = "archivo" | "datos";

export interface Emparejada {
  pista: PistaCompartida;
  /** Id de la pista local con la que se emparejó. */
  id: string;
  /** Por el nombre del archivo, o por título + artista + duración. */
  por: Confianza;
}

export interface Resultado {
  encontradas: Emparejada[];
  /** Las que no están en este catálogo, en el orden en que venían. */
  faltantes: PistaCompartida[];
}

/**
 * Entre varias candidatas, la que conviene usar.
 *
 * Primero una cuyo archivo siga estando: una lista armada sobre pistas
 * marcadas como faltantes no se puede reproducir. Después la de id más bajo,
 * para que dos importaciones del mismo archivo den la misma lista.
 */
function mejor(candidatas: readonly Track[]): Track {
  const presentes = candidatas.filter((t) => !t.missing);
  const entre = presentes.length > 0 ? presentes : candidatas;
  return [...entre].sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }))[0];
}

/**
 * Emparejar lo que trae el archivo con lo que hay en este catálogo.
 *
 * Dos vías, y a propósito ninguna más: el nombre del archivo, que es lo que de
 * verdad identifica una pista entre dos copias de la misma biblioteca, y
 * título + artista + duración parecida, para cuando alguien renombró sus
 * archivos. Una tercera vía más laxa —mismo título, cualquier duración— haría
 * que el culto empezara con una versión de nueve minutos de algo que dura tres
 * sin que nadie lo hubiera pedido.
 *
 * Lo que no se empareja no se inventa: sale en la lista de faltantes con lo
 * que se buscaba, para que se pueda añadir a mano.
 */
export function emparejar(
  pistas: readonly PistaCompartida[],
  catalogo: readonly Track[],
): Resultado {
  const porArchivo = new Map<string, Track[]>();
  const porDatos = new Map<string, Track[]>();
  catalogo.forEach((t) => {
    const archivo = plano(soloElNombre(t.path));
    if (archivo) {
      const ya = porArchivo.get(archivo);
      if (ya) ya.push(t);
      else porArchivo.set(archivo, [t]);
    }
    const clave = `${plano(t.titulo)}\u0000${plano(t.artista)}`;
    const ya = porDatos.get(clave);
    if (ya) ya.push(t);
    else porDatos.set(clave, [t]);
  });

  const encontradas: Emparejada[] = [];
  const faltantes: PistaCompartida[] = [];
  pistas.forEach((p) => {
    const archivo = plano(p.archivo);
    const porNombre = archivo ? porArchivo.get(archivo) : undefined;
    if (porNombre?.length) {
      encontradas.push({ pista: p, id: mejor(porNombre).id, por: "archivo" });
      return;
    }
    const mismos = porDatos.get(`${plano(p.titulo)}\u0000${plano(p.artista)}`) ?? [];
    const cerca = mismos.filter((t) => Math.abs(t.durSec - p.durSec) <= MARGEN_SEG);
    if (cerca.length) {
      encontradas.push({ pista: p, id: mejor(cerca).id, por: "datos" });
      return;
    }
    faltantes.push(p);
  });
  return { encontradas, faltantes };
}

/**
 * Los ids que van a la lista, sin repetir.
 *
 * Dos entradas del archivo pueden caer sobre la misma pista local —el mismo
 * himno grabado dos veces, y este catálogo solo tiene una— y una lista no
 * puede llevar la misma pista dos veces: `playlist_tracks` tiene por clave
 * primaria (lista, pista). Gana la primera aparición, que es donde el orden
 * del culto la quería.
 */
export function idsParaLaLista(encontradas: readonly Emparejada[]): string[] {
  const vistos = new Set<string>();
  const ids: string[] = [];
  encontradas.forEach(({ id }) => {
    if (vistos.has(id)) return;
    vistos.add(id);
    ids.push(id);
  });
  return ids;
}

/**
 * Leer el texto de un archivo compartido, o explicar por qué no se puede.
 *
 * Las mismas reglas que `compartir::leer` en Rust, que es la que corre en la
 * app; esta es para el modo navegador, igual que el resto del store repite en
 * memoria lo que allí hace SQLite. Cada negativa dice qué pasa, porque la
 * alternativa es un usuario mirando un diálogo que no hizo nada.
 */
export function parsearArchivo(texto: string): ArchivoDeLista {
  let valor: unknown;
  try {
    valor = JSON.parse(texto);
  } catch {
    throw new Error("El archivo no es JSON válido, así que no salió de Cantoral.");
  }
  if (typeof valor !== "object" || valor === null) {
    throw new Error("El archivo no es una lista exportada de Cantoral.");
  }
  const bruto = valor as Record<string, unknown>;
  const v = bruto.cantoral;
  if (typeof v !== "number") {
    throw new Error("El archivo no es una lista exportada de Cantoral.");
  }
  if (v > VERSION) {
    throw new Error(
      `Esta lista se exportó con una versión más nueva de Cantoral (formato ${v}). Actualiza la app para abrirla.`,
    );
  }
  const lista = (bruto.lista ?? {}) as Record<string, unknown>;
  const nombre = texto_(lista.nombre);
  if (!nombre.trim()) throw new Error("La lista exportada no tiene nombre.");
  const crudas = Array.isArray(bruto.pistas) ? bruto.pistas : [];
  return {
    cantoral: v,
    lista: {
      nombre,
      fecha: texto_(lista.fecha),
      ocasion: texto_(lista.ocasion),
      plantilla: lista.plantilla === true,
    },
    pistas: crudas.map((p) => {
      const t = (p ?? {}) as Record<string, unknown>;
      return {
        titulo: texto_(t.titulo),
        artista: texto_(t.artista),
        album: texto_(t.album),
        durSec: typeof t.durSec === "number" && Number.isFinite(t.durSec) ? t.durSec : 0,
        ocasion: texto_(t.ocasion),
        archivo: texto_(t.archivo),
      };
    }),
    exportado: texto_(bruto.exportado),
  };
}

/** A field that should be a string, whatever the file actually holds there. */
function texto_(v: unknown): string {
  return typeof v === "string" ? v : "";
}
