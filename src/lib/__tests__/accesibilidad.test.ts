// Lo que la auditoría de accesibilidad encontró sin cumplir (#138): controles
// que el teclado no alcanzaba y semántica que se prometía a medias. Se fija
// aquí el marcado que un lector de pantalla lee, y las teclas de los controles
// pintados a mano.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { indiceDeMenu, valorDeDeslizador } from "../teclado";
import { estadoDeEjemplo } from "./estadoDeEjemplo";

/** El estado que ven los componentes; cada prueba pone el suyo. */
let estado: Record<string, unknown> = {};

// En el servidor zustand lee el estado inicial, no el que se le pone, así que
// los componentes leen de aquí.
vi.mock("../../store", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../store")>();
  return {
    ...real,
    useStore: (selector: (s: Record<string, unknown>) => unknown) => selector(estado),
    escaneoAPantallaCompleta: () => false,
  };
});
const { useStore: storeReal } = await vi.importActual<typeof import("../../store")>("../../store");

const { default: PlayerBar } = await import("../../components/PlayerBar");
const { default: AddFolderDialog } = await import("../../components/AddFolderDialog");
const { default: LibraryView } = await import("../../components/LibraryView");
const { default: ProjectionView } = await import("../../components/ProjectionView");
const { default: NewListDialog } = await import("../../components/NewListDialog");

beforeEach(() => {
  estado = { ...storeReal.getState(), ...estadoDeEjemplo() };
});

const html = (c: Parameters<typeof createElement>[0]) => renderToStaticMarkup(createElement(c));

describe("los deslizadores del reproductor", () => {
  it("son deslizadores que el teclado alcanza y que dicen dónde están", () => {
    estado = { ...estado, volume: 0.6, muted: false, haSonado: true };
    const h = html(PlayerBar);

    expect(h.match(/role="slider"/g)).toHaveLength(2);
    expect(h).toMatch(/role="slider" tabindex="0" aria-label="Volumen"[^>]*aria-valuenow="60" aria-valuetext="60 %"/);
    expect(h).toMatch(/aria-label="Posición en la pista"/);
  });

  it("las flechas mueven un paso, Inicio y Fin van a los extremos", () => {
    expect(valorDeDeslizador("ArrowRight", 0.5, 0.05)).toBeCloseTo(0.55);
    expect(valorDeDeslizador("ArrowDown", 0.5, 0.05)).toBeCloseTo(0.45);
    expect(valorDeDeslizador("PageUp", 0.5, 0.05)).toBeCloseTo(0.7);
    expect(valorDeDeslizador("Home", 0.5, 0.05)).toBe(0);
    expect(valorDeDeslizador("End", 0.5, 0.05)).toBe(1);
  });

  it("sin pasarse de los extremos, y dejando pasar las demás teclas", () => {
    expect(valorDeDeslizador("ArrowRight", 0.98, 0.05)).toBe(1);
    expect(valorDeDeslizador("ArrowLeft", 0.01, 0.05)).toBe(0);
    expect(valorDeDeslizador(" ", 0.5, 0.05)).toBeNull();
  });

  it("los botones de transporte tienen nombre, no solo `title`", () => {
    estado = { ...estado, haSonado: true };
    const h = html(PlayerBar);
    for (const nombre of ["Anterior", "Siguiente", "Reproducir", "Silenciar", "Favorita"]) {
      expect(h).toContain(`aria-label="${nombre}"`);
    }
  });
});

describe("«Incluir subcarpetas»", () => {
  it("es una casilla de verdad, marcada por defecto", () => {
    estado = { ...estado, dialog: "addFolder" };
    const h = html(AddFolderDialog);

    expect(h).toMatch(/<input type="checkbox"[^>]*checked=""/);
    // La pintada no se anuncia dos veces.
    expect(h).toMatch(/<div aria-hidden="true" class="casilla-marca"/);
  });
});

describe("el menú de una fila", () => {
  it("las flechas dan la vuelta", () => {
    expect(indiceDeMenu("ArrowDown", 2, 3)).toBe(0);
    expect(indiceDeMenu("ArrowUp", 0, 3)).toBe(2);
    expect(indiceDeMenu("ArrowDown", 0, 3)).toBe(1);
  });

  it("desde fuera, ↓ entra por el primero y ↑ por el último", () => {
    expect(indiceDeMenu("ArrowDown", -1, 3)).toBe(0);
    expect(indiceDeMenu("ArrowUp", -1, 3)).toBe(2);
  });

  it("Inicio y Fin, y nada para las demás teclas", () => {
    expect(indiceDeMenu("Home", 1, 3)).toBe(0);
    expect(indiceDeMenu("End", 1, 3)).toBe(2);
    expect(indiceDeMenu("a", 1, 3)).toBeNull();
    expect(indiceDeMenu("ArrowDown", -1, 0)).toBeNull();
  });
});

describe("la tabla de la biblioteca", () => {
  it("es una rejilla que cuenta todas sus filas", () => {
    const h = html(LibraryView);
    const pistas = (estado.tracks as unknown[]).length;

    expect(h).toContain(`role="grid" aria-label="Biblioteca" aria-rowcount="${pistas + 1}"`);
    expect(h).toContain('role="row" aria-rowindex="1"');
    expect(h.match(/role="columnheader"/g)).toHaveLength(6);
  });

  it("cada pista es una fila numerada que dice si está elegida", () => {
    const [, segunda] = estado.tracks as { id: string }[];
    estado = { ...estado, selection: [segunda.id] };
    const h = html(LibraryView);

    expect(h).toMatch(/role="row" aria-rowindex="2" tabindex="0" aria-label="[^"]*" aria-selected="(true|false)"/);
    expect(h.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(h.match(/role="gridcell"/g)!.length).toBe((estado.tracks as unknown[]).length * 6);
  });

  it("agrupada, la cabecera del grupo también es una fila", () => {
    estado = { ...estado, groupBy: "carpeta" };
    const h = html(LibraryView);

    expect(h).toMatch(/<div role="row" aria-rowindex="2"><div role="gridcell" aria-colspan="6"><button[^>]*aria-expanded="true"/);
  });
});

describe("Proyección", () => {
  it("ninguna opción explica lo que hace solo en `title`", () => {
    const h = html(ProjectionView);

    // Cada botón apunta a su explicación, que está en la página.
    const descritos = [...h.matchAll(/aria-describedby="(proy-[^"]+)"/g)].map((m) => m[1]);
    expect(descritos.length).toBe(6);
    for (const id of descritos) expect(h).toContain(`id="${id}"`);
    // Y la del elegido se ve.
    expect(h).toContain("Al acabarse un elemento, arranca solo el de después.");
  });
});

describe("las etiquetas de los formularios", () => {
  it("apuntan a su campo", () => {
    estado = { ...estado, dialog: "newList" };
    const h = html(NewListDialog);

    expect(h).toContain('for="lista-nombre"');
    expect(h).toContain('id="lista-nombre"');
    expect(h).toContain('for="lista-ocasion"');
    expect(h).toContain('id="lista-ocasion"');
  });
});
