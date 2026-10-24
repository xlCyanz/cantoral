// Configuración va en pestañas: cada una enseña solo lo suyo, la fila se
// marca como lo lee un lector de pantalla, y quien llega desde «Administrar
// carpetas» cae en la de la biblioteca y no en la última que se vio.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PestanaConfig } from "../types";

/** El estado que ven los componentes; cada prueba pone el suyo. */
let estado: Record<string, unknown> = {};

// En el servidor zustand lee el estado inicial, no el que se le pone, así que
// los componentes leen de aquí. Las pruebas del store usan el de verdad.
vi.mock("../../store", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../store")>();
  return {
    ...real,
    useStore: Object.assign((selector: (s: Record<string, unknown>) => unknown) => selector(estado), {
      getState: () => real.useStore.getState(),
      setState: real.useStore.setState,
    }),
  };
});
const { useStore } = await vi.importActual<typeof import("../../store")>("../../store");
const { default: ConfigView } = await import("../../components/ConfigView");

const inicial = useStore.getState();
beforeEach(() => useStore.setState(inicial, true));

function pintar(pestana: PestanaConfig): string {
  estado = { ...useStore.getState(), pestanaConfig: pestana } as unknown as Record<string, unknown>;
  return renderToStaticMarkup(createElement(ConfigView));
}

describe("las pestañas de Configuración", () => {
  it("cada una enseña solo sus tarjetas", () => {
    const general = pintar("general");
    expect(general).toContain("Apariencia");
    expect(general).not.toContain("Carpetas indexadas");

    const biblioteca = pintar("biblioteca");
    expect(biblioteca).toContain("Carpetas indexadas");
    expect(biblioteca).not.toContain("Apariencia");

    expect(pintar("cantantes")).toContain("Cantantes</h2>");
    expect(pintar("proyeccion")).toContain("Proyección</h2>");
    expect(pintar("copias")).toContain("Base de datos");

    const acerca = pintar("acerca");
    expect(acerca).toContain("Actualizaciones");
    expect(acerca).toContain("Diagnóstico");
    expect(acerca).toContain("Créditos");
  });

  it("la fila se lee como pestañas, con la elegida marcada y la única con Tab", () => {
    const html = pintar("copias");
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(6);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html).toMatch(/id="config-tab-copias"[^>]*aria-selected="true"[^>]*tabindex="0"/);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(5);
    expect(html).toContain('role="tabpanel" id="config-panel-copias" aria-labelledby="config-tab-copias"');
  });
});

describe("ir a Configuración", () => {
  it("desde la barra lateral vuelve a la última pestaña que se vio", () => {
    useStore.getState().setPestanaConfig("acerca");
    useStore.getState().showBiblioteca();
    useStore.getState().showConfig();
    expect(useStore.getState().view).toBe("config");
    expect(useStore.getState().pestanaConfig).toBe("acerca");
  });

  it("desde «Administrar carpetas» abre la de la biblioteca", () => {
    useStore.getState().setPestanaConfig("acerca");
    useStore.getState().showConfig("biblioteca");
    expect(useStore.getState().pestanaConfig).toBe("biblioteca");
  });
});
