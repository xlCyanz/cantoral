// Transponer mal un acorde no da un error: da una hoja que alguien toca el
// domingo por la mañana delante de la congregación. Por eso esto se prueba nota
// a nota, y por eso lo que no se entiende se devuelve intacto en vez de
// adivinado.

import { describe, expect, it } from "vitest";
import {
  parseAcorde,
  parseHoja,
  transponerAcorde,
  transponerHoja,
  transponerTono,
  usaBemoles,
} from "../chords";

describe("parseAcorde", () => {
  it("lee la nota, la alteración y lo que venga detrás", () => {
    expect(parseAcorde("Do")).toEqual({ raiz: 0, sufijo: "" });
    expect(parseAcorde("Rem")).toEqual({ raiz: 2, sufijo: "m" });
    expect(parseAcorde("Fa#m7")).toEqual({ raiz: 6, sufijo: "m7" });
    expect(parseAcorde("Sib")).toEqual({ raiz: 10, sufijo: "" });
  });

  it("no confunde «Sol» con «Si»", () => {
    expect(parseAcorde("Sol")).toEqual({ raiz: 7, sufijo: "" });
    expect(parseAcorde("Si")).toEqual({ raiz: 11, sufijo: "" });
    expect(parseAcorde("Solb")).toEqual({ raiz: 6, sufijo: "" });
  });

  it("entiende un acorde con bajo", () => {
    expect(parseAcorde("Sol/Si")).toEqual({ raiz: 7, sufijo: "", bajo: 11 });
    expect(parseAcorde("Do/Mi")).toEqual({ raiz: 0, sufijo: "", bajo: 4 });
  });

  it("devuelve nada cuando no es un acorde", () => {
    expect(parseAcorde("x2")).toBeNull();
    expect(parseAcorde("Coro")).toBeNull();
    expect(parseAcorde("")).toBeNull();
    // Cifrado anglosajón: no es lo que usa la app, y adivinar sería peor.
    expect(parseAcorde("G")).toBeNull();
  });
});

describe("transponerAcorde", () => {
  it("sube y baja conservando el tipo de acorde", () => {
    expect(transponerAcorde("Do", 2, false)).toBe("Re");
    expect(transponerAcorde("Rem", -2, false)).toBe("Dom");
    expect(transponerAcorde("Fa#m7", 1, false)).toBe("Solm7");
    expect(transponerAcorde("Solsus4", 5, false)).toBe("Dosus4");
  });

  it("da la vuelta a la octava por arriba y por abajo", () => {
    expect(transponerAcorde("La", 3, false)).toBe("Do");
    expect(transponerAcorde("Do", -1, false)).toBe("Si");
    expect(transponerAcorde("Do", 12, false)).toBe("Do");
    expect(transponerAcorde("Do", -13, false)).toBe("Si");
  });

  it("escribe con bemoles cuando el tono de destino los pide", () => {
    // Sol# y Lab suenan igual; en un tono con bemoles, leer «Sol#» obliga al
    // músico a traducir, que es justo lo que esto viene a evitar.
    expect(transponerAcorde("Sol", 1, false)).toBe("Sol#");
    expect(transponerAcorde("Sol", 1, true)).toBe("Lab");
    expect(transponerAcorde("Mi", 1, true)).toBe("Fa");
  });

  it("mueve también el bajo de un acorde con barra", () => {
    expect(transponerAcorde("Sol/Si", 2, false)).toBe("La/Do#");
    expect(transponerAcorde("Do/Mi", 5, true)).toBe("Fa/La");
  });

  it("deja intacto lo que no sabe leer", () => {
    expect(transponerAcorde("x2", 2, false)).toBe("x2");
    expect(transponerAcorde("N.C.", 2, false)).toBe("N.C.");
  });
});

describe("transponerTono", () => {
  it("conserva si el tono es mayor o menor", () => {
    expect(transponerTono("Sol", 2)).toBe("La");
    expect(transponerTono("Lam", 2)).toBe("Sim");
    expect(transponerTono("Mim", -2)).toBe("Rem");
  });

  it("escribe el tono nuevo con su propia armadura", () => {
    // Fa mayor lleva un bemol, así que el tono se llama Fa, no Mi#.
    expect(transponerTono("Mi", 1)).toBe("Fa");
    // La# mayor tendría diez sostenidos; Sib mayor tiene dos.
    expect(transponerTono("La", 1)).toBe("Sib");
    // Igual por el otro lado: Reb mayor lleva cinco bemoles y Do# siete
    // sostenidos, así que el nombre que se escribe en un papel es Reb.
    expect(transponerTono("Do", 1)).toBe("Reb");
    expect(transponerTono("Rem", -2)).toBe("Dom");
  });

  it("elige la armadura según el tono, no según sea mayor o menor", () => {
    // Do sostenido *menor* sí se escribe con sostenidos —lleva cuatro— aunque
    // Do sostenido *mayor* no. La decisión es por tono, no por alteración.
    expect(transponerTono("Dom", 1)).toBe("Do#m");
    expect(transponerTono("Lam", 1)).toBe("Sibm");
  });

  it("no inventa nada cuando nadie anotó el tono", () => {
    expect(transponerTono("", 2)).toBe("");
    expect(transponerTono("—", 2)).toBe("—");
  });
});

describe("usaBemoles", () => {
  it("reconoce los tonos que se escriben con bemoles", () => {
    expect(usaBemoles("Fa")).toBe(true);
    expect(usaBemoles("Sib")).toBe(true);
    expect(usaBemoles("Rem")).toBe(true);
    expect(usaBemoles("Sol")).toBe(false);
    expect(usaBemoles("Lam")).toBe(false);
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

  it("transpone al vuelo si se le pide", () => {
    const [linea] = parseHoja("[Sol]Sublime [Do]gracia", 2, false);

    expect(linea.segmentos.map((s) => s.acorde)).toEqual(["La", "Re"]);
  });

  it("lee saltos de línea de Windows", () => {
    expect(parseHoja("Uno\r\nDos").map((l) => l.tipo)).toEqual(["letra", "letra"]);
  });
});

describe("transponerHoja", () => {
  it("reescribe los acordes y no toca la letra", () => {
    const hoja = "[Sol]Sublime [Do]gracia del [Re7]Señor";

    expect(transponerHoja(hoja, 2, false)).toBe("[La]Sublime [Re]gracia del [Mi7]Señor");
  });

  it("devuelve la hoja tal cual cuando no hay que mover nada", () => {
    const hoja = "[Sol]Sublime";

    expect(transponerHoja(hoja, 0, false)).toBe(hoja);
  });

  it("no toca los corchetes que no son acordes", () => {
    expect(transponerHoja("Aleluya [x2] [Sol]", 1, false)).toBe("Aleluya [x2] [Sol#]");
  });

  it("ida y vuelta deja la hoja como estaba", () => {
    const hoja = "[Sol]Sublime [Do]gracia [Rem7]del [Sol/Si]Señor";

    expect(transponerHoja(transponerHoja(hoja, 5, false), -5, false)).toBe(hoja);
  });
});
