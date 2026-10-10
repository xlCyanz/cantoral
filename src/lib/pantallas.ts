// La pantalla de proyección, recordada entre arranques.
//
// Lo que se recuerda no es el índice. El índice es el sitio de la pantalla en
// la lista que da el sistema, y cambia en cuanto se enchufa o se desenchufa
// otra: recordar «la 2» apuntaría el domingo siguiente a la de al lado. Se
// recuerda lo que la describe —el nombre que le da el sistema, su resolución y
// dónde empieza en el escritorio— y al usarla se busca entre las conectadas.

import type { MonitorInfo } from "./api";

/** Lo que se guarda de la pantalla elegida para proyectar. */
export interface IdentidadPantalla {
  sistema: string;
  ancho: number;
  alto: number;
  x: number;
  y: number;
}

export function identidadDe(m: MonitorInfo): IdentidadPantalla {
  return { sistema: m.sistema, ancho: m.ancho, alto: m.alto, x: m.x, y: m.y };
}

/** Si lo leído de la configuración tiene la forma de una identidad. */
export function esIdentidad(v: unknown): v is IdentidadPantalla {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  const num = (k: string) => typeof o[k] === "number" && Number.isFinite(o[k]);
  return typeof o.sistema === "string" && num("ancho") && num("alto") && num("x") && num("y");
}

/**
 * Cuál de las conectadas es la guardada, o `null` si no está.
 *
 * De más a menos seguro:
 * 1. El mismo nombre en el mismo sitio del escritorio.
 * 2. El mismo nombre, si solo una lo lleva: se cambió la disposición de las
 *    pantallas o la resolución, pero es el mismo proyector.
 * 3. El mismo sitio y la misma resolución, si solo una coincide: Windows
 *    renumera `\\.\DISPLAYn` al reconectar, y el nombre deja de servir.
 *
 * Dos que empatan no se desempatan a ciegas: es mejor caer a la de por
 * defecto, que se ve, que elegir una al azar.
 */
export function resolverPantalla(lista: readonly MonitorInfo[], g: IdentidadPantalla | null): number | null {
  if (!g) return null;
  const unica = (f: (m: MonitorInfo) => boolean) => {
    const hay = lista.filter(f);
    return hay.length === 1 ? hay[0].indice : null;
  };
  if (g.sistema) {
    const exacta = lista.find((m) => m.sistema === g.sistema && m.x === g.x && m.y === g.y);
    if (exacta) return exacta.indice;
    const porNombre = unica((m) => m.sistema === g.sistema);
    if (porNombre !== null) return porNombre;
  }
  return unica((m) => m.x === g.x && m.y === g.y && m.ancho === g.ancho && m.alto === g.alto);
}

/**
 * La de por defecto: la primera que no sea en la que está la ventana. En un
 * culto el proyector es siempre la otra. Con una sola, esa.
 */
export function pantallaPorDefecto(lista: readonly MonitorInfo[]): number {
  return (lista.find((m) => !m.principal) ?? lista[0])?.indice ?? 0;
}
