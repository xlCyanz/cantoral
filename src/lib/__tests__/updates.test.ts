// La comprobación al arrancar es callada a propósito: una app que interrumpe
// cada vez que se abre para decir que no pasa nada es una app que se aprende a
// ignorar, y entonces tampoco se lee el aviso que sí importa. El botón, en
// cambio, siempre contesta: silencio después de pulsar se lee como avería.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UpdateCheck, UpdateProgress } from "../api";

const checkForUpdateCmd = vi.fn<() => Promise<UpdateCheck>>();
const installUpdateCmd = vi.fn<() => Promise<void>>();
const onUpdateProgress = vi.fn<(cb: (p: UpdateProgress) => void) => Promise<() => void>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  checkForUpdateCmd: () => checkForUpdateCmd(),
  installUpdateCmd: () => installUpdateCmd(),
  onUpdateProgress: (cb: (p: UpdateProgress) => void) => onUpdateProgress(cb),
}));

const { useStore } = await import("../../store");
const initial = useStore.getState();

const DISPONIBLE: UpdateCheck = {
  estado: "disponible",
  version: "9.9.9",
  notas: "Arregla lo del atril",
  fecha: "2026-09-21T12:00:00Z",
};

/** Lo que el listener de progreso hará al suscribirse. */
let emitirProgreso: ((p: UpdateProgress) => void) | null = null;
const parar = vi.fn();

beforeEach(() => {
  useStore.setState(initial, true);
  [checkForUpdateCmd, installUpdateCmd, onUpdateProgress, parar].forEach((m) => m.mockReset());
  checkForUpdateCmd.mockResolvedValue({ estado: "alDia" });
  installUpdateCmd.mockReturnValue(new Promise(() => {}));
  emitirProgreso = null;
  onUpdateProgress.mockImplementation((cb) => {
    emitirProgreso = cb;
    return Promise.resolve(parar);
  });
});

describe("buscar actualizaciones", () => {
  it("al arrancar no dice nada si estás al día", async () => {
    await useStore.getState().checkForUpdate();

    expect(useStore.getState().update).toEqual({ estado: "alDia" });
    expect(useStore.getState().toast).toBeNull();
  });

  it("pero el botón siempre contesta", async () => {
    await useStore.getState().checkForUpdate(true);

    expect(useStore.getState().toast?.message).toContain("al día");
  });

  it("una compilación sin clave lo dice en vez de fingir que está al día", async () => {
    checkForUpdateCmd.mockResolvedValue({ estado: "sinConfigurar" });

    await useStore.getState().checkForUpdate(true);

    expect(useStore.getState().update).toEqual({ estado: "sinConfigurar" });
    expect(useStore.getState().toast?.message).toContain("no trae actualizaciones");
  });

  it("y callada tampoco molesta con eso", async () => {
    checkForUpdateCmd.mockResolvedValue({ estado: "sinConfigurar" });

    await useStore.getState().checkForUpdate();

    expect(useStore.getState().toast).toBeNull();
  });

  it("guarda la versión y las notas cuando hay algo", async () => {
    checkForUpdateCmd.mockResolvedValue(DISPONIBLE);

    await useStore.getState().checkForUpdate();

    expect(useStore.getState().update).toEqual(DISPONIBLE);
    // Tampoco interrumpe: lo que hay se ve al entrar en Configuración.
    expect(useStore.getState().toast).toBeNull();
  });

  it("si la comprobación falla lo recuerda, y solo avisa si se pidió", async () => {
    checkForUpdateCmd.mockRejectedValue(new Error("sin internet"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await useStore.getState().checkForUpdate();
    expect(useStore.getState().updateState).toBe("error");
    expect(useStore.getState().updateError).toContain("sin internet");
    expect(useStore.getState().toast).toBeNull();

    await useStore.getState().checkForUpdate(true);
    expect(useStore.getState().toast?.type).toBe("error");
  });

  it("no comprueba mientras se está descargando", async () => {
    checkForUpdateCmd.mockResolvedValue(DISPONIBLE);
    await useStore.getState().checkForUpdate();
    useStore.getState().installUpdate();
    checkForUpdateCmd.mockClear();

    await useStore.getState().checkForUpdate(true);

    expect(checkForUpdateCmd).not.toHaveBeenCalled();
  });
});

describe("instalar", () => {
  async function conActualizacion() {
    checkForUpdateCmd.mockResolvedValue(DISPONIBLE);
    await useStore.getState().checkForUpdate();
  }

  it("no instala nada si no hay nada que instalar", () => {
    useStore.getState().installUpdate();

    expect(installUpdateCmd).not.toHaveBeenCalled();
    expect(useStore.getState().updateState).toBe("idle");
  });

  it("baja la actualización y lo cuenta mientras tanto", async () => {
    await conActualizacion();

    useStore.getState().installUpdate();

    expect(installUpdateCmd).toHaveBeenCalled();
    expect(useStore.getState().updateState).toBe("downloading");
    await vi.waitFor(() => expect(emitirProgreso).not.toBeNull());
    emitirProgreso!({ descargado: 1024, total: 4096 });
    expect(useStore.getState().updateProgress).toEqual({ descargado: 1024, total: 4096 });
  });

  it("dos pulsaciones no lanzan dos descargas", async () => {
    await conActualizacion();

    useStore.getState().installUpdate();
    useStore.getState().installUpdate();

    expect(installUpdateCmd).toHaveBeenCalledTimes(1);
  });

  it("si falla lo dice, suelta el listener y deja volver a intentarlo", async () => {
    await conActualizacion();
    installUpdateCmd.mockRejectedValue(new Error("disco lleno"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    useStore.getState().installUpdate();

    await vi.waitFor(() => expect(useStore.getState().updateState).toBe("error"));
    expect(useStore.getState().toast?.type).toBe("error");
    expect(useStore.getState().updateProgress).toBeNull();
    // El listener del progreso no se queda colgado hasta que cierren la app.
    await vi.waitFor(() => expect(parar).toHaveBeenCalled());
    // Y la actualización sigue ahí para reintentarla.
    expect(useStore.getState().update).toEqual(DISPONIBLE);
  });
});
