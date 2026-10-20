// El tamaño de la interfaz: tres escalones, «Grande» de fábrica, recordado con
// el resto de las preferencias y en el almacenamiento del webview para el
// primer dibujo, con Ctrl/⌘ + y − para cambiarlo, y encajado en la ventana
// para que «Muy grande» nunca deje la app sin sitio.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const fijarZoom = vi.fn<(f: number) => Promise<void>>(() => Promise.resolve());
const tamanoDeLaVentana = vi.fn<() => Promise<{ ancho: number; alto: number } | null>>(() =>
  Promise.resolve({ ancho: 1200, alto: 800 }),
);

// Como dentro de la app: el zoom solo se pide en Tauri.
vi.mock("../registro", () => ({ isTauri: () => true, registrar: () => {} }));
vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  registrar: () => {},
  fijarZoom: (f: number) => fijarZoom(f),
  tamanoDeLaVentana: () => tamanoDeLaVentana(),
}));

/** Un `localStorage` de mentira: las pruebas corren sin navegador. */
function almacen(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    datos,
  };
}
const guardado = almacen();
vi.stubGlobal("localStorage", guardado);

const tamano = await import("../tamano");
const { parsePrefs, serialisePrefs } = await import("../uiPrefs");
const { useStore } = await import("../../store");
const { registerShortcuts } = await import("../shortcuts");
const {
  CLAVE_TAMANO,
  TAMANOS,
  TAMANO_DE_FABRICA,
  aplicarTamano,
  atajoDeTamano,
  escalonar,
  factorDe,
  factorQueCabe,
  guardarTamano,
  leerTamanoGuardado,
  _reiniciarTamano,
} = tamano;
const initial = useStore.getState();

/** Esperar a que la fila de zooms se vacíe. */
const enCola = () => new Promise((r) => setTimeout(r, 0));

describe("los tamaños", () => {
  it("son tres, de menor a mayor, y el de fábrica es «Grande»", () => {
    expect(TAMANOS.map((t) => t.valor)).toEqual(["normal", "grande", "muyGrande"]);
    expect(TAMANO_DE_FABRICA).toBe("grande");
    expect(factorDe("normal")).toBe(1);
    expect(factorDe("grande")).toBeGreaterThan(1);
    expect(factorDe("muyGrande")).toBeGreaterThan(factorDe("grande"));
  });

  it("se sube y se baja de uno en uno, sin pasarse de los extremos", () => {
    expect(escalonar("normal", 1)).toBe("grande");
    expect(escalonar("grande", 1)).toBe("muyGrande");
    expect(escalonar("muyGrande", 1)).toBe("muyGrande");
    expect(escalonar("muyGrande", -1)).toBe("grande");
    expect(escalonar("normal", -1)).toBe("normal");
  });
});

describe("encajar el zoom en la ventana", () => {
  it("en una ventana holgada se aplica el del tamaño elegido", () => {
    expect(factorQueCabe(factorDe("muyGrande"), 1200, 800)).toBe(factorDe("muyGrande"));
    expect(factorQueCabe(factorDe("grande"), 1920, 1040)).toBe(factorDe("grande"));
  });

  it("en la ventana mínima (940 × 640) «Grande» cabe entero y «Muy grande» crece lo que cabe", () => {
    expect(factorQueCabe(factorDe("grande"), 940, 640)).toBe(factorDe("grande"));
    const f = factorQueCabe(factorDe("muyGrande"), 940, 640);
    expect(f).toBeGreaterThanOrEqual(factorDe("grande"));
    expect(f).toBeLessThan(factorDe("muyGrande"));
    // Y a la página le queda al menos el hueco mínimo.
    expect(940 / f).toBeGreaterThanOrEqual(tamano.HUECO_MINIMO.ancho);
    expect(640 / f).toBeGreaterThanOrEqual(tamano.HUECO_MINIMO.alto);
  });

  it("nunca baja de «Normal», por pequeña que sea la ventana", () => {
    expect(factorQueCabe(factorDe("muyGrande"), 500, 300)).toBe(1);
    expect(factorQueCabe(1, 500, 300)).toBe(1);
  });

  it("sin medidas de la ventana, el del tamaño tal cual", () => {
    expect(factorQueCabe(1.35, 0, 0)).toBe(1.35);
    expect(factorQueCabe(1.35, Number.NaN, 800)).toBe(1.35);
  });

  it("se redondea a la centésima, hacia abajo", () => {
    const f = factorQueCabe(2, 1003, 2000);
    expect(f).toBe(Math.floor((1003 / tamano.HUECO_MINIMO.ancho) * 100) / 100);
  });
});

