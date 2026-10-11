// Preparación de las pruebas: la base en memoria del navegador.
//
// La app la carga aparte (ver `cargarNavegador`), y las pruebas que corren
// sin Tauri la necesitan igual. En un `beforeAll` y con import dinámico a
// propósito: así se carga después de los `vi.mock` de cada archivo de
// pruebas, sobre los mismos módulos que ellos ya simularon.

import { beforeAll } from "vitest";

beforeAll(async () => {
  const { cargarNavegador } = await import("./index");
  await cargarNavegador();
});
