// Leer mal una hoja no da un error: da una hoja que alguien toca el domingo por
// la mañana delante de la congregación. Por eso esto se prueba trozo a trozo, y
// por eso lo que no se entiende se deja intacto en vez de adivinado.

import { describe, expect, it } from "vitest";
import { esAcorde, parseHoja } from "../chords";

describe("esAcorde", () => {
  it("reconoce la nota con su alteración y lo que venga detrás", () => {
    expect(esAcorde("Do")).toBe(true);
    expect(esAcorde("Rem")).toBe(true);
    expect(esAcorde("Fa#m7")).toBe(true);
    expect(esAcorde("Sib")).toBe(true);
    expect(esAcorde("Solsus4")).toBe(true);
  });

  it("lee los nombres largos enteros", () => {
    // «Sol» no puede leerse como «So» y sobrar una ele, y «Si» y «Sib» son
    // notas distintas.
    expect(esAcorde("Sol")).toBe(true);
    expect(esAcorde("Si")).toBe(true);
    expect(esAcorde("Solb")).toBe(true);
  });

  it("acepta un acorde con bajo", () => {
    expect(esAcorde("Sol/Si")).toBe(true);
    expect(esAcorde("Do/Mi")).toBe(true);
    // El bajo no se comprueba: la raíz es lo que lo hace acorde.
    expect(esAcorde("Do/loquesea")).toBe(true);
  });

  it("y dice que no a lo que no es un acorde", () => {
    expect(esAcorde("x2")).toBe(false);
    expect(esAcorde("Coro")).toBe(false);
    expect(esAcorde("")).toBe(false);
    expect(esAcorde("   ")).toBe(false);
    expect(esAcorde("N.C.")).toBe(false);
    // Notación anglosajona: la app escribe en latina, y aceptar las dos haría
    // que una «G» suelta en la letra se pintara como acorde.
    expect(esAcorde("G")).toBe(false);
  });
});

describe("parseHoja", () => {
  it("parte una línea en trozos, cada uno bajo su acorde", () => {
    const [linea] = parseHoja("[Sol]Sublime [Do]gracia del [Sol]Señor");

    expect(linea.tipo).toBe("letra");
    expect(linea.segmentos).toEqual([
      { acorde: "Sol", texto: "Sublime " },
      { acorde: "Do", texto: "gracia del " },
      { acorde: "Sol", texto: "Señor" },
    ]);
  });

  it("guarda lo que va antes del primer acorde", () => {
    const [linea] = parseHoja("Que [Do]dulce el son");

    expect(linea.segmentos[0]).toEqual({ acorde: "", texto: "Que " });
    expect(linea.segmentos[1]).toEqual({ acorde: "Do", texto: "dulce el son" });
  });

  it("acepta una línea que es solo acordes", () => {
    const [linea] = parseHoja("[Sol] [Do] [Re]");

    expect(linea.segmentos.map((s) => s.acorde)).toEqual(["Sol", "Do", "Re"]);
  });

  it("convierte una directiva en encabezado de sección", () => {
    expect(parseHoja("{comment: Coro}")[0]).toEqual({ tipo: "seccion", etiqueta: "Coro", segmentos: [] });
    expect(parseHoja("{Puente}")[0]).toEqual({ tipo: "seccion", etiqueta: "Puente", segmentos: [] });
  });

  it("deja en la letra los corchetes que no son acordes", () => {
    // «[x2]» lo escribió alguien para que se lea, no para que desaparezca.
    const [linea] = parseHoja("Aleluya [x2]");

    expect(linea.segmentos).toEqual([{ acorde: "", texto: "Aleluya [x2]" }]);
  });

  it("no se traga un corchete sin cerrar", () => {
    const [linea] = parseHoja("Gloria [Sol");

    expect(linea.segmentos).toEqual([{ acorde: "", texto: "Gloria [Sol" }]);
  });

  it("marca las líneas en blanco, que separan las estrofas", () => {
    const lineas = parseHoja("Uno\n\nDos");

    expect(lineas.map((l) => l.tipo)).toEqual(["letra", "vacia", "letra"]);
  });

  it("deja los acordes tal como los escribió su autor", () => {
    const [linea] = parseHoja("[Sol]Sublime [Do]gracia");

    expect(linea.segmentos.map((s) => s.acorde)).toEqual(["Sol", "Do"]);
  });

  it("lee saltos de línea de Windows", () => {
    expect(parseHoja("Uno\r\nDos").map((l) => l.tipo)).toEqual(["letra", "letra"]);
  });
});
