import { useEffect } from "react";
import { assetUrl, isTauri, markVideoThumbnailFailed, registrar, saveVideoThumbnail, toAssetUrl } from "./api";
import { useStore } from "../store";
import { cur } from "../store/selectores";
import { enTurno } from "./turnoDeVideo";
import type { Track } from "./types";

// Las miniaturas de los videos.
//
// Un video no trae carátula incrustada, y el núcleo no sabe decodificarlo:
// meterle ffmpeg sería triplicar lo que pesa la app. Pero la webview sí sabe,
// porque es la que los reproduce. Así que el fotograma se saca aquí —el video
// en un `<video>` que nadie ve, un salto a un punto con imagen, un `<canvas>`
// y un JPEG pequeño— y el núcleo lo guarda junto a las carátulas. De ahí en
// adelante es una carátula más: se enseña igual y se borra con la pista.

/** Lo que se espera a un video antes de darlo por ilegible. */
const LIMITE_MS = 20000;
/** Respiro entre un video y el siguiente. */
const PAUSA_MS = 150;
/** Cada cuánto se mira si ya se puede seguir mientras algo suena o se proyecta. */
const ESPERA_OCUPADO_MS = 5000;
/** Un video que tarda más que esto se anota en el log aunque salga bien. */
const LENTO_MS = 4000;
/** El lado mayor de la miniatura. La carátula más grande mide 74 px. */
const LADO_PX = 320;
/** Calidad del JPEG. */
const CALIDAD = 0.8;
/** Por debajo de este brillo medio (0–255), el fotograma se da por negro. */
const OSCURO = 16;
/**
 * Cuántos videos pueden fallar seguidos, sin un solo acierto en la sesión,
 * antes de pensar que lo que falla es la plataforma y no los archivos.
 */
const FALLOS_SIN_ACIERTO = 5;

/** Lo que dejó sacar un video: la imagen, o por qué no se pudo. */
export type Captura =
  | { imagen: Uint8Array }
  | {
      imagen: null;
      motivo: string;
      /**
       * Si lo que falló no fue el archivo sino la webview —un lienzo que el
       * navegador no deja leer—. Eso fallaría igual con todos, así que no se
       * apunta en ninguno.
       */
      plataforma?: boolean;
    };

/**
 * En qué segundos buscar un fotograma con imagen.
 *
 * El primero casi nunca sirve: muchos videos abren en negro o con un
 * fundido. Se prueba hacia el 10 % —sin pasar del minuto, para no leer medio
 * archivo de una prédica de una hora— y, si sale negro, hacia el tercio.
 * Sin duración conocida, el segundo 1.
 */
export function puntosDeCaptura(dur: number): number[] {
  if (!Number.isFinite(dur) || dur <= 0) return [1];
  const tope = Math.max(0, dur - 0.1);
  const puntos = [Math.min(dur * 0.1, 60), Math.min(dur / 3, 180)].map((p) => Math.min(p, tope));
  return puntos.filter((p, i) => puntos.indexOf(p) === i);
}

/** Si un fotograma es prácticamente negro, por su brillo medio. */
export function esOscuro(pixeles: Uint8ClampedArray): boolean {
  let suma = 0;
  let n = 0;
  // Uno de cada cuatro píxeles basta para saber si hay imagen.
  for (let i = 0; i + 2 < pixeles.length; i += 16) {
    suma += 0.299 * pixeles[i] + 0.587 * pixeles[i + 1] + 0.114 * pixeles[i + 2];
    n++;
  }
  return n === 0 || suma / n < OSCURO;
}

const esDeSeguridad = (err: unknown) => err instanceof DOMException && err.name === "SecurityError";

