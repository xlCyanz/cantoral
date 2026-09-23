// El manual de marca pide un dibujo distinto según el tamaño al que se ve el
// símbolo. Lo que se fija aquí son los cortes: el de la barra de título, a
// 20 px, tiene que ser la versión de tres líneas, que es la que el manual
// nombra para ese sitio.

import { describe, expect, it } from "vitest";
import { dibujoPara } from "../../components/Logo";

describe("qué dibujo del símbolo va a cada tamaño", () => {
  it("por debajo de 20 px, dos líneas y sin nota", () => {
    expect(dibujoPara(16)).toContain("symbol-small-16");
    expect(dibujoPara(19.9)).toContain("symbol-small-16");
  });

  it("de 20 a 40 px, la de tres líneas: la de la barra de título", () => {
    expect(dibujoPara(20)).toContain("symbol-small-32");
    expect(dibujoPara(20.9)).toContain("symbol-small-32");
    expect(dibujoPara(39.9)).toContain("symbol-small-32");
  });

  it("de 40 px para arriba, el completo", () => {
    expect(dibujoPara(40)).toContain("symbol-indigo");
    expect(dibujoPara(64)).toContain("symbol-indigo");
  });
});
