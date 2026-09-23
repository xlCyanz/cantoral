// «Seguir al sistema» no seguía nada dentro de la app.
//
// `prefers-color-scheme` no es de fiar en un webview: en Windows, WebView2 lo
// resuelve contra el tema de la *ventana* y contesta «claro» aunque el sistema
// esté en oscuro. Quien dejaba el modo en «Seguir al sistema» —que es el que
// viene puesto— se quedaba en claro para siempre.
//
// Lo que se fija aquí es que mande lo que diga la ventana nativa, que se siga
// escuchando cuando el sistema cambia, y que elegir claro u oscuro a mano siga
// mandando sobre las dos cosas.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Theme } from "../types";

let delSistema: Theme | null = "dark";
/** El avisador que guardó la app, para poder disparar un cambio de tema. */
let avisar: ((t: Theme) => void) | null = null;

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  setSetting: () => Promise.resolve(),
  temaDelSistema: () => Promise.resolve(delSistema),
  onTemaDelSistema: (cb: (t: Theme) => void) => {
    avisar = cb;
    return Promise.resolve(() => {
      avisar = null;
    });
  },
}));

const { useStore } = await import("../../store");
const initial = useStore.getState();

beforeEach(() => {
  useStore.setState(initial, true);
  delSistema = "dark";
  avisar = null;
});

describe("seguir al sistema", () => {
  it("toma el tema que dice la ventana nativa", async () => {
    useStore.setState({ themeMode: "system", theme: "light" });

    await useStore.getState().seguirAlSistema();

    expect(useStore.getState().theme).toBe("dark");
  });

  it("y se queda escuchando los cambios", async () => {
    useStore.setState({ themeMode: "system", theme: "dark" });
    await useStore.getState().seguirAlSistema();

    avisar!("light");

    expect(useStore.getState().theme).toBe("light");
  });

  it("dejar de escuchar suelta el avisador", async () => {
    const soltar = await useStore.getState().seguirAlSistema();

    soltar();

    expect(avisar).toBeNull();
  });

  it("si la ventana no contesta, no se inventa un tema", async () => {
    // macOS 10.13 y anteriores no tienen tema, y en el modo navegador no hay
    // ventana a la que preguntar.
    delSistema = null;
    useStore.setState({ themeMode: "system", theme: "dark" });

    await useStore.getState().seguirAlSistema();

    expect(useStore.getState().theme).toBe("dark");
    expect(useStore.getState().temaSistema).toBeNull();
  });
});

describe("con el tema elegido a mano", () => {
  it("el sistema no lo pisa al arrancar", async () => {
    useStore.setState({ themeMode: "light", theme: "light" });

    await useStore.getState().seguirAlSistema();

    expect(useStore.getState().theme).toBe("light");
  });

  it("ni cuando el sistema cambia después", async () => {
    useStore.setState({ themeMode: "light", theme: "light" });
    await useStore.getState().seguirAlSistema();

    avisar!("dark");

    expect(useStore.getState().theme).toBe("light");
  });

  it("pero se apunta lo que dijo, para volver a seguirlo sin preguntar", async () => {
    useStore.setState({ themeMode: "light", theme: "light" });
    await useStore.getState().seguirAlSistema();

    useStore.getState().setThemeMode("system");

    expect(useStore.getState().theme).toBe("dark");
  });
});

describe("volver a un tema fijo", () => {
  it("manda sobre lo que diga el sistema", async () => {
    useStore.setState({ themeMode: "system" });
    await useStore.getState().seguirAlSistema();
    expect(useStore.getState().theme).toBe("dark");

    useStore.getState().setThemeMode("light");

    expect(useStore.getState().theme).toBe("light");
  });
});
