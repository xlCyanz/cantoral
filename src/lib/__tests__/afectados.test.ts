// Antes de quitar pistas de la biblioteca hay que poder ver qué cultos se
// quedan sin ellas. Lo que se fija aquí es que se nombren los que pierden algo
// y solo esos, que ninguno salga dos veces, y que una lista larga no se coma
// el aviso entero.

import { describe, expect, it } from "vitest";
import { cultosAfectados } from "../afectados";
import type { Playlist } from "../types";

function culto(id: string, nombre: string): Playlist {
  return { id, nombre, fecha: "", ocasion: "", ids: [], plantilla: false };
}

const DOMINGO = culto("p1", "Domingo de alabanza");
const JOVENES = culto("p2", "Reunión de jóvenes");
const CENA = culto("p3", "Santa Cena");
const ENSAYO = culto("p4", "Ensayo del Coro");

describe("cultosAfectados", () => {
  it("nombra los que pierden alguna de las pistas", () => {
    const texto = cultosAfectados(["a", "b"], [DOMINGO, JOVENES], { p1: ["a"], p2: ["b"] });

    expect(texto).toBe("2 cultos (Domingo de alabanza, Reunión de jóvenes)");
  });

  it("y deja fuera el que no pierde nada", () => {
    const texto = cultosAfectados(["a"], [DOMINGO, JOVENES], { p1: ["a"], p2: ["z"] });

    expect(texto).toBe("1 culto (Domingo de alabanza)");
  });

  it("uno solo va en singular", () => {
    expect(cultosAfectados(["a"], [DOMINGO], { p1: ["a"] })).toContain("1 culto (");
  });

  it("un culto con varias de las pistas se nombra una vez", () => {
    // Contando apariciones salía un número mayor que la propia selección.
    const texto = cultosAfectados(["a", "b", "c"], [DOMINGO], { p1: ["a", "b", "c"] });

    expect(texto).toBe("1 culto (Domingo de alabanza)");
  });

  it("con más de tres, se nombran tres y se dice cuántos quedan", () => {
    // La lista completa sería más larga que el aviso y dejaría de leerse; el
    // número sigue estando.
    const texto = cultosAfectados(["a"], [DOMINGO, JOVENES, CENA, ENSAYO], {
      p1: ["a"],
      p2: ["a"],
      p3: ["a"],
      p4: ["a"],
    });

    expect(texto).toBe("4 cultos (Domingo de alabanza, Reunión de jóvenes, Santa Cena y 1 más)");
  });

  it("con exactamente tres no se dice «y 0 más»", () => {
    const texto = cultosAfectados(["a"], [DOMINGO, JOVENES, CENA], { p1: ["a"], p2: ["a"], p3: ["a"] });

    expect(texto).not.toContain("más");
    expect(texto).toContain("3 cultos");
  });

  it("sin ningún culto afectado no dice nada", () => {
    // Cadena vacía y no «0 cultos», para que quien lo use pueda saltarse la
    // frase entera.
    expect(cultosAfectados(["a"], [DOMINGO], { p1: ["z"] })).toBe("");
    expect(cultosAfectados([], [DOMINGO], { p1: ["a"] })).toBe("");
    expect(cultosAfectados(["a"], [], {})).toBe("");
  });

  it("un culto sin orden guardado no estorba", () => {
    expect(cultosAfectados(["a"], [DOMINGO, JOVENES], { p1: ["a"] })).toBe("1 culto (Domingo de alabanza)");
  });
});