/** Saca un fotograma de un video. Nunca suena ni entra en el transporte. */
export async function capturarMiniatura(path: string): Promise<Captura> {
  const url = await toAssetUrl(path);
  return new Promise((resolve) => {
    const video = document.createElement("video");
    // Sin esto el lienzo queda «manchado» por venir el video de otro origen
    // (`asset:`), y no se puede leer. El protocolo contesta con el origen de
    // la ventana en `Access-Control-Allow-Origin`.
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    const lienzo = document.createElement("canvas");
    let puntos: number[] = [];

    const finish = (captura: Captura) => {
      clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      resolve(captura);
    };
    const timeout = setTimeout(() => finish({ imagen: null, motivo: "timeout" }), LIMITE_MS);

    video.onloadedmetadata = () => {
      const ancho = video.videoWidth;
      const alto = video.videoHeight;
      if (!ancho || !alto) {
        finish({ imagen: null, motivo: "no video track" });
        return;
      }
      const escala = Math.min(1, LADO_PX / Math.max(ancho, alto));
      lienzo.width = Math.max(1, Math.round(ancho * escala));
      lienzo.height = Math.max(1, Math.round(alto * escala));
      puntos = puntosDeCaptura(video.duration);
      video.currentTime = puntos.shift()!;
    };
    video.onseeked = () => {
      const ctx = lienzo.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        finish({ imagen: null, motivo: "no 2d context", plataforma: true });
        return;
      }
      try {
        ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
        const negro = esOscuro(ctx.getImageData(0, 0, lienzo.width, lienzo.height).data);
        if (negro && puntos.length) {
          video.currentTime = puntos.shift()!;
          return;
        }
        // Si todos salen oscuros se guarda el último: un video de letra
        // blanca sobre fondo negro también se ve así, y esa es su imagen.
        lienzo.toBlob(
          (blob) => {
            if (!blob) {
              finish({ imagen: null, motivo: "could not encode" });
              return;
            }
            blob.arrayBuffer().then(
              (buf) => finish({ imagen: new Uint8Array(buf) }),
              (err) => finish({ imagen: null, motivo: `could not encode: ${String(err)}` }),
            );
          },
          "image/jpeg",
          CALIDAD,
        );
      } catch (err) {
        finish({ imagen: null, motivo: String(err), plataforma: esDeSeguridad(err) });
      }
    };
    video.onerror = () => finish({ imagen: null, motivo: `media error ${video.error?.code ?? "?"}` });
    video.src = url;
    video.load();
  });
}

export interface Pista {
  id: string;
  path: string;
}

/** Todo lo que la cola toca fuera de sí, para poder probarla. */
export interface Dependencias {
  capturar: (path: string) => Promise<Captura>;
  /** Guarda la imagen; devuelve su ruta, o null si la pista ya no es ese video. */
  guardar: (id: string, path: string, imagen: Uint8Array) => Promise<string | null>;
  /** La enseña en la fila sin recargar el catálogo. */
  aplicar: (id: string, path: string, ruta: string) => void;
  /** Apunta en la base que de este video no sale miniatura. */
  marcarFallo: (id: string, path: string) => Promise<void>;
  /** Si algo suena o se proyecta: entonces la cola espera. */
  ocupado: () => boolean;
  registrar: (nivel: "info" | "warn" | "error", mensaje: string) => void;
  esperar: (ms: number) => Promise<void>;
  ahora: () => number;
}

/**
 * Una cola que saca, de uno en uno, la miniatura de los videos que no tienen.
 *
 * Aprende de la de las duraciones (ver `videoDurations.ts`): cada video se
 * intenta una sola vez por sesión, lo nuevo se añade al final sin volver a
 * empezar, y nada de esto espera a nadie. Además, un video que no se deja
 * leer se apunta en la base, para no intentarlo en cada arranque, y la cola
 * se aparta mientras suena un video o hay algo en el proyector.
 *
 * Lo único que no se apunta es un fallo que no es del archivo. Si la webview
 * no deja leer el lienzo, o los primeros videos de la sesión fallan todos, lo
 * más probable es que falle la plataforma y no ellos: apuntarlos los dejaría
 * sin miniatura para siempre por algo que una actualización puede arreglar.
 * Entonces la cola para hasta el próximo arranque, que vuelve a probar con
 * esos mismos pocos.
 */
