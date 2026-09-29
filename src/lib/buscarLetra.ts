// Buscar por la letra de las canciones (#144).
//
// En la app, la búsqueda la hace el núcleo con FTS5. Aquí vive lo que el
// frontend necesita saber de ella —desde cuántas letras se pregunta— y la
// versión en memoria que usa el navegador, con las mismas reglas: sin
// mayúsculas, sin tildes, todas las palabras en cualquier orden, y los
// acordes fuera.

import type { LyricHit, Sheet } from "./api";

/**
 * Desde cuántas letras escritas se busca también en las hojas.
 *
 * Con una o dos, casi todas las canciones contienen «la» o «mi», y la tabla se
 * llenaría de coincidencias que no dicen nada.
 */
export const MIN_BUSQUEDA_LETRA = 3;

/** Lo que tarda en preguntarse al núcleo tras la última tecla. */
export const ESPERA_BUSQUEDA_LETRA_MS = 250;

/** Lo que llega al fragmento como mucho, para una fila de una línea. */
const LARGO_FRAGMENTO = 80;

/** Minúsculas y sin tildes: «Señor» y «senor» se leen igual. */
export function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Las palabras de lo escrito, como las ve FTS5: sin signos ni comillas. */
export function palabrasDe(consulta: string): string[] {
  return sinTildes(consulta)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Si lo escrito es bastante para buscarlo también en las hojas. */
export function buscaEnLetras(consulta: string): boolean {
  return consulta.trim().length >= MIN_BUSQUEDA_LETRA && palabrasDe(consulta).length > 0;
}

const quitarAcordes = (texto: string) => texto.replace(/\[[^\]]*\]/g, "");

/**
 * El verso de una hoja donde aparece lo buscado, o null si no aparece.
 *
 * Todas las palabras tienen que estar en la hoja, en cualquier orden. El
 * fragmento es la línea donde aparece la primera: la letra si la hay, y si no
 * la línea de acordes sin los acordes.
 */
export function coincidenciaEnHoja(hoja: Sheet, consulta: string): string | null {
  const palabras = palabrasDe(consulta);
  if (palabras.length === 0) return null;
  const lineas = [...hoja.letra.split("\n"), ...quitarAcordes(hoja.acordes).split("\n")];
  const todo = sinTildes(lineas.join("\n"));
  if (!palabras.every((p) => todo.includes(p))) return null;
  const linea = lineas.find((l) => sinTildes(l).includes(palabras[0])) ?? "";
  const verso = linea.split(/\s+/).filter(Boolean).join(" ");
  return verso.length > LARGO_FRAGMENTO ? verso.slice(0, LARGO_FRAGMENTO - 1).trimEnd() + "…" : verso;
}

/** La búsqueda del núcleo, sobre unas hojas en memoria. */
export function buscarEnHojas(hojas: Iterable<Sheet>, consulta: string): LyricHit[] {
  const hits: LyricHit[] = [];
  for (const hoja of hojas) {
    const fragmento = coincidenciaEnHoja(hoja, consulta);
    if (fragmento !== null) hits.push({ trackId: hoja.trackId, fragmento });
  }
  return hits;
}
