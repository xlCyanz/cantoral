// Una lista que viaja a otra instalación.
//
// El archivo lleva lo justo para volver a encontrar cada pista en otro
// catálogo: nunca el audio —que es lo que la app promete no mover— y nunca la
// ruta absoluta de donde estaba, solo el nombre del archivo. Una ruta completa
// le contaría a quien reciba la lista cómo tiene organizado el disco quien la
// mandó, y para emparejar no hace falta.

import type { Playlist, TipoMomento, Track } from "./types";
import { tipoDeMomento } from "./momentos";
import type { Elemento } from "./momentos";

/**
 * Versión del formato. Debe coincidir con `compartir::VERSION` en Rust.
 *
 * El 2 añade `momentos` (#145). Un culto sin momentos se sigue escribiendo como
 * 1 —`VERSION_SIN_MOMENTOS`—, así una instalación de antes lo abre igual; uno
 * con momentos sale como 2, y la de antes pide que la actualicen en vez de
 * perder la oración por el camino sin decirlo.
 */
export const VERSION = 2;
export const VERSION_SIN_MOMENTOS = 1;

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
  ocasion: string;
  plantilla: boolean;
}

/**
 * Un momento sin música del culto (#145).
 *
 * Su sitio se cuenta en pistas —cuántas del archivo van antes— y no en
 * posiciones: del otro lado pueden faltar canciones, y el momento tiene que
 * quedar entre las que lo rodeaban.
 */
export interface MomentoCompartido {
  trasPistas: number;
  tipo: TipoMomento;
  titulo: string;
  texto: string;
}

export interface ArchivoDeLista {
  cantoral: number;
  lista: ListaCompartida;
  pistas: PistaCompartida[];
  /** Ausente en un archivo de formato 1, que es lo mismo que ninguno. */
  momentos?: MomentoCompartido[];
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
  momentos: readonly MomentoCompartido[] = [],
): ArchivoDeLista {
  return {
    cantoral: momentos.length > 0 ? VERSION : VERSION_SIN_MOMENTOS,
    lista: {
      nombre: lista.nombre,
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
    // Sin la clave cuando no hay ninguno: el archivo queda idéntico al de antes.
    ...(momentos.length > 0 ? { momentos: momentos.map((m) => ({ ...m })) } : {}),
    exportado: ahora.toISOString(),
  };
}

/** Armar el archivo de un culto con todo lo que tiene: pistas y momentos. */
export function armarArchivoDeCulto(
  lista: Playlist,
  elementos: readonly Elemento[],
  ahora: Date = new Date(),
): ArchivoDeLista {
  const pistas: Track[] = [];
  const momentos: MomentoCompartido[] = [];
  for (const e of elementos) {
    if (e.clase === "pista") pistas.push(e.pista);
    else momentos.push({ trasPistas: pistas.length, tipo: e.momento.tipo, titulo: e.momento.titulo, texto: e.momento.texto });
  }
  return armarArchivo(lista, pistas, ahora, momentos);
}

/**
 * El orden del culto que se importa: las pistas encontradas y los momentos
 * —ya creados, con sus ids de aquí— cada uno en su sitio.
 *
 * Un momento va antes de la pista número `trasPistas` del archivo. Si esa no
 * está en esta biblioteca, se queda igual antes de la siguiente que sí: la
 * oración sigue entre las mismas canciones, falte la que falte.
 */
export function ordenDelImportado(
  pistas: readonly PistaCompartida[],
  encontradas: readonly Emparejada[],
  momentos: readonly { trasPistas: number; id: string }[],
): string[] {
  const idDe = new Map(encontradas.map((e) => [e.pista, e.id] as const));
  const vistos = new Set<string>();
  const orden: string[] = [];
  const momentosAntesDe = (i: number) =>
    momentos.filter((m) => Math.min(m.trasPistas, pistas.length) === i).forEach((m) => orden.push(m.id));
  pistas.forEach((p, i) => {
    momentosAntesDe(i);
    const id = idDe.get(p);
    // Sin repetir, como `idsParaLaLista`.
    if (id && !vistos.has(id)) {
      vistos.add(id);
      orden.push(id);
    }
  });
  momentosAntesDe(pistas.length);
  return orden;
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
  // Un momento sin título no tendría nada que enseñar: se deja fuera en vez de
  // tirar el archivo entero por él.
  const momentos = (Array.isArray(bruto.momentos) ? bruto.momentos : [])
    .map((m): MomentoCompartido => {
      const x = (m ?? {}) as Record<string, unknown>;
      const tras = typeof x.trasPistas === "number" && Number.isFinite(x.trasPistas) ? Math.max(0, Math.floor(x.trasPistas)) : 0;
      return { trasPistas: tras, tipo: tipoDeMomento(x.tipo), titulo: texto_(x.titulo).trim(), texto: texto_(x.texto).trim() };
    })
    .filter((m) => m.titulo);
  return {
    cantoral: v,
    lista: {
      nombre,
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
    ...(momentos.length > 0 ? { momentos } : {}),
    exportado: texto_(bruto.exportado),
  };
}

/** A field that should be a string, whatever the file actually holds there. */
function texto_(v: unknown): string {
  return typeof v === "string" ? v : "";
}
