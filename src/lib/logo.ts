// Which drawing of the symbol goes at which size. Lives here rather than in
// Logo.tsx so that file only exports components (fast refresh).

import simboloCompleto from "../assets/logo/symbol-indigo.svg";
import simbolo32 from "../assets/logo/symbol-small-32.svg";
import simbolo16 from "../assets/logo/symbol-small-16.svg";

/**
 * Qué dibujo corresponde a cada tamaño, según el manual: por debajo de 40 px
 * la versión de tres líneas y trazo más grueso, y a menos de 20 px la de dos
 * líneas y sin nota — a ese tamaño la corchea es una mancha.
 */
export function dibujoPara(ancho: number): string {
  if (ancho < 20) return simbolo16;
  if (ancho < 40) return simbolo32;
  return simboloCompleto;
}
