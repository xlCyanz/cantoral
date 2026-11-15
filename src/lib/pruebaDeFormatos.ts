// La prueba de audio y video de Configuración.
//
// Qué formatos suenan no se puede saber con una lista fija: lo decide el motor
// del sistema —WebView2 en Windows, WKWebView en macOS— y los códecs que tenga
// instalados ese equipo. Así que se prueba: la app trae un archivo de un
// segundo de cada formato (`public/pruebas-de-formato/`, hechos con
// `scripts/muestras-de-formato.sh`), los abre uno a uno en un elemento de
// medios como los del reproductor, y los que no se dejan abrir quedan
// descartados en este equipo (`db::formatos_descartados`).
//
// Cada muestra lleva el códec más común de su contenedor —H.264 y AAC en
// `.mp4` y `.mkv`, Xvid y MP3 en `.avi`—. Un archivo con otro códec dentro
// puede fallar igual aunque su formato pase; eso lo sigue diciendo el
// reproductor al intentarlo.

import { motivoDeError } from "./formatos";

export type TipoDeMuestra = "audio" | "video";

export interface Muestra {
  /** La extensión que se prueba, y el nombre del archivo de muestra. */
  ext: string;
  /** Otras extensiones del mismo formato, que corren su misma suerte. */
  tambien?: readonly string[];
  /** Cómo se le llama en la lista de resultados. */
  nombre: string;
  tipo: TipoDeMuestra;
  /** El tipo que se le da al archivo al abrirlo, para que el motor sepa qué es. */
  mime: string;
}

export const MUESTRAS: readonly Muestra[] = [
  { ext: "mp3", nombre: "MP3", tipo: "audio", mime: "audio/mpeg" },
  { ext: "wav", nombre: "WAV", tipo: "audio", mime: "audio/wav" },
  { ext: "m4a", nombre: "M4A (AAC)", tipo: "audio", mime: "audio/mp4" },
  { ext: "aac", nombre: "AAC", tipo: "audio", mime: "audio/aac" },
  { ext: "flac", nombre: "FLAC", tipo: "audio", mime: "audio/flac" },
  { ext: "ogg", nombre: "OGG (Vorbis)", tipo: "audio", mime: "audio/ogg" },
  { ext: "opus", nombre: "Opus", tipo: "audio", mime: "audio/ogg; codecs=opus" },
  { ext: "aiff", tambien: ["aif"], nombre: "AIFF", tipo: "audio", mime: "audio/aiff" },
  { ext: "wma", nombre: "Windows Media Audio (WMA)", tipo: "audio", mime: "audio/x-ms-wma" },
  { ext: "mp4", nombre: "MP4", tipo: "video", mime: "video/mp4" },
  { ext: "m4v", nombre: "M4V", tipo: "video", mime: "video/x-m4v" },
  { ext: "mov", nombre: "MOV (QuickTime)", tipo: "video", mime: "video/quicktime" },
  { ext: "webm", nombre: "WebM", tipo: "video", mime: "video/webm" },
  { ext: "mkv", nombre: "Matroska (MKV)", tipo: "video", mime: "video/x-matroska" },
  { ext: "avi", nombre: "AVI", tipo: "video", mime: "video/x-msvideo" },
  { ext: "wmv", nombre: "Windows Media Video (WMV)", tipo: "video", mime: "video/x-ms-wmv" },
];

/** Lo que dio la prueba de un formato. */
export interface ResultadoDePrueba {
  ext: string;
  ok: boolean;
  /** Por qué no pasó, dicho para quien opera. */
  motivo?: string;
}

/** Lo que se espera a una muestra antes de darla por muda. */
export const LIMITE_MS = 8000;

/** Lo que la prueba necesita de un `<audio>` o `<video>`. */
export interface ElementoDePrueba {
  src: string;
  preload: string;
  muted: boolean;
  readonly videoWidth?: number;
  readonly error: { code: number } | null;
  addEventListener(tipo: "loadeddata" | "error", oyente: () => void): void;
  removeEventListener(tipo: "loadeddata" | "error", oyente: () => void): void;
  removeAttribute(nombre: "src"): void;
  load(): void;
}

