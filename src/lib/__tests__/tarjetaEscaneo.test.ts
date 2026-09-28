// Lo que la tarjeta de escaneo dice que se está leyendo tiene que estar en el
// disco. Antes, en cuanto el núcleo mandaba el archivo vacío, la tarjeta caía
// en los nombres de demostración del catálogo de ejemplo y enseñaba
// «Himnos\Sublime Gracia.mp3» mientras se escaneaban los videos de otra
// persona.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCAN_FILES } from "../seed";

/** El estado que ven los componentes; cada prueba pone el suyo. */
let estado: Record<string, unknown> = {};

// En el servidor zustand lee el estado inicial, no el que se le pone, así que
// los componentes leen de aquí. Se parte del estado inicial de verdad para que
// lo que el store traiga de serie —un índice de archivo en 0, por ejemplo—
// cuente igual que en la app.
vi.mock("../../store", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../store")>();
  return {
    ...real,
    useStore: (selector: (s: Record<string, unknown>) => unknown) => selector(estado),
    escaneoAPantallaCompleta: () => false,
  };
});
const { useStore: storeReal } = await vi.importActual<typeof import("../../store")>("../../store");

const { default: ScanProgress } = await import("../../components/ScanProgress");
const { ScanningState } = await import("../../components/LibraryView");

const pintar = {
  "la tarjeta de la esquina": () => renderToStaticMarkup(createElement(ScanProgress)),
  "la pantalla completa": () => renderToStaticMarkup(createElement(ScanningState)),
};

beforeEach(() => {
  estado = {
    ...(storeReal.getInitialState() as unknown as Record<string, unknown>),
    scanning: true,
    tarjetaEscaneoOculta: false,
    scanPct: 40,
    scanFile: "",
    cancelScan: () => {},
    ocultarTarjetaEscaneo: () => {},
  };
});

describe.each(Object.entries(pintar))("%s", (_, html) => {
  it("sin archivo del núcleo no inventa uno", () => {
    const pagina = html();
    expect(pagina).toContain("40%");
    for (const demo of SCAN_FILES) expect(pagina).not.toContain(demo);
  });

  it("enseña el archivo que manda el núcleo", () => {
    estado.scanFile = "/Users/iglesia/Videos/Canto 012.mp4";
    expect(html()).toContain("/Users/iglesia/Videos/Canto 012.mp4");
  });
});
