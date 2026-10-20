// Al maximizar o restaurar en Windows el contenido se asienta en un momento,
// en vez de saltar de golpe al tamaño nuevo. Lo que se fija aquí es cuándo:
// solo en un cambio de verdad, nunca en macOS (que ya lo anima el sistema), y
// sin dejar puesta la clase que descolocaría lo que va `position: fixed`.

import { afterEach, describe, expect, it, vi } from "vitest";
import { CLASE_ASENTANDO, animaAlMaximizar, asentarLaVentana } from "../ventana";

/** Lo justo de un elemento: sus clases y un `offsetWidth` que leer. */
function raiz() {
  const clases = new Set<string>();
  const anadidas: string[] = [];
  return {
    offsetWidth: 1200,
    classList: {
      add: (c: string) => {
        clases.add(c);
        anadidas.push(c);
      },
      remove: (c: string) => void clases.delete(c),
      contains: (c: string) => clases.has(c),
    },
    anadidas,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("cuándo se anima", () => {
  it("al maximizar y al restaurar", () => {
    expect(animaAlMaximizar(false, true, false)).toBe(true);
    expect(animaAlMaximizar(true, false, false)).toBe(true);
  });

  it("no la primera vez que se sabe el estado, ni en un resize que no lo cambia", () => {
    expect(animaAlMaximizar(null, true, false)).toBe(false);
    expect(animaAlMaximizar(null, false, false)).toBe(false);
    expect(animaAlMaximizar(true, true, false)).toBe(false);
    expect(animaAlMaximizar(false, false, false)).toBe(false);
  });

  it("nunca en macOS, donde el zoom de la ventana ya lo anima el sistema", () => {
    expect(animaAlMaximizar(false, true, true)).toBe(false);
    expect(animaAlMaximizar(true, false, true)).toBe(false);
  });
});

describe("asentar la ventana", () => {
  it("pone la clase y la quita al terminar", () => {
    vi.useFakeTimers();
    const r = raiz();
    asentarLaVentana(r as unknown as HTMLElement);
    expect(r.classList.contains(CLASE_ASENTANDO)).toBe(true);
    vi.advanceTimersByTime(400);
    expect(r.classList.contains(CLASE_ASENTANDO)).toBe(false);
  });

  it("dos cambios seguidos vuelven a empezar y la quitan una sola vez, al final", () => {
    vi.useFakeTimers();
    const r = raiz();
    asentarLaVentana(r as unknown as HTMLElement);
    vi.advanceTimersByTime(150);
    asentarLaVentana(r as unknown as HTMLElement);
    expect(r.anadidas).toHaveLength(2);
    vi.advanceTimersByTime(150);
    // El primer temporizador ya no la quita a mitad del segundo.
    expect(r.classList.contains(CLASE_ASENTANDO)).toBe(true);
    vi.advanceTimersByTime(300);
    expect(r.classList.contains(CLASE_ASENTANDO)).toBe(false);
  });

  it("sin raíz no hace nada", () => {
    expect(() => asentarLaVentana(null)).not.toThrow();
  });
});
