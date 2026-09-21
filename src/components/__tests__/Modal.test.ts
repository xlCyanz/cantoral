// `aria-modal="true"` le promete al lector de pantalla que lo de detrás está
// inerte. Quien cumple esa promesa es este cálculo: decidir cuándo Tab tiene
// que dar la vuelta en lugar de salirse del diálogo.

import { describe, expect, it } from "vitest";
import { siguienteFoco } from "../Modal";

/** Sentinels: the function only ever compares identity and position. */
const a = {} as HTMLElement;
const b = {} as HTMLElement;
const c = {} as HTMLElement;
const fuera = {} as HTMLElement;

describe("siguienteFoco", () => {
  it("deja pasar el Tab del navegador en medio del diálogo", () => {
    // Null significa «no hagas nada»: mover el foco a mano en cada Tab sería
    // reimplementar el orden de tabulación, que el navegador ya sabe.
    expect(siguienteFoco([a, b, c], b, false)).toBeNull();
    expect(siguienteFoco([a, b, c], b, true)).toBeNull();
  });

  it("da la vuelta al llegar al último control", () => {
    expect(siguienteFoco([a, b, c], c, false)).toBe(a);
  });

  it("y hacia atrás desde el primero", () => {
    expect(siguienteFoco([a, b, c], a, true)).toBe(c);
  });

  it("devuelve el foco al diálogo si se había escapado", () => {
    // Pasa si algo de fuera se enfocó por su cuenta; el Tab siguiente vuelve a
    // entrar en vez de seguir paseando por la página tapada.
    expect(siguienteFoco([a, b, c], fuera, false)).toBe(a);
    expect(siguienteFoco([a, b, c], fuera, true)).toBe(c);
    expect(siguienteFoco([a, b, c], null, false)).toBe(a);
  });

  it("no se atasca con un solo control", () => {
    expect(siguienteFoco([a], a, false)).toBe(a);
    expect(siguienteFoco([a], a, true)).toBe(a);
  });

  it("no hace nada en un diálogo sin nada que enfocar", () => {
    expect(siguienteFoco([], null, false)).toBeNull();
  });
});
