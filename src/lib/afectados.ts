// Qué se lleva por delante quitar unas pistas de la biblioteca.
//
// Un número —«3 están en alguna lista»— no basta para decidir. Lo que decide
// es *cuáles*: quitar una pista que está en el culto del domingo que viene no
// es lo mismo que quitar una que está en una plantilla de hace un año, y esa
// diferencia solo se ve con los nombres delante.

import type { Playlist } from "./types";

/**
 * Los cultos que pierden alguna de estas pistas, escrito para leerlo.
 *
 * Cadena vacía cuando no hay ninguno, para que quien lo use pueda saltarse la
 * frase entera en vez de decir «y de 0 cultos».
 *
 * Se nombran hasta tres. Con más, la lista sería más larga que el aviso y
 * dejaría de leerse; el número sigue estando.
 */
export function cultosAfectados(
  ids: readonly string[],
  playlists: readonly Playlist[],
  plOrder: Readonly<Record<string, string[]>>,
): string {
  const quitadas = new Set(ids);
  const nombres = playlists
    .filter((p) => (plOrder[p.id] || []).some((id) => quitadas.has(id)))
    .map((p) => p.nombre);
  if (nombres.length === 0) return "";

  const cuantos = `${nombres.length} ${nombres.length === 1 ? "culto" : "cultos"}`;
  const muestra = nombres.slice(0, 3).join(", ");
  return nombres.length > 3 ? `${cuantos} (${muestra} y ${nombres.length - 3} más)` : `${cuantos} (${muestra})`;
}
