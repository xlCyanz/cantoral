// Abrir Cantoral al encender el equipo. La casilla dice lo que dice el
// sistema, no lo que se pulsó: en un PC de iglesia con políticas puede que el
// sistema no haga caso, y una casilla marcada que no hace nada es peor que
// ninguna.

import { beforeEach, describe, expect, it, vi } from "vitest";

const getAutostartCmd = vi.fn<() => Promise<boolean | null>>();
const setAutostartCmd = vi.fn<(activar: boolean) => Promise<boolean>>();

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  getAutostartCmd: () => getAutostartCmd(),
  setAutostartCmd: (a: boolean) => setAutostartCmd(a),
}));

const { useStore } = await import("../../store");
const initial = useStore.getState();

beforeEach(() => {
  useStore.setState(initial, true);
  getAutostartCmd.mockReset();
  setAutostartCmd.mockReset();
});

describe("abrir con el sistema", () => {
  it("de partida no se sabe, y no se ofrece", () => {
    expect(useStore.getState().abrirConElSistema).toBeNull();
  });

  it("lee lo que dice el sistema", async () => {
    getAutostartCmd.mockResolvedValue(true);

    await useStore.getState().leerAbrirConElSistema();

    expect(useStore.getState().abrirConElSistema).toBe(true);
  });

  it("en el navegador sigue sin ofrecerse", async () => {
    getAutostartCmd.mockResolvedValue(null);

    await useStore.getState().leerAbrirConElSistema();

    expect(useStore.getState().abrirConElSistema).toBeNull();
  });

  it("si el sistema no contesta, tampoco se ofrece", async () => {
    getAutostartCmd.mockRejectedValue(new Error("registro bloqueado"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await useStore.getState().leerAbrirConElSistema();

    expect(useStore.getState().abrirConElSistema).toBeNull();
  });

  it("encenderlo deja la casilla como la dejó el sistema", async () => {
    setAutostartCmd.mockResolvedValue(true);

    await useStore.getState().setAbrirConElSistema(true);

    expect(setAutostartCmd).toHaveBeenCalledWith(true);
    expect(useStore.getState().abrirConElSistema).toBe(true);
    expect(useStore.getState().cambiandoAbrirConElSistema).toBe(false);
    expect(useStore.getState().toast).toBeNull();
  });

  it("si el sistema no hace caso, la casilla no miente y se avisa", async () => {
    setAutostartCmd.mockResolvedValue(false);

    await useStore.getState().setAbrirConElSistema(true);

    expect(useStore.getState().abrirConElSistema).toBe(false);
    expect(useStore.getState().toast?.titulo).toBe("El sistema no dejó cambiarlo");
  });

  it("un fallo se dice y la casilla se queda como estaba", async () => {
    useStore.setState({ abrirConElSistema: false });
    setAutostartCmd.mockRejectedValue(new Error("acceso denegado"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await useStore.getState().setAbrirConElSistema(true);

    expect(useStore.getState().abrirConElSistema).toBe(false);
    expect(useStore.getState().toast?.type).toBe("error");
    expect(useStore.getState().toast?.detalle).toContain("acceso denegado");
  });

  it("no se guarda con las preferencias de la interfaz", async () => {
    const { serialisePrefs } = await import("../uiPrefs");
    useStore.setState({ abrirConElSistema: true });

    expect(serialisePrefs(useStore.getState())).not.toContain("abrirConElSistema");
  });
});