/**
 * Abre `url` en `el` y dice si llegó a tener algo que reproducir.
 *
 * `loadeddata` es el primer momento en que el motor ya decodificó: un
 * contenedor que entiende con un códec que no, falla antes. En un video,
 * además, tiene que haber imagen: un `.mkv` cuyo video no se decodifica pero
 * su sonido sí sonaría con el proyector en negro, y eso no es reproducirlo.
 */
export function probarElemento(
  el: ElementoDePrueba,
  url: string,
  tipo: TipoDeMuestra,
  limiteMs = LIMITE_MS,
): Promise<Omit<ResultadoDePrueba, "ext">> {
  return new Promise((resolve) => {
    const terminar = (r: Omit<ResultadoDePrueba, "ext">) => {
      clearTimeout(reloj);
      el.removeEventListener("loadeddata", cargado);
      el.removeEventListener("error", fallo);
      el.removeAttribute("src");
      el.load();
      resolve(r);
    };
    const cargado = () => {
      if (tipo === "video" && !el.videoWidth) terminar({ ok: false, motivo: "Se oye, pero no se ve la imagen" });
      else terminar({ ok: true });
    };
    const fallo = () => terminar({ ok: false, motivo: motivoDeError(el.error?.code) });
    const reloj = setTimeout(() => terminar({ ok: false, motivo: "No respondió a tiempo" }), limiteMs);
    el.addEventListener("loadeddata", cargado);
    el.addEventListener("error", fallo);
    el.preload = "auto";
    el.muted = true;
    el.src = url;
    el.load();
  });
}

/** Todo lo que la prueba toca fuera de sí, para poder probarla. */
export interface Dependencias {
  /** La URL desde la que se abre la muestra de `m`. */
  abrir: (m: Muestra) => Promise<string>;
  /** La suelta cuando ya no hace falta. */
  soltar: (url: string) => void;
  crearElemento: (tipo: TipoDeMuestra) => ElementoDePrueba;
}

/**
 * Prueba las muestras de una en una —dos decodificadores a la vez se pelean
 * por lo mismo en un equipo justo— y avisa de cada resultado según llega,
 * para que la lista se vaya llenando a la vista.
 */
export async function probarFormatos(
  d: Dependencias,
  alAvanzar: (r: ResultadoDePrueba) => void = () => {},
  muestras: readonly Muestra[] = MUESTRAS,
): Promise<ResultadoDePrueba[]> {
  const resultados: ResultadoDePrueba[] = [];
  for (const m of muestras) {
    let r: ResultadoDePrueba;
    try {
      const url = await d.abrir(m);
      try {
        r = { ext: m.ext, ...(await probarElemento(d.crearElemento(m.tipo), url, m.tipo)) };
      } finally {
        d.soltar(url);
      }
    } catch (err) {
      r = { ext: m.ext, ok: false, motivo: `No se pudo leer la muestra: ${String(err)}` };
    }
    resultados.push(r);
    alAvanzar(r);
  }
  return resultados;
}

/** Las extensiones que quedan descartadas con estos resultados, con sus hermanas. */
export function descartadosDe(resultados: readonly ResultadoDePrueba[], muestras: readonly Muestra[] = MUESTRAS): string[] {
  const fuera = new Set<string>();
  for (const r of resultados) {
    if (r.ok) continue;
    fuera.add(r.ext);
    for (const otra of muestras.find((m) => m.ext === r.ext)?.tambien ?? []) fuera.add(otra);
  }
  return [...fuera].sort();
}

/**
 * Las de verdad: la muestra se lee entera de la propia app y se abre como
 * `blob:`, con su tipo. Así no depende de cómo sirva cada sistema los archivos
 * de la app a un elemento de medios —con rangos o sin ellos—, que no es lo que
 * se quiere probar.
 */
export const DEPENDENCIAS_REALES: Dependencias = {
  abrir: async (m) => {
    const res = await fetch(`/pruebas-de-formato/prueba.${m.ext}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = new Blob([await res.arrayBuffer()], { type: m.mime });
    return URL.createObjectURL(blob);
  },
  soltar: (url) => URL.revokeObjectURL(url),
  crearElemento: (tipo) => document.createElement(tipo) as HTMLMediaElement as ElementoDePrueba,
};
