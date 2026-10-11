// El log de un PC de iglesia tiene que decir cuánto tardó la biblioteca en
// verse al abrir la app: una vez por arranque, después de pintarla.

import { describe, expect, it, vi } from "vitest";
import type { Reconciliacion, Snapshot } from "../api";

const registrar = vi.fn<(nivel: string, mensaje: string) => void>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  registrar: (nivel: string, mensaje: string) => registrar(nivel, mensaje),
  getSetting: () => Promise.resolve(null),
  setSetting: () => Promise.resolve(),
  getLibrary: (): Promise<Snapshot> => Promise.resolve({ tracks: [], folders: [], playlists: [] }),
  reconcileLibraryCmd: (): Promise<Reconciliacion> => Promise.resolve({ cambiados: [] }),
}));

const { useStore } = await import("../../store");

describe("el primer dibujo", () => {
  it("se apunta una vez, después de pintar la biblioteca", async () => {
    const cuadros: (() => void)[] = [];
    vi.stubGlobal("requestAnimationFrame", (fn: () => void) => cuadros.push(fn));
    const lineas = () => registrar.mock.calls.filter(([, m]) => m.startsWith("first paint")).length;

    await useStore.getState().hydrate();
    expect(lineas()).toBe(0);
    cuadros.splice(0).forEach((fn) => fn());
    await new Promise((r) => setTimeout(r, 0));
    expect(lineas()).toBe(1);

    // Un reintento de `hydrate` no es otro arranque.
    await useStore.getState().hydrate();
    cuadros.splice(0).forEach((fn) => fn());
    await new Promise((r) => setTimeout(r, 0));
    expect(lineas()).toBe(1);
    vi.unstubAllGlobals();
  });
});
