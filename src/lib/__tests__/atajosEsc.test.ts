// Esc es un solo atajo con una pila de prioridades, y no corta el proyector:
// desde la biblioteca, Esc es borrar la búsqueda o salir del buscador, y cortar
// la salida delante de la congregación sería la peor sorpresa (#129). Ya no hay
// vista de Proyección con teclas propias: B no hace nada y → es la siguiente
// pista de la cola, con la salida abierta o sin ella. El proyector se cierra
// con el botón de la barra.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../../store";
import { registerShortcuts } from "../shortcuts";

const initial = useStore.getState();
const cerrarProyeccion = vi.fn();
const next = vi.fn();
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
  cerrarProyeccion.mockReset();
  next.mockReset();
  useStore.setState({ ...initial, proyectando: true, cerrarProyeccion, next }, true);
});

function tecla(key: string) {
  const e = new Event("keydown", { cancelable: true });
  Object.assign(e, { key });
  document.dispatchEvent(e);
  return e;
}

describe("Esc con la salida abierta", () => {
  it("en la biblioteca, con algo buscado, borra la búsqueda y no toca el proyector", () => {
    useStore.setState({ view: "biblioteca", query: "santo" });

    tecla("Escape");

    expect(useStore.getState().query).toBe("");
    expect(cerrarProyeccion).not.toHaveBeenCalled();
  });

  it("en la biblioteca, con pistas elegidas, deselecciona y no toca el proyector", () => {
    useStore.setState({ view: "biblioteca", selection: ["t1"] });

    tecla("Escape");

    expect(useStore.getState().selection).toEqual([]);
    expect(cerrarProyeccion).not.toHaveBeenCalled();
  });

  it("en otra vista sin nada que cerrar, no hace nada", () => {
    useStore.setState({ view: "lista" });

    const e = tecla("Escape");

    expect(cerrarProyeccion).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it("un diálogo abierto se cierra, y el proyector sigue", () => {
    useStore.setState({ view: "lista", dialog: "help" });

    tecla("Escape");

    expect(useStore.getState().dialog).toBeNull();
    expect(cerrarProyeccion).not.toHaveBeenCalled();
  });
});

describe("las teclas de la antigua vista de Proyección", () => {
  it("→ pasa a la siguiente pista de la cola, también proyectando", () => {
    useStore.setState({ view: "lista" });

    tecla("ArrowRight");

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("B no deja el proyector en negro ni hace nada", () => {
    const e = tecla("b");

    expect(e.defaultPrevented).toBe(false);
    expect(cerrarProyeccion).not.toHaveBeenCalled();
    expect(useStore.getState().proyectando).toBe(true);
  });
});
