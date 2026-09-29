import type { LibState, Theme, ThemeMode } from "../lib/types";
import type { CantoralState } from "./tipos";

// Parte del store (#134). Ver src/store/index.ts.
//
// Reglas pequeñas y puras que usan varios slices: qué pantalla toca a la
// biblioteca, el tema que resulta de un modo, el detalle del aviso de escaneo.

/**
 * La línea que llevan las confirmaciones de quitar una carpeta, restaurar y
 * fusionar: el núcleo guarda una copia antes de cada una (#143), y quien
 * confirma tiene que saber que hay vuelta atrás y dónde está.
 */
export const AVISO_COPIA_AUTOMATICA =
  "Antes de hacerlo se guarda una copia automática; podrás volver atrás desde Configuración.";

/**
 * El detalle del aviso de escaneo, o nada.
 *
 * Debajo del «Biblioteca actualizada» y no pegado a él: son la misma noticia
 * —esto entró, esto no— pero el titular es que la biblioteca ya está, y lo
 * que se quedó fuera es la letra pequeña.
 */
export function detalleDeOmitidos(n: number): string | undefined {
  if (n <= 0) return undefined;
  return n === 1
    ? "1 archivo se quedó fuera: Cantoral no reproduce su formato."
    : `${n} archivos se quedaron fuera: Cantoral no reproduce su formato.`;
}

/**
 * En qué estado dejar la biblioteca al volver a ella desde un filtro.
 *
 * Sirve para salir de la pantalla de error sin tener que volver a escanear.
 * Se mira el catálogo en vez de poner «content» a secas: sobre una biblioteca
 * sin nada indexado, «content» enseñaría una tabla vacía en lugar de la
 * pantalla que explica cómo empezar.
 */
export function estadoDeLaBiblioteca(s: CantoralState): LibState {
  return s.tracks.length ? "content" : "empty";
}

/**
 * El tema del sistema según el webview, que no siempre acierta.
 *
 * Se usa para pintar algo en el primer fotograma, antes de que conteste la
 * ventana nativa. En macOS suele ser correcto; en Windows, WebView2 resuelve
 * `prefers-color-scheme` contra el tema de la ventana y devuelve claro hasta
 * que alguien le dice otra cosa — por eso `seguirAlSistema` pregunta después
 * a la ventana y corrige.
 */
export function osPrefersDark(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * El tema efectivo de un modo, con lo que se sepa del sistema.
 *
 * `delSistema` es lo que contestó la ventana nativa, que manda sobre el
 * webview; `null` mientras no haya contestado o en el modo navegador.
 */
export function resolveTheme(mode: ThemeMode, delSistema: Theme | null = null): Theme {
  if (mode !== "system") return mode;
  return delSistema ?? (osPrefersDark() ? "dark" : "light");
}
