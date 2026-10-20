// Al abrir, la app no se pinta primero en claro y con el orden de fábrica
// para cambiar un momento después: el tema del último dibujo se guarda para
// el primero, y los ajustes se aplican en cuanto llegan, sin esperar al
// catálogo.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Snapshot } from "../api";
import { CLAVE_TEMA, guardarTema, leerTemaGuardado } from "../temaGuardado";

/** Un `localStorage` de mentira: las pruebas corren sin navegador. */
function almacen(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    datos,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("el tema guardado", () => {
  it("se lee lo que se guardó", () => {
    const a = almacen();
    vi.stubGlobal("localStorage", a);
    guardarTema("dark");
    expect(a.datos.get(CLAVE_TEMA)).toBe("dark");
    expect(leerTemaGuardado()).toBe("dark");
  });

  it("lo que no es un tema, o un almacenamiento que no está o que falla, no es nada", () => {
    vi.stubGlobal("localStorage", almacen({ [CLAVE_TEMA]: "sepia" }));
    expect(leerTemaGuardado()).toBeNull();
    vi.stubGlobal("localStorage", undefined);
    expect(leerTemaGuardado()).toBeNull();
    expect(() => guardarTema("light")).not.toThrow();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    expect(leerTemaGuardado()).toBeNull();
    expect(() => guardarTema("dark")).not.toThrow();
  });

  it("el store empieza con él, y apunta el tema cada vez que cambia", async () => {
    const a = almacen({ [CLAVE_TEMA]: "dark" });
    vi.stubGlobal("localStorage", a);
    const { useStore } = await import("../../store");
    expect(useStore.getState().theme).toBe("dark");

    useStore.setState({ theme: "light" });
    expect(a.datos.get(CLAVE_TEMA)).toBe("light");
  });
});

describe("los ajustes al arrancar", () => {
  beforeEach(() => vi.stubGlobal("localStorage", almacen()));

  it("se aplican antes de que llegue el catálogo", async () => {
    const { useStore } = await import("../../store");
    const { usarBackend } = await import("../backend");
    const { crearMemoria } = await import("../backend/memoria");
    const memoria = crearMemoria({ tracks: [], folders: [], playlists: [] });
    await memoria.setSetting("themeMode", "dark");
    await memoria.setSetting("ui", JSON.stringify({ sortKey: "album", sortDir: "desc", view: "config" }));
    let soltar: (s: Snapshot) => void = () => {};
    const catalogo = new Promise<Snapshot>((r) => (soltar = r));
    usarBackend({ ...memoria, getLibrary: () => catalogo });

    const arranque = useStore.getState().hydrate();
    await vi.waitFor(() => expect(useStore.getState().theme).toBe("dark"));
    const s = useStore.getState();
    expect(s.themeMode).toBe("dark");
    expect(s.sortKey).toBe("album");
    expect(s.sortDir).toBe("desc");
    expect(s.view).toBe("config");
    expect(s.libState).not.toBe("content");

    soltar({ tracks: [], folders: [], playlists: [] });
    await arranque;
    expect(useStore.getState().view).toBe("config");
    usarBackend(null);
  });

  it("una lista guardada espera al catálogo, que dice si sigue existiendo", async () => {
    const { useStore } = await import("../../store");
    const { usarBackend } = await import("../backend");
    const { crearMemoria } = await import("../backend/memoria");
    const memoria = crearMemoria({ tracks: [], folders: [], playlists: [] });
    await memoria.setSetting("ui", JSON.stringify({ view: "lista", curPlaylist: "p9" }));
    let soltar: (s: Snapshot) => void = () => {};
    const catalogo = new Promise<Snapshot>((r) => (soltar = r));
    usarBackend({ ...memoria, getLibrary: () => catalogo });

    const arranque = useStore.getState().hydrate();
    await new Promise((r) => setTimeout(r, 0));
    expect(useStore.getState().view).toBe("biblioteca");

    soltar({ tracks: [], folders: [], playlists: [{ id: "p9", nombre: "Domingo", ids: [], tocada: "" }] });
    await arranque;
    expect(useStore.getState().view).toBe("lista");
    expect(useStore.getState().curPlaylist).toBe("p9");
    usarBackend(null);
  });
});
