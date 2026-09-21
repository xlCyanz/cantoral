// Una lista con la fecha corrida un día es peor que una sin fecha: la primera
// miente y la segunda no dice nada. Por eso las fechas se construyen campo a
// campo y no pasando la cadena ISO al constructor de `Date`.

import { describe, expect, it } from "vitest";
import { comoFecha, esIso, esProxima, formatearFecha, formatearFechaCorta, partirPorFecha } from "../fechas";

describe("esIso", () => {
  it("reconoce el formato que la app guarda", () => {
    expect(esIso("2025-07-13")).toBe(true);
  });

  it("rechaza todo lo demás", () => {
    expect(esIso("13-07-2025")).toBe(false);
    expect(esIso("2025-7-3")).toBe(false);
    expect(esIso("Domingo 13 de julio")).toBe(false);
    expect(esIso("")).toBe(false);
    expect(esIso(undefined)).toBe(false);
  });
});

describe("comoFecha", () => {
  it("da el día que dice, no el anterior", () => {
    // `new Date("2025-07-13")` se lee como medianoche UTC, que al oeste de
    // Greenwich se pinta como el 12. Construida campo a campo, es local.
    const f = comoFecha("2025-07-13")!;

    expect(f.getFullYear()).toBe(2025);
    expect(f.getMonth()).toBe(6);
    expect(f.getDate()).toBe(13);
  });

  it("rechaza un día que el mes no tiene", () => {
    // El constructor lo haría rodar a marzo en silencio.
    expect(comoFecha("2025-02-31")).toBeNull();
    expect(comoFecha("2025-02-29")).toBeNull();
    expect(comoFecha("2024-02-29")).not.toBeNull();
  });

  it("devuelve nada si no es ISO", () => {
    expect(comoFecha("mañana")).toBeNull();
    expect(comoFecha("")).toBeNull();
  });
});

describe("formatearFecha", () => {
  it("escribe la fecha en español", () => {
    const texto = formatearFecha("2025-07-13");

    expect(texto).toContain("13");
    expect(texto).toContain("julio");
    expect(texto).toContain("2025");
    expect(texto.toLowerCase()).toContain("domingo");
  });

  it("deja intacto lo que no es una fecha", () => {
    // Escrito antes de que esto existiera; sigue diciendo algo.
    expect(formatearFecha("el domingo después de Pascua")).toBe("el domingo después de Pascua");
  });

  it("no inventa nada cuando no hay fecha", () => {
    expect(formatearFecha("")).toBe("");
    expect(formatearFecha(undefined)).toBe("");
  });

  it("la forma corta también dice el día correcto", () => {
    const corta = formatearFechaCorta("2025-01-01");

    expect(corta).toContain("1");
    expect(corta).toContain("2025");
  });
});

describe("esProxima", () => {
  const hoy = new Date(2025, 6, 13);

  it("hoy cuenta como próxima", () => {
    // El domingo por la mañana el culto es lo que estás a punto de hacer.
    expect(esProxima("2025-07-13", hoy)).toBe(true);
  });

  it("mañana también", () => {
    expect(esProxima("2025-07-14", hoy)).toBe(true);
  });

  it("ayer no", () => {
    expect(esProxima("2025-07-12", hoy)).toBe(false);
  });

  it("lo que no es fecha, tampoco", () => {
    expect(esProxima("cuando se pueda", hoy)).toBe(false);
  });
});

describe("partirPorFecha", () => {
  const hoy = new Date(2025, 6, 13);
  const listas = [
    { nombre: "pasado lejano", fecha: "2025-01-05" },
    { nombre: "sin fecha", fecha: "cuando se pueda" },
    { nombre: "próximo lejano", fecha: "2025-12-25" },
    { nombre: "hoy", fecha: "2025-07-13" },
    { nombre: "vacía" },
    { nombre: "pasado cercano", fecha: "2025-07-06" },
  ];

  it("pone lo que viene primero, el más cercano arriba", () => {
    // Hacia adelante importa el culto más próximo; hacia atrás, el último.
    expect(partirPorFecha(listas, hoy).proximos.map((l) => l.nombre)).toEqual([
      "hoy",
      "próximo lejano",
    ]);
  });

  it("lo pasado va del más reciente al más antiguo", () => {
    expect(partirPorFecha(listas, hoy).pasados.map((l) => l.nombre)).toEqual([
      "pasado cercano",
      "pasado lejano",
    ]);
  });

  it("lo que no tiene fecha legible queda aparte, sin reordenar", () => {
    expect(partirPorFecha(listas, hoy).sinFecha.map((l) => l.nombre)).toEqual(["sin fecha", "vacía"]);
  });

  it("no pierde ni duplica ninguna lista", () => {
    const { proximos, pasados, sinFecha } = partirPorFecha(listas, hoy);

    expect(proximos.length + pasados.length + sinFecha.length).toBe(listas.length);
  });

  it("aguanta una lista vacía", () => {
    expect(partirPorFecha([], hoy)).toEqual({ proximos: [], pasados: [], sinFecha: [] });
  });
});
