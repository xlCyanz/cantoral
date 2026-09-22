// La inicial es lo único que distingue una portada de otra, así que tiene que
// salir de algo: un nombre que empieza por raya, por espacio o por emoji no
// puede dejar la carátula en blanco si en el nombre hay una letra más allá.

import { describe, expect, it } from "vitest";
import { inicialDe } from "../covers";

describe("inicialDe", () => {
  it("la primera letra, en mayúscula", () => {
    expect(inicialDe("Domingo de alabanza")).toBe("D");
    expect(inicialDe("santa cena")).toBe("S");
  });

  it("respeta los acentos y la eñe", () => {
    expect(inicialDe("Ñandutí")).toBe("Ñ");
    expect(inicialDe("única")).toBe("Ú");
  });

  it("se salta lo que no es letra ni número", () => {
    // «— Domingo» empezaría con una raya, que no dice nada.
    expect(inicialDe("— Domingo")).toBe("D");
    expect(inicialDe("  · culto")).toBe("C");
    expect(inicialDe("«Santa Cena»")).toBe("S");
  });

  it("un número sirve igual que una letra", () => {
    expect(inicialDe("25 de diciembre")).toBe("2");
  });

  it("y si no hay ninguna de las dos, la portada se queda con su degradado", () => {
    expect(inicialDe("———")).toBe("");
    expect(inicialDe("   ")).toBe("");
    expect(inicialDe("")).toBe("");
  });

  it("no parte un emoji por la mitad", () => {
    // Recorrer por code units devolvería media pareja de sustitución, que se
    // dibuja como un rombo con un signo de interrogación.
    expect(inicialDe("🎵 Alabanza")).toBe("A");
    expect(inicialDe("🎵")).toBe("");
  });
});
