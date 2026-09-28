// Esc es un solo atajo con una pila de prioridades. Lo que se fija aquí es que
// cortar el proyector solo esté en esa pila desde la vista de Proyección: desde
// la biblioteca, Esc es borrar la búsqueda o salir del buscador, y cortaba la
// salida delante de la congregación (#129).

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../../store";
import { registerShortcuts } from "../shortcuts";

const initial = useStore.getState();
const alternarProyeccion = vi.fn();
let quitar: () => void;

beforeAll(() => {
  // Sin navegador: un `document` que solo sabe recibir el evento.
  vi.stubGlobal("document", new EventTarget());
  quitar = registerShortcuts();
});

afterAll(() => {
  quitar();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  alternarProyeccion.mockReset();
  useStore.setState({ ...initial, proyectando: true, alternarProyeccion }, true);
});

function esc() {
  const e = new Event("keydown", { cancelable: true });
  Object.assign(e, { key: "Escape" });
  document.dispatchEvent(e);
  return e;
}

describe("Esc con la salida al aire", () => {
  it("en la biblioteca, con algo buscado, borra la búsqueda y no toca el proyector", () => {
    useStore.setState({ view: "biblioteca", query: "santo" });

    esc();

    expect(useStore.getState().query).toBe("");
    expect(alternarProyeccion).not.toHaveBeenCalled();
  });

  it("en la biblioteca, con pistas elegidas, deselecciona y no toca el proyector", () => {
    useStore.setState({ view: "biblioteca", selection: ["t1"] });

    esc();

    expect(useStore.getState().selection).toEqual([]);
    expect(alternarProyeccion).not.toHaveBeenCalled();
  });

  it("en otra vista sin nada que cerrar, no hace nada", () => {
    useStore.setState({ view: "lista" });

    const e = esc();

    expect(alternarProyeccion).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it("en la vista de Proyección, corta la salida", () => {
    useStore.setState({ view: "proyeccion", query: "santo" });

    esc();

    expect(alternarProyeccion).toHaveBeenCalledTimes(1);
    // Allí gana el proyector: la búsqueda de la biblioteca no se toca.
    expect(useStore.getState().query).toBe("santo");
  });

  it("un diálogo abierto sigue cerrándose antes, también en Proyección", () => {
    useStore.setState({ view: "proyeccion", dialog: "help" });

    esc();

    expect(useStore.getState().dialog).toBeNull();
    expect(alternarProyeccion).not.toHaveBeenCalled();
  });
});
