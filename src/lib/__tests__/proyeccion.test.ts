// Elegir por qué pantalla sale la proyección es la decisión que más caro sale
// equivocar: si por defecto apunta a la pantalla del operador, lo primero que
// ve la congregación un domingo es el escritorio de quien opera. Lo que se fija
// aquí es que por defecto vaya a la otra, que mover la salida en marcha no la
// cierre, y que no se mande nada a una salida que no está abierta.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MonitorInfo } from "../api";

const projectionMonitors = vi.fn<() => Promise<MonitorInfo[]>>();
const openProjectionCmd = vi.fn<(m: number) => Promise<void>>();
const closeProjectionCmd = vi.fn<() => Promise<void>>();
const setProjectionCmd = vi.fn<(c: unknown) => Promise<void>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  projectionMonitors: () => projectionMonitors(),
  openProjectionCmd: (m: number) => openProjectionCmd(m),
  closeProjectionCmd: () => closeProjectionCmd(),
  setProjectionCmd: (c: unknown) => setProjectionCmd(c),
}));

const { useStore } = await import("../../store");
const initial = useStore.getState();

function pantalla(indice: number, over: Partial<MonitorInfo> = {}): MonitorInfo {
  return { indice, nombre: `Pantalla ${indice + 1}`, ancho: 1920, alto: 1080, principal: false, ...over };
}

const PORTATIL = pantalla(0, { nombre: "Built-in", principal: true });
const PROYECTOR = pantalla(1, { nombre: "DELL P2219H" });

beforeEach(() => {
  useStore.setState(initial, true);
  for (const m of [projectionMonitors, openProjectionCmd, closeProjectionCmd, setProjectionCmd]) m.mockReset();
  projectionMonitors.mockResolvedValue([PORTATIL, PROYECTOR]);
  openProjectionCmd.mockResolvedValue(undefined);
  closeProjectionCmd.mockResolvedValue(undefined);
  setProjectionCmd.mockResolvedValue(undefined);
});

describe("elegir pantalla", () => {
  it("por defecto sale por la que no es la del operador", async () => {
    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitorSalida).toBe(PROYECTOR.indice);
  });

  it("con una sola pantalla no queda más remedio que esa", async () => {
    // Preparando un jueves, sin proyector: la salida tapará la ventana, que es
    // lo que de verdad pasa, y es mejor que un botón que no hace nada.
    projectionMonitors.mockResolvedValue([PORTATIL]);

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitorSalida).toBe(PORTATIL.indice);
  });

  it("sin ninguna pantalla no se inventa un índice", async () => {
    projectionMonitors.mockResolvedValue([]);

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitores).toEqual([]);
    expect(useStore.getState().monitorSalida).toBe(0);
  });

  it("si ya se está proyectando, volver a mirar no cambia la pantalla debajo", async () => {
    // Enchufar un teclado no puede mover la proyección a mitad de un culto.
    await useStore.getState().cargarMonitores();
    useStore.getState().elegirMonitor(0);
    useStore.setState({ proyectando: true });

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitorSalida).toBe(0);
  });

  it("y si el índice elegido ya no existe, vuelve a decidir", async () => {
    useStore.setState({ proyectando: true, monitorSalida: 7 });

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitorSalida).toBe(PROYECTOR.indice);
  });

  it("que el núcleo falle deja la lista vacía, no revienta la vista", async () => {
    projectionMonitors.mockRejectedValue(new Error("sin ventana"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitores).toEqual([]);
  });
});

describe("abrir y cerrar la salida", () => {
  it("abre por la pantalla elegida y lo recuerda", async () => {
    await useStore.getState().cargarMonitores();

    useStore.getState().alternarProyeccion();

    expect(openProjectionCmd).toHaveBeenCalledWith(PROYECTOR.indice);
    await vi.waitFor(() => expect(useStore.getState().proyectando).toBe(true));
  });

  it("si no se pudo abrir, no se queda diciendo que está en vivo", async () => {
    openProjectionCmd.mockRejectedValue(new Error("no hay pantalla 2"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await useStore.getState().cargarMonitores();

    useStore.getState().alternarProyeccion();

    await vi.waitFor(() => expect(useStore.getState().toast?.type).toBe("error"));
    expect(useStore.getState().proyectando).toBe(false);
  });

  it("el mismo botón la corta", async () => {
    useStore.setState({ proyectando: true });

    useStore.getState().alternarProyeccion();

    expect(closeProjectionCmd).toHaveBeenCalled();
    expect(useStore.getState().proyectando).toBe(false);
  });

  it("cambiar de pantalla en marcha la mueve, no la cierra", async () => {
    // Cerrar y volver a abrir sería un parpadeo delante de la congregación.
    useStore.setState({ proyectando: true, monitores: [PORTATIL, PROYECTOR] });

    useStore.getState().elegirMonitor(0);

    expect(openProjectionCmd).toHaveBeenCalledWith(0);
    expect(closeProjectionCmd).not.toHaveBeenCalled();
    expect(useStore.getState().proyectando).toBe(true);
  });

  it("y apagada solo se apunta cuál será", () => {
    useStore.setState({ proyectando: false, monitores: [PORTATIL, PROYECTOR] });

    useStore.getState().elegirMonitor(1);

    expect(openProjectionCmd).not.toHaveBeenCalled();
    expect(useStore.getState().monitorSalida).toBe(1);
  });
});

describe("mandar contenido a la salida", () => {
  it("no manda nada si no hay salida abierta", () => {
    useStore.setState({ proyectando: false });

    useStore.getState().proyectar({ modo: "negro" });

    expect(setProjectionCmd).not.toHaveBeenCalled();
  });

  it("y con la salida abierta manda lo que se le pide", () => {
    useStore.setState({ proyectando: true });

    useStore.getState().proyectar({ modo: "titulo", titulo: "Sublime Gracia" });

    expect(setProjectionCmd).toHaveBeenCalledWith({ modo: "titulo", titulo: "Sublime Gracia" });
  });
});
