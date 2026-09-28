import { describe, expect, it } from "vitest";
import { cuentaDeEscaneo } from "../cuentaDeEscaneo";

describe("cuentaDeEscaneo", () => {
  it("dice cuántos lleva de cuántos", () => {
    expect(cuentaDeEscaneo(120, 340)).toBe("120 de 340 archivos");
  });

  it("agrupa los miles como se leen en español", () => {
    expect(cuentaDeEscaneo(1200, 12000)).toBe(`${(1200).toLocaleString("es")} de ${(12000).toLocaleString("es")} archivos`);
  });

  it("en singular con uno solo", () => {
    expect(cuentaDeEscaneo(1, 1)).toBe("1 de 1 archivo");
  });

  it("no dice nada mientras el recorrido no ha contado", () => {
    expect(cuentaDeEscaneo(0, 0)).toBe("");
  });

  it("nunca dice más hechos que archivos", () => {
    expect(cuentaDeEscaneo(50, 40)).toBe("40 de 40 archivos");
  });
});
