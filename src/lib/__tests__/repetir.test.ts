// Copiar el culto equivocado es peor que no ofrecer el atajo: el usuario
// confía en que «repetir» trae el repertorio del domingo pasado, no el de un
// domingo cualquiera ni el que todavía está preparando.

import { describe, expect, it } from "vitest";
import { ultimaPorOcasion } from "../repetir";

const hoy = new Date(2026, 0, 11); // domingo 11 de enero de 2026

describe("ultimaPorOcasion", () => {
  it("trae la última de cada ocasión, no la primera", () => {
    const listas = [
      { id: "a", ocasion: "Servicio dominical", fecha: "2025-12-28" },
      { id: "b", ocasion: "Servicio dominical", fecha: "2026-01-04" },
      { id: "c", ocasion: "Ensayo", fecha: "2026-01-07" },
    ];

    expect(ultimaPorOcasion(listas, hoy).map((r) => [r.ocasion, r.lista.id])).toEqual([
      ["Ensayo", "c"],
      ["Servicio dominical", "b"],
    ]);
  });

  it("no ofrece un culto que todavía no ha pasado", () => {
    // El domingo que viene es el que se está armando; repetirlo no es repetir.
    const listas = [{ id: "a", ocasion: "Servicio dominical", fecha: "2026-01-18" }];

    expect(ultimaPorOcasion(listas, hoy)).toEqual([]);
  });

  it("el culto de hoy sí cuenta", () => {
    const listas = [{ id: "a", ocasion: "Servicio dominical", fecha: "2026-01-11" }];

    expect(ultimaPorOcasion(listas, hoy).map((r) => r.lista.id)).toEqual(["a"]);
  });

  it("prefiere el pasado más reciente aunque haya uno futuro", () => {
    const listas = [
      { id: "viejo", ocasion: "Comunión", fecha: "2025-11-02" },
      { id: "futuro", ocasion: "Comunión", fecha: "2026-02-01" },
      { id: "ultimo", ocasion: "Comunión", fecha: "2026-01-04" },
    ];

    expect(ultimaPorOcasion(listas, hoy).map((r) => r.lista.id)).toEqual(["ultimo"]);
  });

  it("deja fuera lo que no tiene fecha legible", () => {
    // Entre dos fechas ilegibles no hay forma de saber cuál fue la última.
    const listas = [
      { id: "a", ocasion: "Adoración especial", fecha: "el viernes de Pascua" },
      { id: "b", ocasion: "Adoración especial" },
    ];

    expect(ultimaPorOcasion(listas, hoy)).toEqual([]);
  });

  it("deja fuera lo que no tiene ocasión", () => {
    const listas = [
      { id: "a", ocasion: "", fecha: "2026-01-04" },
      { id: "b", ocasion: "   ", fecha: "2026-01-04" },
      { id: "c", fecha: "2026-01-04" },
    ];

    expect(ultimaPorOcasion(listas, hoy)).toEqual([]);
  });

  it("no ofrece repetir una plantilla", () => {
    // Una plantilla ya se usa desde «Nueva lista»; no es un culto celebrado.
    const listas = [
      { id: "p", ocasion: "Servicio dominical", fecha: "2026-01-04", plantilla: true },
      { id: "c", ocasion: "Servicio dominical", fecha: "2025-12-28", plantilla: false },
    ];

    expect(ultimaPorOcasion(listas, hoy).map((r) => r.lista.id)).toEqual(["c"]);
  });

  it("con dos listas del mismo día se queda con la primera que le dan", () => {
    // El backend entrega las listas ordenadas; empatar en fecha no debe hacer
    // que el atajo cambie de lista entre dos lecturas.
    const listas = [
      { id: "primera", ocasion: "Ensayo", fecha: "2026-01-07" },
      { id: "segunda", ocasion: "Ensayo", fecha: "2026-01-07" },
    ];

    expect(ultimaPorOcasion(listas, hoy).map((r) => r.lista.id)).toEqual(["primera"]);
  });

  it("aguanta no tener ninguna lista", () => {
    expect(ultimaPorOcasion([], hoy)).toEqual([]);
  });
});
