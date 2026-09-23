// Un aviso de error tiene que llegarle a un lector de pantalla aunque nadie
// esté mirando la esquina: por eso `alert` y `assertive`. Los demás son
// `status` y `polite`, para no cortar lo que se esté leyendo.
//
// El icono se fue con el rediseño: ahora es un punto del color del tipo, que
// a 8 px dice lo mismo sin competir con el titular.

import { describe, expect, it } from "vitest";
import { toastPresentation } from "../Toast";

describe("Toast", () => {
  it("un error interrumpe, y en rojo", () => {
    expect(toastPresentation("error")).toEqual({
      color: "var(--danger)",
      role: "alert",
      ariaLive: "assertive",
    });
  });

  it("lo que salió bien no interrumpe", () => {
    expect(toastPresentation("success")).toEqual({
      color: "var(--success)",
      role: "status",
      ariaLive: "polite",
    });
  });

  it("y un aviso informativo tampoco", () => {
    expect(toastPresentation("info")).toEqual({
      color: "var(--primary)",
      role: "status",
      ariaLive: "polite",
    });
  });
});
