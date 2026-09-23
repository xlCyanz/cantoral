// «Biblioteca», «Favoritas» y «Archivos faltantes» son la misma tabla filtrada,
// y desde la tabla no se distinguen. Lo que se fija aquí es que el encabezado
// diga cuál de las tres es y cuánto se está viendo de cuánto — «19 canciones» a
// secas no decía si eran todas o si un filtro se comía la mitad.

import { describe, expect, it } from "vitest";
import { encabezadoBiblioteca } from "../encabezado";

describe("el título", () => {
  it("sin filtro es la biblioteca entera", () => {
    expect(encabezadoBiblioteca(null, 19, 19, "none", false).titulo).toBe("Biblioteca");
  });

  it("y con filtro es el nombre del filtro", () => {
    expect(encabezadoBiblioteca("fav", 4, 19, "none", false).titulo).toBe("Favoritas");
    expect(encabezadoBiblioteca("recent", 8, 19, "none", false).titulo).toBe("Recién agregadas");
    expect(encabezadoBiblioteca("missing", 2, 19, "none", false).titulo).toBe("Archivos faltantes");
  });
});

describe("el recuento", () => {
  it("sin filtro ni búsqueda no dice «19 de 19»", () => {
    expect(encabezadoBiblioteca(null, 19, 19, "none", false).subtitulo).toBe("19 pistas");
  });

  it("filtrando dice cuánto se ve de cuánto hay", () => {
    // Ver «4» sin saber que hay 19 detrás hace pensar que la biblioteca se
    // encogió.
    expect(encabezadoBiblioteca("fav", 4, 19, "none", false).subtitulo).toBe("4 de 19 pistas");
  });

  it("y buscando también, aunque salgan todas", () => {
    // Una búsqueda que encuentra las 19 sigue siendo una búsqueda: si dijera
    // «19 pistas» parecería que no está filtrando nada.
    expect(encabezadoBiblioteca(null, 19, 19, "none", true).subtitulo).toBe("19 de 19 pistas");
  });

  it("una sola pista va en singular", () => {
    expect(encabezadoBiblioteca(null, 1, 1, "none", false).subtitulo).toBe("1 pista");
    expect(encabezadoBiblioteca("fav", 0, 1, "none", false).subtitulo).toBe("0 de 1 pista");
  });

  it("con la biblioteca vacía no se rompe", () => {
    expect(encabezadoBiblioteca(null, 0, 0, "none", false).subtitulo).toBe("0 pistas");
  });
});

describe("el agrupado", () => {
  it("se dice cuando lo hay, con el nombre en castellano", () => {
    expect(encabezadoBiblioteca(null, 19, 19, "carpeta", false).subtitulo).toBe("19 pistas · agrupadas por carpeta");
    expect(encabezadoBiblioteca(null, 19, 19, "ocasion", false).subtitulo).toContain("agrupadas por ocasión");
    expect(encabezadoBiblioteca(null, 19, 19, "album", false).subtitulo).toContain("agrupadas por álbum");
  });

  it("y sin agrupar no se menciona", () => {
    expect(encabezadoBiblioteca(null, 19, 19, "none", false).subtitulo).not.toContain("agrupadas");
  });
});

describe("los archivos que faltan", () => {
  it("se explican en vez de contarse", () => {
    // Quien llega aquí no viene a ver cuántos son, viene a ver qué hacer.
    const e = encabezadoBiblioteca("missing", 2, 19, "none", false);

    expect(e.subtitulo).toContain("reapuntarlo sin perder etiquetas");
    expect(e.subtitulo).not.toContain("2 de 19");
  });

  it("y cuando no falta ninguno lo dice", () => {
    expect(encabezadoBiblioteca("missing", 0, 19, "none", false).subtitulo).toBe("No falta ningún archivo.");
  });

  it("el agrupado no se cuela en esa explicación", () => {
    expect(encabezadoBiblioteca("missing", 2, 19, "carpeta", false).subtitulo).not.toContain("agrupadas");
  });
});
