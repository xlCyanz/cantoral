// Lo que cada fila de la biblioteca, la barra lateral y el diálogo «Agregar
// canciones» preguntan en cada cambio del store se calcula una vez por
// catálogo (o por selección), no una vez por fila y por cambio.

import { describe, expect, it, vi } from "vitest";
import { cuentasDePistas, seleccionComoConjunto } from "../../store/selectores";
import { buscarCanciones } from "../elegirCanciones";
import type { Track } from "../types";

function pista(id: string, titulo: string, over: Partial<Track> = {}): Track {
  return { id, titulo, artista: "", album: "", dur: "3:00", durSec: 180, formato: "MP3", carpeta: "", fav: false, missing: false, added: 0, path: `/m/${id}.mp3`, ...over };
}

describe("la selección como conjunto", () => {
  it("es el mismo conjunto mientras la selección no cambie", () => {
    const seleccion = ["1", "2"];
    const a = seleccionComoConjunto(seleccion);

    expect(seleccionComoConjunto(seleccion)).toBe(a);
    expect(a.has("2")).toBe(true);
    expect(a.has("3")).toBe(false);
    expect(seleccionComoConjunto(["3"]).has("3")).toBe(true);
  });
});

describe("las cuentas de la barra lateral", () => {
  it("cuenta favoritas y sin archivo una vez por catálogo", () => {
    const tracks = [pista("1", "A", { fav: true }), pista("2", "B", { missing: true }), pista("3", "C", { fav: true })];

    const a = cuentasDePistas(tracks);
    expect(a).toEqual({ total: 3, favoritas: 2, faltan: 1 });
    expect(cuentasDePistas(tracks)).toBe(a);
  });
});

describe("buscar en «Agregar canciones»", () => {
  it("ordena una vez por catálogo y filtra sobre lo ordenado", () => {
    const tracks = [pista("1", "Santo"), pista("2", "Al que está sentado"), pista("3", "Grande es el Señor")];
    const ordenar = vi.spyOn(Array.prototype, "sort");

    const todas = buscarCanciones(tracks, "");
    buscarCanciones(tracks, "s");
    buscarCanciones(tracks, "sa");
    buscarCanciones(tracks, "san");

    expect(ordenar).toHaveBeenCalledTimes(1);
    ordenar.mockRestore();
    expect(todas.map((t) => t.id)).toEqual(["2", "3", "1"]);
    expect(buscarCanciones(tracks, "")).toBe(todas);
    expect(buscarCanciones(tracks, "san").map((t) => t.id)).toEqual(["1"]);
  });
});
