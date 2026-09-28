// El glifo blanco de las carátulas generadas vive en un solo componente; antes
// había tres copias casi iguales y una cuarta, suelta, en la barra del
// reproductor. Estas pruebas fijan qué dibujo sale para cada pista y que cada
// pantalla conserva el tamaño y el grosor que tenía.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GlifoDePista from "../GlifoDePista";
import { formaDeGlifo } from "../../lib/covers";

type Props = Parameters<typeof GlifoDePista>[0];
const pintar = (props: Props) => renderToStaticMarkup(createElement(GlifoDePista, props));

const audio = { missing: false, video: false, cover: undefined };
const video = { ...audio, video: true };
const faltante = { ...audio, missing: true };
const conArte = { ...audio, cover: "data:image/png;base64,AAAA" };

describe("formaDeGlifo", () => {
  it("una pista con carátula propia no lleva glifo", () => {
    expect(formaDeGlifo(conArte)).toBeNull();
  });

  it("un archivo que falta avisa, aunque sea un video o tenga carátula", () => {
    // Sin archivo tampoco hay carátula que enseñar.
    expect(formaDeGlifo(faltante)).toBe("faltante");
    expect(formaDeGlifo({ ...faltante, video: true })).toBe("faltante");
    expect(formaDeGlifo({ ...conArte, missing: true })).toBe("faltante");
  });

  it("un video se distingue del audio", () => {
    expect(formaDeGlifo(video)).toBe("video");
    expect(formaDeGlifo(audio)).toBe("nota");
  });

  it("sin pista, la nota", () => {
    // La barra del reproductor arranca así con la biblioteca vacía.
    expect(formaDeGlifo(undefined)).toBe("nota");
  });
});

describe("GlifoDePista", () => {
  it("no dibuja nada encima de una carátula de verdad", () => {
    expect(pintar({ t: conArte, size: "fila" })).toBe("");
  });

  it("dibuja el triángulo, la cámara o la nota según la pista", () => {
    expect(pintar({ t: faltante, size: "fila" })).toContain('d="M12 9v4"');
    expect(pintar({ t: video, size: "fila" })).toContain('<rect x="2" y="6" width="14" height="12" rx="2">');
    expect(pintar({ t: audio, size: "fila" })).toContain('d="M9 18V5l12-2v13"');
  });

  it("cada pantalla conserva su tamaño y su trazo", () => {
    const medidas = (props: Props) => {
      const html = pintar(props);
      return [
        /stroke-width="([\d.]+)"/.exec(html)?.[1],
        /width:(\d+)px/.exec(html)?.[1],
        /stroke="rgba\(255,255,255,([\d.]+)\)"/.exec(html)?.[1],
      ];
    };
    // [grosor, lado, opacidad], tal como estaban escritos en cada vista.
    expect(medidas({ t: faltante, size: "fila" })).toEqual(["2", "16", "0.92"]);
    expect(medidas({ t: video, size: "fila" })).toEqual(["1.9", "17", "0.92"]);
    expect(medidas({ t: audio, size: "fila" })).toEqual(["2", "15", "0.9"]);
    expect(medidas({ t: faltante, size: "compacta" })).toEqual(["2", "10", "0.92"]);
    expect(medidas({ t: video, size: "compacta" })).toEqual(["1.9", "11", "0.92"]);
    expect(medidas({ t: audio, size: "compacta" })).toEqual(["2", "9", "0.9"]);
    expect(medidas({ t: faltante, size: "lista" })).toEqual(["2", "14", "0.9"]);
    expect(medidas({ t: video, size: "lista" })).toEqual(["1.8", "15", "0.92"]);
    expect(medidas({ t: audio, size: "lista" })).toEqual(["1.8", "14", "0.9"]);
    expect(medidas({ t: faltante, size: "detalle" })).toEqual(["1.7", "40", "0.92"]);
    expect(medidas({ t: video, size: "detalle" })).toEqual(["1.5", "44", "0.92"]);
    expect(medidas({ t: audio, size: "detalle" })).toEqual(["1.6", "40", "0.9"]);
    expect(medidas({ t: audio, size: "barra" })).toEqual(["1.8", "16", "0.9"]);
  });

  it("la barra del reproductor enseña la nota sea cual sea la pista", () => {
    const nota = pintar({ t: audio, size: "barra", forma: "nota" });

    expect(pintar({ t: video, size: "barra", forma: "nota" })).toBe(nota);
    expect(pintar({ t: faltante, size: "barra", forma: "nota" })).toBe(nota);
    expect(pintar({ t: undefined, size: "barra", forma: "nota" })).toBe(nota);
    // Pero una carátula de verdad sigue mandando.
    expect(pintar({ t: conArte, size: "barra", forma: "nota" })).toBe("");
  });
});
