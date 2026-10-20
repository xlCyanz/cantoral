// Una canción no vuelve a sonar sin que se haya pedido (pedido de la iglesia).
// Sin «Repetir», la cola se acaba; en aleatorio, cada una suena una vez antes de
// poder volver a salir; «Repetir la lista» y «Repetir la canción» son lo único
// que hace sonar algo otra vez.

import { beforeEach, describe, expect, it } from "vitest";
import { anterior, siguiente, siguienteModo } from "../cola";
import { parsePrefs } from "../uiPrefs";
import { useStore } from "../../store";

const COLA = ["a", "b", "c", "d"];

describe("el botón de repetir", () => {
  it("recorre sin repetir → la lista → la canción → sin repetir", () => {
    expect(siguienteModo("no")).toBe("lista");
    expect(siguienteModo("lista")).toBe("una");
    expect(siguienteModo("una")).toBe("no");
  });

  it("lo guardado antes como sí/no se entiende", () => {
    expect(parsePrefs(JSON.stringify({ repeat: true }))).toEqual({ repeat: "una" });
    expect(parsePrefs(JSON.stringify({ repeat: false }))).toEqual({ repeat: "no" });
    expect(parsePrefs(JSON.stringify({ repeat: "lista" }))).toEqual({ repeat: "lista" });
    expect(parsePrefs(JSON.stringify({ repeat: "todo" }))).toEqual({});
  });
});

describe("en orden", () => {
  const op = (repetir: "no" | "lista" | "una") => ({ aleatorio: false, repetir, sonadas: [] });

  it("sin repetir, la cola se acaba en la última", () => {
    expect(siguiente(COLA, "c", op("no")).id).toBe("d");
    expect(siguiente(COLA, "d", op("no")).id).toBeNull();
  });

  it("con «Repetir la lista», vuelve a la primera", () => {
    expect(siguiente(COLA, "d", op("lista")).id).toBe("a");
  });

  it("hacia atrás, en la primera no da la vuelta salvo repitiendo la lista", () => {
    expect(anterior(COLA, "a", "no")).toBe("a");
    expect(anterior(COLA, "a", "lista")).toBe("d");
    expect(anterior(COLA, "c", "no")).toBe("b");
  });
});

describe("en aleatorio", () => {
  it("cada canción suena una vez antes de que se acabe la vuelta", () => {
    let actual = "a";
    let sonadas: string[] = [];
    const vistas = [actual];
    for (let i = 0; i < COLA.length - 1; i++) {
      const p = siguiente(COLA, actual, { aleatorio: true, repetir: "no", sonadas });
      expect(p.id).not.toBeNull();
      expect(vistas).not.toContain(p.id);
      vistas.push(p.id!);
      actual = p.id!;
      sonadas = p.sonadas;
    }
    expect(new Set(vistas)).toEqual(new Set(COLA));
    // Ya sonaron todas: sin repetir, se acaba.
    expect(siguiente(COLA, actual, { aleatorio: true, repetir: "no", sonadas }).id).toBeNull();
  });

  it("con «Repetir la lista» empieza otra vuelta, sin repetir la que acaba de sonar", () => {
    const p = siguiente(COLA, "d", { aleatorio: true, repetir: "lista", sonadas: ["a", "b", "c"] }, () => 0);
    expect(p.id).not.toBe("d");
    expect(p.sonadas).toEqual([p.id]);
  });
});

describe("el reproductor", () => {
  const inicial = useStore.getState();
  beforeEach(() => useStore.setState(inicial, true));

  it("al acabarse la última, se para en vez de volver a empezar", () => {
    useStore.setState({ playerId: "b", playing: true, queue: ["a", "b"], repeat: "no", shuffle: false });
    useStore.getState().advance();

    expect(useStore.getState().playerId).toBe("b");
    expect(useStore.getState().playing).toBe(false);
  });

  it("con «Repetir la canción», la vuelve a poner desde el principio", () => {
    useStore.setState({ playerId: "b", playing: true, posSec: 120, queue: ["a", "b"], repeat: "una" });
    useStore.getState().advance();

    expect(useStore.getState().playerId).toBe("b");
    expect(useStore.getState().posSec).toBe(0);
    expect(useStore.getState().playing).toBe(true);
  });

  it("el botón pasa por los tres modos", () => {
    useStore.getState().toggleRepeat();
    expect(useStore.getState().repeat).toBe("lista");
    useStore.getState().toggleRepeat();
    expect(useStore.getState().repeat).toBe("una");
    useStore.getState().toggleRepeat();
    expect(useStore.getState().repeat).toBe("no");
  });
});