describe("aplicar el tamaño", () => {
  beforeEach(() => {
    _reiniciarTamano();
    fijarZoom.mockClear();
    tamanoDeLaVentana.mockClear();
    tamanoDeLaVentana.mockImplementation(() => Promise.resolve({ ancho: 1200, alto: 800 }));
  });

  it("pide al webview el zoom encajado, y no vuelve a pedir el mismo", async () => {
    await aplicarTamano("muyGrande");
    expect(fijarZoom).toHaveBeenLastCalledWith(factorDe("muyGrande"));
    await aplicarTamano("muyGrande");
    expect(fijarZoom).toHaveBeenCalledTimes(1);
  });

  it("el primero se pide siempre, aunque sea «Normal»", async () => {
    await aplicarTamano("normal");
    expect(fijarZoom).toHaveBeenCalledWith(1);
  });

  it("en fila: el último pedido es el que se queda", async () => {
    void aplicarTamano("muyGrande");
    void aplicarTamano("normal");
    await aplicarTamano("grande");
    expect(fijarZoom.mock.calls.map(([f]) => f)).toEqual([factorDe("muyGrande"), 1, factorDe("grande")]);
  });

  it("si la ventana o el zoom fallan, no falla hacia arriba", async () => {
    tamanoDeLaVentana.mockImplementationOnce(() => Promise.reject(new Error("sin ventana")));
    await expect(aplicarTamano("grande")).resolves.toBeUndefined();
    fijarZoom.mockImplementationOnce(() => Promise.reject(new Error("sin permiso")));
    await expect(aplicarTamano("muyGrande")).resolves.toBeUndefined();
  });
});

describe("el tamaño guardado para el primer dibujo", () => {
  it("se lee lo que se guardó, y lo que no es un tamaño no es nada", () => {
    guardarTamano("normal");
    expect(guardado.datos.get(CLAVE_TAMANO)).toBe("normal");
    expect(leerTamanoGuardado()).toBe("normal");
    guardado.datos.set(CLAVE_TAMANO, "enorme");
    expect(leerTamanoGuardado()).toBeNull();
  });

  it("un almacenamiento que no está o que falla no rompe nada", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(leerTamanoGuardado()).toBeNull();
    expect(() => guardarTamano("grande")).not.toThrow();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    expect(leerTamanoGuardado()).toBeNull();
    expect(() => guardarTamano("grande")).not.toThrow();
    vi.stubGlobal("localStorage", guardado);
  });
});

describe("el tamaño en las preferencias", () => {
  it("viaja con el resto y vuelve igual", () => {
    const prefs = parsePrefs(serialisePrefs({ ...useStore.getState(), tamanoUi: "muyGrande" }));
    expect(prefs.tamanoUi).toBe("muyGrande");
  });

  it("lo que no es un tamaño se descarta y queda el de fábrica", () => {
    expect(parsePrefs(JSON.stringify({ tamanoUi: "enorme" })).tamanoUi).toBeUndefined();
    expect(parsePrefs(JSON.stringify({ tamanoUi: 1.2 })).tamanoUi).toBeUndefined();
    expect(parsePrefs(JSON.stringify({ tamanoUi: null })).tamanoUi).toBeUndefined();
    // Las preferencias de una versión sin tamaño no lo traen.
    expect("tamanoUi" in parsePrefs(JSON.stringify({ volume: 0.5 }))).toBe(false);
  });

  it("el store empieza en «Grande» sin nada guardado", () => {
    expect(initial.tamanoUi).toBe("grande");
  });

  it("cambiarlo lo apunta para el próximo arranque y lo aplica", async () => {
    _reiniciarTamano();
    fijarZoom.mockClear();
    useStore.setState({ tamanoUi: "grande" });
    useStore.getState().setTamanoUi("muyGrande");
    expect(guardado.datos.get(CLAVE_TAMANO)).toBe("muyGrande");
    await enCola();
    await enCola();
    expect(fijarZoom).toHaveBeenLastCalledWith(factorDe("muyGrande"));
  });

  it("un escalón arriba, abajo, y 0 vuelve al de fábrica", () => {
    useStore.setState({ tamanoUi: "normal" });
    useStore.getState().cambiarTamanoUi(1);
    expect(useStore.getState().tamanoUi).toBe("grande");
    useStore.getState().cambiarTamanoUi(1);
    useStore.getState().cambiarTamanoUi(1);
    expect(useStore.getState().tamanoUi).toBe("muyGrande");
    useStore.getState().cambiarTamanoUi(0);
    expect(useStore.getState().tamanoUi).toBe("grande");
    useStore.getState().cambiarTamanoUi(-1);
    useStore.getState().cambiarTamanoUi(-1);
    expect(useStore.getState().tamanoUi).toBe("normal");
  });
});

