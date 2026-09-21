// Un clic con modificadores es lo único de la selección que tiene reglas, y
// equivocarse ahí no da error: da una acción en bloque sobre pistas que el
// usuario no creía tener elegidas.

import { describe, expect, it } from "vitest";
import { alHacerClic, enOrden, rango, vigentes } from "../selection";

const VISIBLES = ["a", "b", "c", "d", "e"];

describe("rango", () => {
  it("toma el tramo entre dos filas, con las dos incluidas", () => {
    expect(rango(VISIBLES, "b", "d")).toEqual(["b", "c", "d"]);
  });

  it("da igual hacia dónde se arrastre", () => {
    expect(rango(VISIBLES, "d", "b")).toEqual(["b", "c", "d"]);
  });

  it("una fila consigo misma es esa fila", () => {
    expect(rango(VISIBLES, "c", "c")).toEqual(["c"]);
  });

  it("si el ancla ya no está en pantalla, se queda con la fila pulsada", () => {
    expect(rango(VISIBLES, "fantasma", "c")).toEqual(["c"]);
  });
});

describe("alHacerClic", () => {
  it("un clic normal reemplaza la selección y abre el detalle", () => {
    const r = alHacerClic(VISIBLES, ["a", "b"], "a", "d");

    expect(r.seleccion).toEqual(["d"]);
    expect(r.ancla).toBe("d");
    expect(r.abrirDetalle).toBe(true);
  });

  it("⌘/Ctrl suma sin abrir el detalle", () => {
    // Extender una selección va sobre el conjunto; que el panel siguiera a la
    // última fila tocada pelearía con lo que el usuario está haciendo.
    const r = alHacerClic(VISIBLES, ["a"], "a", "c", { meta: true });

    expect(r.seleccion).toEqual(["a", "c"]);
    expect(r.abrirDetalle).toBe(false);
  });

  it("⌘/Ctrl sobre una ya elegida la quita", () => {
    const r = alHacerClic(VISIBLES, ["a", "c"], "c", "a", { meta: true });

    expect(r.seleccion).toEqual(["c"]);
  });

  it("quitar una fila no mueve el ancla a ella", () => {
    // Ya no está en la selección; medir un rango desde ahí sería raro.
    const r = alHacerClic(VISIBLES, ["a", "c"], "a", "c", { meta: true });

    expect(r.ancla).toBe("a");
  });

  it("Mayús toma el tramo desde el ancla", () => {
    const r = alHacerClic(VISIBLES, ["b"], "b", "d", { shift: true });

    expect(r.seleccion).toEqual(["b", "c", "d"]);
    expect(r.ancla).toBe("b");
  });

  it("el ancla no se mueve entre Mayús sucesivos", () => {
    // Así se puede agrandar y encoger el tramo sin perder el punto de partida.
    const uno = alHacerClic(VISIBLES, ["b"], "b", "e", { shift: true });
    const dos = alHacerClic(VISIBLES, uno.seleccion, uno.ancla, "c", { shift: true });

    expect(uno.seleccion).toEqual(["b", "c", "d", "e"]);
    expect(dos.seleccion).toEqual(["b", "c"]);
    expect(dos.ancla).toBe("b");
  });

  it("Mayús sin ancla se comporta como un clic normal", () => {
    const r = alHacerClic(VISIBLES, [], null, "c", { shift: true });

    expect(r.seleccion).toEqual(["c"]);
    expect(r.ancla).toBe("c");
  });

  it("Mayús reemplaza el tramo, no lo suma al anterior", () => {
    const r = alHacerClic(VISIBLES, ["a", "e"], "b", "d", { shift: true });

    expect(r.seleccion).toEqual(["b", "c", "d"]);
  });
});

describe("enOrden", () => {
  it("devuelve lo elegido en el orden de la pantalla, no el de los clics", () => {
    // Agregar a una lista para culto tiene que respetar el orden que se ve.
    expect(enOrden(VISIBLES, ["d", "a", "c"])).toEqual(["a", "c", "d"]);
  });

  it("ignora lo que ya no se muestra", () => {
    expect(enOrden(VISIBLES, ["a", "fantasma"])).toEqual(["a"]);
  });
});

describe("vigentes", () => {
  it("suelta lo que dejó de estar en pantalla", () => {
    // Una selección que sobrevive a sus filas es una acción en bloque a punto
    // de tocar pistas que el usuario ya no ve.
    expect(vigentes(["a", "c"], ["a", "b", "c"])).toEqual(["a", "c"]);
  });

  it("no inventa nada cuando todo sigue", () => {
    expect(vigentes(VISIBLES, ["b", "d"])).toEqual(["b", "d"]);
  });

  it("se queda vacía si no queda nada", () => {
    expect(vigentes([], ["a", "b"])).toEqual([]);
  });
});
