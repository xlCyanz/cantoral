// `recordar` es lo que deja que los selectores del store no recorran el
// catálogo en cada render. Vivía al final de store.ts sin pruebas propias
// (#134); estas fijan lo que el resto da por hecho.

import { describe, expect, it, vi } from "vitest";
import { recordar } from "../memo";

describe("recordar", () => {
  it("no recalcula mientras lo que lee no cambie, y devuelve el mismo valor", () => {
    const calcular = vi.fn((xs: number[]) => xs.map((x) => x * 2));
    const doble = recordar(calcular, (xs) => [xs]);
    const xs = [1, 2, 3];

    const a = doble(xs);
    const b = doble(xs);

    expect(calcular).toHaveBeenCalledTimes(1);
    // La identidad es lo que deja a React saltarse un render.
    expect(b).toBe(a);
  });

  it("recalcula cuando cambia algo de lo que lee", () => {
    const calcular = vi.fn((a: number, b: number) => a + b);
    const suma = recordar(calcular, (a, b) => [a, b]);

    expect(suma(1, 2)).toBe(3);
    expect(suma(1, 3)).toBe(4);
    expect(calcular).toHaveBeenCalledTimes(2);
  });

  it("compara por identidad, no por contenido", () => {
    const calcular = vi.fn((xs: number[]) => xs.length);
    const largo = recordar(calcular, (xs) => [xs]);

    largo([1]);
    largo([1]);

    expect(calcular).toHaveBeenCalledTimes(2);
  });

  it("guarda un solo valor: alternar entre dos entradas recalcula cada vez", () => {
    // Es la limitación que el issue apunta: basta para React, que lee una
    // instantánea por render, pero no es un caché de verdad.
    const calcular = vi.fn((x: object) => x);
    const mismo = recordar(calcular, (x) => [x]);
    const a = {};
    const b = {};

    mismo(a);
    mismo(b);
    mismo(a);

    expect(calcular).toHaveBeenCalledTimes(3);
  });

  it("NaN no invalida el valor, como `Object.is`", () => {
    const calcular = vi.fn((n: number) => String(n));
    const texto = recordar(calcular, (n) => [n]);

    texto(NaN);
    texto(NaN);

    expect(calcular).toHaveBeenCalledTimes(1);
  });
});
