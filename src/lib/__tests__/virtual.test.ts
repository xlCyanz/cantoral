import { describe, expect, it } from "vitest";
import { ALTOS, altoTotal, aplanar, ventana } from "../virtual";
import type { Track } from "../types";

function track(id: string): Track {
  return {
    id,
    titulo: `Pista ${id}`,
    artista: "Artista",
    album: "Album",
    dur: "3:00",
    durSec: 180,
    tono: "Do",
    bpm: 80,
    ocasion: "Adoración",
    formato: "MP3",
    carpeta: "Himnos",
    tags: [],
    fav: false,
    missing: false,
    tieneHoja: false,
    added: 1,
  };
}

/** One headerless group of `n` tracks, the shape an ungrouped table has. */
function sinCabeceras(n: number) {
  return [
    {
      showHeader: false,
      clave: "",
      colapsado: false,
      tracks: Array.from({ length: n }, (_, i) => ({ track: track(String(i)), num: i + 1 })),
    },
  ];
}

/** Two groups of three, each behind its own header. */
function conCabeceras() {
  return ["Adoración", "Comunión"].map((label, g) => ({
    showHeader: true,
    clave: label,
    colapsado: false,
    label,
    countLabel: "3 pistas",
    tracks: Array.from({ length: 3 }, (_, i) => ({ track: track(`${g}-${i}`), num: g * 3 + i + 1 })),
  }));
}

describe("aplanar", () => {
  it("turns an ungrouped table into one row per track", () => {
    const plano = aplanar(sinCabeceras(4));
    expect(plano.filas.map((f) => f.tipo)).toEqual(["pista", "pista", "pista", "pista"]);
    expect(altoTotal(plano)).toBe(4 * ALTOS.comoda.fila);
  });

  it("counts a group header as a row of its own height", () => {
    const plano = aplanar(conCabeceras());
    expect(plano.filas.map((f) => f.tipo)).toEqual(["grupo", "pista", "pista", "pista", "grupo", "pista", "pista", "pista"]);
    expect(plano.offsets.slice(0, 3)).toEqual([0, ALTOS.comoda.grupo, ALTOS.comoda.grupo + ALTOS.comoda.fila]);
    expect(altoTotal(plano)).toBe(2 * ALTOS.comoda.grupo + 6 * ALTOS.comoda.fila);
  });

  it("keeps the numbering the groups came with", () => {
    const plano = aplanar(conCabeceras());
    const nums = plano.filas.flatMap((f) => (f.tipo === "pista" ? [f.num] : []));
    expect(nums).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("measures an empty table as nothing at all", () => {
    expect(altoTotal(aplanar([]))).toBe(0);
    expect(ventana(aplanar([]), 0, 600)).toEqual({ desde: 0, hasta: 0 });
  });
});

describe("ventana", () => {
  const mil = aplanar(sinCabeceras(1000));

  it("starts at the first row while the table has not scrolled", () => {
    expect(ventana(mil, 0, 10 * ALTOS.comoda.fila).desde).toBe(0);
  });

  it("follows the scroll, keeping a margin on each side", () => {
    expect(ventana(mil, 20 * ALTOS.comoda.fila, 5 * ALTOS.comoda.fila, 8)).toEqual({ desde: 12, hasta: 34 });
  });

  it("never asks for rows the table does not have", () => {
    const { desde, hasta } = ventana(mil, 999 * ALTOS.comoda.fila, 10 * ALTOS.comoda.fila);
    expect(hasta).toBe(1000);
    expect(desde).toBeGreaterThanOrEqual(0);
  });

  it("treats a scroll above the table as the top of it", () => {
    expect(ventana(mil, -400, 5 * ALTOS.comoda.fila, 0).desde).toBe(0);
  });

  it("lands on the header, not a track, when a group header is at the top edge", () => {
    // Rows are not evenly spaced once headers are in play — 212px down is the
    // second header, which a plain «scroll ÷ alto de fila» would miss.
    const plano = aplanar(conCabeceras());
    expect(plano.offsets[4]).toBe(ALTOS.comoda.grupo + 3 * ALTOS.comoda.fila);
    const { desde } = ventana(plano, plano.offsets[4], 0, 0);
    expect(plano.filas[desde].tipo).toBe("grupo");
  });

  it("covers every row the viewport touches", () => {
    const plano = aplanar(conCabeceras());
    const { desde, hasta } = ventana(plano, plano.offsets[4] + 38, ALTOS.comoda.fila, 0);
    expect(desde).toBe(4);
    expect(hasta).toBe(6);
  });
});

describe("las dos densidades", () => {
  it("la tabla compacta mide lo que dicen sus altos, no los de la cómoda", () => {
    const grupos = conCabeceras();

    const comoda = aplanar(grupos, ALTOS.comoda);
    const compacta = aplanar(grupos, ALTOS.compacta);

    expect(altoTotal(comoda)).toBe(2 * ALTOS.comoda.grupo + 6 * ALTOS.comoda.fila);
    expect(altoTotal(compacta)).toBe(2 * ALTOS.compacta.grupo + 6 * ALTOS.compacta.fila);
    expect(altoTotal(compacta)).toBeLessThan(altoTotal(comoda));
  });

  it("y la ventana de filas se mueve con ellos", () => {
    // Con la misma altura de pantalla, la compacta enseña más filas: si la
    // ventana siguiera contando con 56 px, la tabla dejaría huecos en blanco
    // al desplazarse.
    const grupos = [{ showHeader: false, clave: "", colapsado: false, tracks: Array.from({ length: 60 }, (_, i) => ({ track: track(String(i)), num: i + 1 })) }];

    const enComoda = ventana(aplanar(grupos, ALTOS.comoda), 0, 560, 0);
    const enCompacta = ventana(aplanar(grupos, ALTOS.compacta), 0, 560, 0);

    expect(enCompacta.hasta).toBeGreaterThan(enComoda.hasta);
  });

  it("sin altos usa los de la cómoda, que es la densidad por defecto", () => {
    const grupos = conCabeceras();

    expect(altoTotal(aplanar(grupos))).toBe(altoTotal(aplanar(grupos, ALTOS.comoda)));
  });
});
