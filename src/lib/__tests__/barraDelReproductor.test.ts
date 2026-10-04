// La barra del reproductor solo aparece cuando algo ha sonado. Al abrir la app
// enseñaba una canción cualquiera, la primera del catálogo, que no estaba
// sonando. Una vez que suena algo se queda, también en pausa: es desde donde
// se reanuda, y que desapareciera al pausar dejaría sin botón para volver.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { estadoDeEjemplo } from "./estadoDeEjemplo";

/** El estado que ve la barra cuando se pinta en el servidor. */
let estado: Record<string, unknown> = {};

vi.mock("../../store", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../store")>();
  return {
    ...real,
    useStore: (selector: (s: Record<string, unknown>) => unknown) => selector(estado),
  };
});
const { useStore: storeReal } = await vi.importActual<typeof import("../../store")>("../../store");
const { default: PlayerBar } = await import("../../components/PlayerBar");

const pintar = () => renderToStaticMarkup(createElement(PlayerBar));

describe("la barra del reproductor", () => {
  const inicial = storeReal.getState();

  beforeEach(() => {
    storeReal.setState(inicial, true);
    storeReal.setState(estadoDeEjemplo());
    estado = { ...storeReal.getState() };
  });

  it("al abrir, sin nada sonando, no se muestra; el <audio> sí está", () => {
    const h = pintar();

    expect(h).not.toContain("<footer");
    expect(h).toContain("<audio");
  });

  it("aparece en cuanto algo suena, venga de donde venga", () => {
    storeReal.getState().togglePlay();

    expect(storeReal.getState().haSonado).toBe(true);
    estado = { ...storeReal.getState() };
    expect(pintar()).toContain("<footer");
  });

  it("y en pausa se queda, para poder reanudar", () => {
    storeReal.setState({ playing: true });
    storeReal.setState({ playing: false });

    estado = { ...storeReal.getState() };
    expect(pintar()).toContain("<footer");
  });
});
