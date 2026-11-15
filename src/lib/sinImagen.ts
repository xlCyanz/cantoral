// Si un video trae imagen de verdad.
//
// La extensión no lo dice: un `.mp4` o un `.mkv` pueden traer solo sonido —un
// himno exportado como video sin pista de imagen, una grabación del culto—. El
// escáner los marca como video por la extensión, y sin mirar dentro abrirían
// el proyector para enseñar una pantalla en negro. Esto lo mira antes de
// proyectar, leyendo solo los metadatos: en un archivo local tarda muy poco.

import { toAssetUrl } from "./api";

/** Lo que se espera antes de dejarlo estar y proyectar igual. */
const LIMITE_MS = 4000;

/**
 * `true` si trae imagen, `false` si solo sonido, y `null` si no se pudo saber
 * —el archivo no abre o tarda—. En ese caso se proyecta como siempre, y si
 * falla, lo dice la salida.
 */
export async function sondearImagen(path: string): Promise<boolean | null> {
  const url = await toAssetUrl(path);
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const terminar = (r: boolean | null) => {
      clearTimeout(reloj);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      resolve(r);
    };
    const reloj = setTimeout(() => terminar(null), LIMITE_MS);
    video.onloadedmetadata = () => terminar(video.videoWidth > 0 && video.videoHeight > 0);
    video.onerror = () => terminar(null);
    video.src = url;
    video.load();
  });
}
