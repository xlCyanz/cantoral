// La ventana de salida mandaba un evento a todas las ventanas en cada
// `timeupdate`, unas cuatro veces por segundo. Lo que se fija aquí: un evento
// por segundo entero, y siempre el final, los fallos, la pausa y el arranque.

import { describe, expect, it } from "vitest";
import type { EstadoProyeccion } from "../api";
import { hayQueReportar } from "../estadoDeSalida";

const estado = (over: Partial<EstadoProyeccion> = {}): EstadoProyeccion => ({ src: "/v.mp4", pos: 10, dur: 200, fin: false, ...over });

describe("qué cuenta la salida a la principal", () => {
  it("diez segundos de timeupdate a 4 Hz son diez avisos, no cuarenta", () => {
    let anterior: EstadoProyeccion | null = null;
    let avisos = 0;
    for (let i = 0; i < 40; i++) {
      const e = estado({ pos: Math.floor(30 + i * 0.25) });
      if (hayQueReportar(anterior, e)) {
        avisos++;
        anterior = e;
      }
    }
    expect(avisos).toBe(10);
  });

  it("el primero, otro archivo u otra duración siempre se cuentan", () => {
    expect(hayQueReportar(null, estado())).toBe(true);
    expect(hayQueReportar(estado(), estado({ src: "/otro.mp4" }))).toBe(true);
    expect(hayQueReportar(estado(), estado({ dur: 201 }))).toBe(true);
  });

  it("el final, un fallo, la pausa y el arranque llegan aunque el segundo sea el mismo", () => {
    expect(hayQueReportar(estado(), estado({ fin: true }))).toBe(true);
    expect(hayQueReportar(estado(), estado({ error: 4 }))).toBe(true);
    expect(hayQueReportar(estado(), estado(), true)).toBe(true);
    expect(hayQueReportar(estado(), estado())).toBe(false);
  });
});