describe("los atajos", () => {
  const tecla = (key: string, extra: Partial<KeyboardEvent> = {}) => ({ key, code: "", ctrlKey: false, metaKey: false, altKey: false, ...extra });

  it("Ctrl/⌘ + agranda, en el teclado español, el inglés y el numérico", () => {
    expect(atajoDeTamano(tecla("+", { ctrlKey: true }))).toBe(1);
    expect(atajoDeTamano(tecla("=", { ctrlKey: true }))).toBe(1);
    expect(atajoDeTamano(tecla("+", { metaKey: true }))).toBe(1);
    expect(atajoDeTamano(tecla("Add", { ctrlKey: true, code: "NumpadAdd" }))).toBe(1);
  });

  it("Ctrl/⌘ − achica y Ctrl/⌘ 0 vuelve al de fábrica", () => {
    expect(atajoDeTamano(tecla("-", { ctrlKey: true }))).toBe(-1);
    expect(atajoDeTamano(tecla("Subtract", { metaKey: true, code: "NumpadSubtract" }))).toBe(-1);
    expect(atajoDeTamano(tecla("0", { ctrlKey: true }))).toBe(0);
    expect(atajoDeTamano(tecla("0", { metaKey: true, code: "Numpad0" }))).toBe(0);
  });

  it("sin Ctrl/⌘, o con Alt (AltGr escribe), no es un atajo", () => {
    expect(atajoDeTamano(tecla("+"))).toBeNull();
    expect(atajoDeTamano(tecla("-"))).toBeNull();
    expect(atajoDeTamano(tecla("0"))).toBeNull();
    expect(atajoDeTamano(tecla("+", { ctrlKey: true, altKey: true }))).toBeNull();
    expect(atajoDeTamano(tecla("f", { ctrlKey: true }))).toBeNull();
  });

  describe("registrados", () => {
    let quitar: () => void;
    beforeAll(() => {
      vi.stubGlobal("document", new EventTarget());
      quitar = registerShortcuts();
    });
    afterAll(() => {
      quitar();
      vi.stubGlobal("document", undefined);
    });

    function pulsar(key: string, extra: Record<string, unknown> = {}) {
      const e = new Event("keydown", { cancelable: true });
      Object.assign(e, { key, code: "", ctrlKey: true, metaKey: false, altKey: false, ...extra });
      document.dispatchEvent(e);
      return e;
    }

    it("cambian el tamaño y se quedan con la tecla, también con un diálogo abierto", () => {
      useStore.setState({ tamanoUi: "grande", dialog: "help" });
      const e = pulsar("+");
      expect(e.defaultPrevented).toBe(true);
      expect(useStore.getState().tamanoUi).toBe("muyGrande");
      pulsar("-");
      pulsar("-");
      expect(useStore.getState().tamanoUi).toBe("normal");
      pulsar("0");
      expect(useStore.getState().tamanoUi).toBe("grande");
      useStore.setState({ dialog: null });
    });
  });
});

describe("la ventana minimizada", () => {
  it("mide 0 × 0 y no cambia el zoom", async () => {
    _reiniciarTamano();
    await aplicarTamano("grande");
    fijarZoom.mockClear();
    tamanoDeLaVentana.mockImplementationOnce(() => Promise.resolve({ ancho: 0, alto: 0 }));
    await aplicarTamano("muyGrande");
    expect(fijarZoom).not.toHaveBeenCalled();
  });
});

describe("antes del primer dibujo", () => {
  it("si el núcleo no contesta, no deja la app sin pintar", async () => {
    _reiniciarTamano();
    vi.useFakeTimers();
    tamanoDeLaVentana.mockImplementationOnce(() => new Promise(() => {}));
    const listo = vi.fn();
    void tamano.aplicarTamanoGuardado().then(listo);
    await vi.advanceTimersByTimeAsync(350);
    expect(listo).toHaveBeenCalled();
    vi.useRealTimers();
    _reiniciarTamano();
  });
});
