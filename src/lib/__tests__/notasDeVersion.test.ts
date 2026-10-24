// Las notas de una versión nueva llegan con el Markdown del CHANGELOG. Se fija
// que se lean como se escribieron —resumen, títulos, viñetas de varias líneas
// y negritas— sin asteriscos ni almohadillas sueltos, y la fecha que da el
// núcleo, que `Date` no entiende tal cual.

import { describe, expect, it } from "vitest";
import { bloquesDeNotas, fechaDeVersion, trozos } from "../notasDeVersion";

const NOTAS = `**Quién canta hoy.** Se registran los cantantes de la iglesia y,
canción por canción, quiénes se la saben.

### Añadido

- **Cantantes**: se registran en
  Configuración → Cantantes.
- **Filtro «Hoy cantan»**: solo lo que se sabe al menos uno.

### Corregido

- «Reproducir todo» ya arranca aunque falte la primera.`;

describe("las notas de la versión", () => {
  it("separan resumen, títulos y viñetas", () => {
    const bloques = bloquesDeNotas(NOTAS);
    expect(bloques.map((b) => b.tipo)).toEqual(["parrafo", "titulo", "lista", "titulo", "lista"]);
  });

  it("el resumen junta sus líneas y su negrita queda en negrita", () => {
    const [resumen] = bloquesDeNotas(NOTAS);
    expect(resumen).toEqual({
      tipo: "parrafo",
      trozos: [
        { texto: "Quién canta hoy.", negrita: true },
        { texto: " Se registran los cantantes de la iglesia y, canción por canción, quiénes se la saben.", negrita: false },
      ],
    });
  });

  it("una viñeta que sigue en la línea de abajo es una sola", () => {
    const lista = bloquesDeNotas(NOTAS)[2];
    expect(lista.tipo).toBe("lista");
    if (lista.tipo !== "lista") return;
    expect(lista.items).toHaveLength(2);
    expect(lista.items[0].map((t) => t.texto).join("")).toBe("Cantantes: se registran en Configuración → Cantantes.");
  });

  it("no deja asteriscos ni almohadillas a la vista", () => {
    const texto = JSON.stringify(bloquesDeNotas(NOTAS));
    expect(texto).not.toContain("**");
    expect(texto).not.toContain("#");
  });

  it("un ** sin pareja se queda como texto", () => {
    expect(trozos("2 ** 3 = 8")).toEqual([{ texto: "2 ** 3 = 8", negrita: false }]);
  });

  it("unas notas de una línea son un párrafo", () => {
    expect(bloquesDeNotas("Arregla lo del atril")).toEqual([
      { tipo: "parrafo", trozos: [{ texto: "Arregla lo del atril", negrita: false }] },
    ]);
  });
});

describe("la fecha de publicación", () => {
  it("entiende la que da el núcleo", () => {
    expect(fechaDeVersion("2026-10-20 22:15:03.0 +00:00:00")?.toISOString()).toBe("2026-10-20T22:15:03.000Z");
  });

  it("y la RFC 3339", () => {
    expect(fechaDeVersion("2026-09-21T12:00:00Z")?.toISOString()).toBe("2026-09-21T12:00:00.000Z");
    expect(fechaDeVersion("2026-09-21T08:00:00-04:00")?.toISOString()).toBe("2026-09-21T12:00:00.000Z");
  });

  it("sin fecha o con una rara, ninguna", () => {
    expect(fechaDeVersion(null)).toBeNull();
    expect(fechaDeVersion("ayer")).toBeNull();
  });
});
