// Arrastrar la barra de progreso con algo en el proyector mandaba un salto a
// la salida en cada `pointermove`, decenas por segundo, y el video se veía a
// saltos en la pantalla grande. Lo que se fija aquí: arrastrando no se manda
// nada hasta soltar, y con las flechas como mucho uno cada 200 ms.

import { describe, expect, it } from "vitest";
import { INTERVALO_MS, crearBusquedaDiferida } from "../busqueda";
import type { Reloj } from "../busqueda";

/** Un reloj que solo avanza cuando el test lo dice. */
function relojFalso() {
  let t = 0;
  let siguiente = 1;
  const programados = new Map<number, { fn: () => void; en: number }>();
  const reloj: Reloj = {
    ahora: () => t,
    programar: (fn, ms) => {
      const id = siguiente++;
      programados.set(id, { fn, en: t + ms });
      return id;
    },
    cancelar: (id) => void programados.delete(id as number),
  };
  const avanzar = (ms: number) => {
    t += ms;
    for (const [id, p] of [...programados]) {
      if (p.en <= t) {
        programados.delete(id);
        p.fn();
      }
    }
  };
  return { reloj, avanzar };
}

describe("mover la barra hacia el proyector", () => {
  it("arrastrando no manda nada; al soltar, solo dónde se soltó", () => {
    const mandados: number[] = [];
    const { reloj, avanzar } = relojFalso();
    const b = crearBusquedaDiferida((f) => mandados.push(f), reloj);

    // Un arrastre de un segundo a 60 eventos por segundo.
    for (let i = 0; i <= 60; i++) {
      b.arrastrar(i / 100);
      avanzar(16);
    }
    expect(mandados).toEqual([]);

    b.soltar();
    expect(mandados).toEqual([0.6]);
    // Soltar otra vez no repite nada.
    b.soltar();
    expect(mandados).toHaveLength(1);
  });

  it("con las flechas, el primero sale en el acto y luego uno cada 200 ms", () => {
    const mandados: number[] = [];
    const { reloj, avanzar } = relojFalso();
    const b = crearBusquedaDiferida((f) => mandados.push(f), reloj);

    // Una flecha mantenida: el teclado repite cada 30 ms durante un segundo.
    let f = 0;
    for (let i = 0; i < 33; i++) {
      f += 0.01;
      b.tecla(f);
      avanzar(30);
    }
    b.soltar();

    expect(mandados[0]).toBeCloseTo(0.01);
    expect(mandados[mandados.length - 1]).toBeCloseTo(0.33);
    // 990 ms de teclas: unas cinco, no 33.
    expect(mandados.length).toBeLessThanOrEqual(Math.ceil(990 / INTERVALO_MS) + 1);
    expect(mandados.length).toBeGreaterThan(1);
  });

  it("una sola flecha llega sola, sin esperar a soltarla", () => {
    const mandados: number[] = [];
    const { reloj } = relojFalso();
    const b = crearBusquedaDiferida((f) => mandados.push(f), reloj);

    b.tecla(0.5);
    expect(mandados).toEqual([0.5]);
    b.soltar();
    expect(mandados).toEqual([0.5]);
  });
});
