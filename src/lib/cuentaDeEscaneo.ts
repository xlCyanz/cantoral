// Cuántos archivos lleva un escaneo, dicho para leerlo.
//
// El porcentaje solo no deja decidir si esperar: «4 %» de una carpeta de
// cuarenta canciones es nada, y de una de cuatro mil es un buen rato (#139).

/** «120 de 3.400 archivos», o nada mientras el recorrido no ha contado. */
export function cuentaDeEscaneo(hechos: number, total: number): string {
  if (total <= 0) return "";
  const n = (x: number) => x.toLocaleString("es");
  return `${n(Math.min(hechos, total))} de ${n(total)} ${total === 1 ? "archivo" : "archivos"}`;
}
