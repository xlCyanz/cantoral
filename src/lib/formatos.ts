// Qué puede reproducir Cantoral, y qué no.
//
// La biblioteca indexa más formatos de los que un webview sabe decodificar.
// Mientras eso solo afectaba al reproductor de escritorio se notaba poco —una
// pista que no suena se salta—, pero proyectando es otra cosa: un archivo que
// el motor no entiende deja la pantalla grande en negro delante de la
// congregación, sin decir por qué.
//
// La verdad sobre si un archivo se puede reproducir la tiene el elemento
// `<video>` cuando falla, y esa es la que manda: la salida devuelve el error
// real y la cola lo muestra en el elemento que lo dio. Lo de aquí es lo que se
// puede decir *antes* de intentarlo, y solo cubre los contenedores que no
// decodifica ningún motor, en ninguna plataforma.
//
// Deliberadamente corto. `mov`, `ogg`, `opus`, `aiff` y `flac` dependen del
// motor —WKWebView en macOS y WebView2 en Windows no coinciden— y marcarlos
// aquí sería decirle a quien opera en Windows que su `.mov` no se proyecta
// cuando sí lo hace. Esos se dejan intentar y, si fallan, el fallo se ve.

/**
 * Autoplay bloqueado por el sistema.
 *
 * No es un código de `MediaError` —esos empiezan en 1— y por eso es negativo:
 * viaja por el mismo campo sin poder confundirse con uno real.
 */
export const ERROR_AUTOPLAY = -1;

/** Contenedores que no decodifica ningún motor de webview. */
const SIN_SOPORTE: Record<string, string> = {
  mkv: "Matroska (.mkv)",
  avi: "AVI (.avi)",
  wmv: "Windows Media (.wmv)",
  wma: "Windows Media Audio (.wma)",
};

/** La extensión en minúsculas, sin punto. Cadena vacía si no tiene. */
export function extensionDe(ruta: string | undefined | null): string {
  const limpio = (ruta ?? "").split(/[?#]/)[0];
  const base = limpio.slice(Math.max(limpio.lastIndexOf("/"), limpio.lastIndexOf("\\")) + 1);
  const punto = base.lastIndexOf(".");
  // `punto <= 0` deja fuera los archivos que empiezan por punto y no tienen
  // extensión: «.gitignore» no es un archivo de extensión «gitignore».
  return punto <= 0 ? "" : base.slice(punto + 1).toLowerCase();
}

/**
 * Por qué este archivo no se va a poder reproducir, si se sabe de antemano.
 *
 * `null` no promete que funcione: promete que no hay motivo conocido para que
 * no lo haga. Lo que falle por el códec de dentro del contenedor lo dirá la
 * salida al intentarlo.
 */
export function avisoDeFormato(ruta: string | undefined | null): string | null {
  const nombre = SIN_SOPORTE[extensionDe(ruta)];
  return nombre ? `${nombre} no se puede reproducir` : null;
}

/**
 * Lo que se le enseña a quien opera cuando la salida devuelve un error.
 *
 * Los códigos son los de `MediaError`. Se traducen porque «MEDIA_ERR_DECODE»
 * no le dice nada a quien está a punto de empezar un culto, y porque cada uno
 * lleva a una acción distinta: un archivo que no está se reapunta, un formato
 * que no se decodifica se convierte.
 */
export function motivoDeError(codigo: number | undefined, ruta?: string): string {
  const ext = extensionDe(ruta);
  const marca = ext ? ` (.${ext})` : "";
  switch (codigo) {
    case 1: // MEDIA_ERR_ABORTED
      return "La carga se interrumpió";
    case 2: // MEDIA_ERR_NETWORK
      return "No se pudo leer el archivo";
    case 3: // MEDIA_ERR_DECODE
      return `El archivo está dañado o usa un códec que no se puede abrir${marca}`;
    case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
      return `Este sistema no reproduce este formato${marca}`;
    case ERROR_AUTOPLAY:
      return "El sistema no dejó arrancar la reproducción";
    default:
      return "No se pudo reproducir";
  }
}

/**
 * Por qué esta pista no se va a poder reproducir, si se sabe de antemano.
 *
 * Los tres motivos que se pueden saber sin tocar el archivo: que no se haya
 * indexado con ruta, que la ruta ya no exista, y que el contenedor no lo
 * decodifique ningún motor. Lo demás —un códec raro dentro de un `.mp4`—
 * aparece al intentarlo.
 */
export function motivoNoProyectable(t: { path?: string; missing?: boolean }): string | null {
  if (!t.path) return "Sin archivo";
  if (t.missing) return "Falta el archivo";
  return avisoDeFormato(t.path);
}
