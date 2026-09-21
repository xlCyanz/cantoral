// Los mismos casos que `db::tests::nombre_copia_*` en Rust. Si esta regla y
// la de allá dejan de coincidir, el modo navegador deja de mostrar lo que hace
// la app de verdad.

import { describe, expect, it } from "vitest";
import { nombreDeCopia } from "../copias";

describe("nombreDeCopia", () => {
  it("quita el sufijo antes de volver a ponerlo", () => {
    expect(nombreDeCopia("Culto", [])).toBe("Culto (copia)");
    expect(nombreDeCopia("Culto (copia)", [])).toBe("Culto (copia)");
    expect(nombreDeCopia("Culto (copia 7)", [])).toBe("Culto (copia)");
  });

  it("no confunde una palabra con el sufijo", () => {
    expect(nombreDeCopia("Culto (copiado)", [])).toBe("Culto (copiado) (copia)");
    expect(nombreDeCopia("Culto (copia dos)", [])).toBe("Culto (copia dos) (copia)");
  });

  it("salta los nombres ya ocupados", () => {
    expect(nombreDeCopia("Culto", ["Culto (copia)", "Culto (copia 2)"])).toBe("Culto (copia 3)");
  });

  it("compara sin los espacios de los bordes", () => {
    expect(nombreDeCopia("  Culto  ", ["Culto (copia) "])).toBe("Culto (copia 2)");
  });
});