export function crearCola(d: Dependencias) {
  const vistos = new Set<string>();
  const cola: Pista[] = [];
  let trabajando = false;
  let detenida = false;
  let aciertos = 0;
  /** Fallos de antes del primer acierto: se apuntan cuando haya uno. */
  let sinApuntar: Pista[] = [];

  const apuntarFallo = async (t: Pista) => {
    try {
      await d.marcarFallo(t.id, t.path);
    } catch (err) {
      d.registrar("error", `video thumbnail: could not record failure for «${t.path}»: ${String(err)}`);
    }
  };

  const detener = (motivo: string) => {
    detenida = true;
    cola.length = 0;
    sinApuntar = [];
    d.registrar("warn", `video thumbnails: stopping for this session (${motivo})`);
  };

  async function trabajar() {
    trabajando = true;
    const inicio = d.ahora();
    let hechas = 0;
    let fallidas = 0;
    d.registrar("info", `video thumbnails: making ${cola.length} missing ones`);
    while (cola.length && !detenida) {
      // Antes de cada video, no después: la primera también espera a que la
      // ventana termine de abrir.
      await d.esperar(PAUSA_MS);
      while (d.ocupado()) await d.esperar(ESPERA_OCUPADO_MS);
      const t = cola.shift();
      if (!t) break;
      const antes = d.ahora();
      try {
        const captura = await d.capturar(t.path);
        const ms = Math.round(d.ahora() - antes);
        if (captura.imagen === null) {
          fallidas++;
          d.registrar("warn", `video thumbnail: could not make one for «${t.path}» (${captura.motivo}, ${ms} ms)`);
          if (captura.plataforma) {
            detener(`the webview refused: ${captura.motivo}`);
          } else if (aciertos > 0) {
            await apuntarFallo(t);
          } else {
            sinApuntar.push(t);
            if (sinApuntar.length >= FALLOS_SIN_ACIERTO) {
              detener(`the first ${FALLOS_SIN_ACIERTO} videos all failed`);
            }
          }
          continue;
        }
        if (ms > LENTO_MS) d.registrar("warn", `video thumbnail: «${t.path}» took ${ms} ms`);
        const ruta = await d.guardar(t.id, t.path, captura.imagen);
        if (ruta === null) {
          d.registrar("info", `video thumbnail: «${t.path}» changed meanwhile, discarded`);
          continue;
        }
        d.aplicar(t.id, t.path, ruta);
        hechas++;
        aciertos++;
        // Ya se sabe que la plataforma funciona: lo que falló antes era del
        // archivo.
        const pendientes = sinApuntar;
        sinApuntar = [];
        for (const p of pendientes) await apuntarFallo(p);
      } catch (err) {
        // Un error al guardar no es culpa del video: no se apunta, y el
        // próximo arranque lo intentará de nuevo.
        d.registrar("error", `video thumbnail failed for «${t.path}»: ${String(err)}`);
      }
    }
    const s = ((d.ahora() - inicio) / 1000).toFixed(1);
    d.registrar("info", `video thumbnails: ${hechas} made, ${fallidas} failed, in ${s}s`);
    trabajando = false;
  }

  return {
    encolar(pistas: readonly Pista[]) {
      if (detenida) return;
      for (const t of pistas) {
        const clave = `${t.id}:${t.path}`;
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        cola.push({ id: t.id, path: t.path });
      }
      if (!trabajando && cola.length) void trabajar();
    },
  };
}

/** Los videos que todavía no tienen miniatura y vale la pena intentar. */
export function sinMiniatura(tracks: readonly Track[]): Pista[] {
  return tracks
    .filter((t) => t.video && t.path && !t.missing && !t.cover && !t.miniaturaFallida)
    .map((t) => ({ id: t.id, path: t.path! }));
}

const cola = crearCola({
  capturar: (path) => enTurno(() => capturarMiniatura(path)),
  guardar: saveVideoThumbnail,
  aplicar: (id, path, ruta) =>
    useStore.setState((s) => ({
      tracks: s.tracks.map((t) => (t.id === id && t.path === path ? { ...t, cover: assetUrl(ruta) } : t)),
    })),
  marcarFallo: markVideoThumbnailFailed,
  ocupado: () => {
    const s = useStore.getState();
    return s.proyectando || (s.playing && !!cur(s)?.video);
  },
  registrar,
  esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
  ahora: () => performance.now(),
});

/**
 * Saca la miniatura de los videos que llegan con un escaneo y, una vez, de
 * los que ya estaban en la biblioteca antes de que existiera esto.
 *
 * Solo en la app: el navegador no tiene archivos que leer, y sus videos de
 * ejemplo se quedan con el glifo.
 */
export function useMiniaturasDeVideo() {
  const pending = useStore((s) => sinMiniatura(s.tracks).map((t) => `${t.id}:${t.path}`).join("\0"));

  useEffect(() => {
    if (!isTauri() || !pending) return;
    cola.encolar(sinMiniatura(useStore.getState().tracks));
  }, [pending]);
}
