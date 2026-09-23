// Por el proyector va un trozo de letra cada vez, y el trozo es la estrofa.
// Lo que se fija aquí es que se parta donde el autor de la hoja ya puso las
// separaciones, que no se inventen otras, que los acordes no lleguen a la
// pantalla, y que una hoja escrita de corrido no acabe en una pantalla de
// veinte líneas ilegible desde la última fila.

import { describe, expect, it } from "vitest";
import { estrofasDe } from "../estrofas";

describe("estrofasDe", () => {
  it("parte por las líneas en blanco", () => {
    const letra = "Sublime gracia del Señor\nque a un pecador salvó\n\nFui ciego mas hoy veo yo\nperdido y él me halló";

    const e = estrofasDe(letra, "");

    expect(e).toHaveLength(2);
    expect(e[0].lineas).toEqual(["Sublime gracia del Señor", "que a un pecador salvó"]);
    expect(e[1].lineas).toEqual(["Fui ciego mas hoy veo yo", "perdido y él me halló"]);
  });

  it("varias líneas en blanco seguidas no hacen estrofas vacías", () => {
    const e = estrofasDe("Una\n\n\n\nDos", "");

    expect(e).toHaveLength(2);
  });

  it("una hoja de corrido es una sola estrofa", () => {
    // No se inventan separaciones: si el autor no puso ninguna, no hay
    // ninguna que respetar.
    expect(estrofasDe("Una\nDos\nTres", "")).toHaveLength(1);
  });

  it("y una hoja vacía no da nada", () => {
    expect(estrofasDe("", "")).toEqual([]);
    expect(estrofasDe(undefined, undefined)).toEqual([]);
    expect(estrofasDe("   \n\n  ", "")).toEqual([]);
  });
});

describe("desde una hoja con acordes", () => {
  it("los acordes no llegan a la pantalla", () => {
    // Por el proyector va lo que canta la congregación. Los acordes son para
    // quien toca, y para eso está el modo culto en el atril.
    const acordes = "[Sol]Sublime [Do]gracia del [Re]Señor";

    const e = estrofasDe("", acordes);

    expect(e[0].lineas).toEqual(["Sublime gracia del Señor"]);
  });

  it("un encabezado de sección empieza estrofa y se queda como etiqueta", () => {
    const acordes = "[Sol]Verso uno\n{coro}\n[Do]Cantad al Señor";

    const e = estrofasDe("", acordes);

    expect(e).toHaveLength(2);
    expect(e[0].etiqueta).toBe("");
    expect(e[1].etiqueta.toLowerCase()).toContain("coro");
    expect(e[1].lineas).toEqual(["Cantad al Señor"]);
  });

  it("el encabezado parte aunque no venga precedido de un hueco", () => {
    expect(estrofasDe("", "Verso\n{comment: Puente}\nPuente aquí")).toHaveLength(2);
  });

  it("la hoja con acordes manda sobre la letra sola cuando existen las dos", () => {
    // La misma precedencia que el modo culto: la hoja en ChordPro es la que se
    // mantiene, y es la única que lleva los encabezados de sección con los que
    // se parte. Que las dos vistas eligieran distinto sería que la letra del
    // atril y la del proyector no coincidieran.
    const e = estrofasDe("Letra suelta", "[Sol]La hoja buena");

    expect(e[0].lineas).toEqual(["La hoja buena"]);
  });

  it("y la letra sola se usa cuando no hay hoja con acordes", () => {
    expect(estrofasDe("Letra suelta", "")[0].lineas).toEqual(["Letra suelta"]);
  });

  it("y si solo hay acordes, se usan esos", () => {
    const e = estrofasDe("", "[Sol]Solo acordes");

    expect(e[0].lineas).toEqual(["Solo acordes"]);
  });
});

describe("una estrofa demasiado larga", () => {
  it("se parte para que se pueda leer desde el fondo", () => {
    // Sin tope, una hoja escrita sin líneas en blanco saldría entera en una
    // pantalla, en un tamaño que no se lee desde la última fila.
    const largo = Array.from({ length: 20 }, (_, i) => `Línea ${i + 1}`).join("\n");

    const e = estrofasDe(largo, "");

    expect(e.length).toBeGreaterThan(1);
    for (const trozo of e) expect(trozo.lineas.length).toBeLessThanOrEqual(8);
    // Y no se pierde ni se repite ninguna línea por el camino.
    expect(e.flatMap((t) => t.lineas)).toEqual(largo.split("\n"));
  });

  it("y el trozo que sigue conserva el encabezado", () => {
    // En la pantalla tiene que seguir poniendo «Coro» mientras se canta el coro.
    const acordes = "{coro}\n" + Array.from({ length: 12 }, (_, i) => `Línea ${i + 1}`).join("\n");

    const e = estrofasDe("", acordes);

    expect(e).toHaveLength(2);
    expect(e[0].etiqueta).toBe(e[1].etiqueta);
    expect(e[1].etiqueta.toLowerCase()).toContain("coro");
  });

  it("una estrofa de exactamente el tope no deja un trozo vacío detrás", () => {
    const e = estrofasDe(Array.from({ length: 8 }, (_, i) => `L${i}`).join("\n"), "");

    expect(e).toHaveLength(1);
  });
});
