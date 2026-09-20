import { describe, expect, it } from "vitest";
import { motivoEnPalabras, tamano } from "../DuplicateGroups";

describe("tamano", () => {
  it("uses KB below a megabyte", () => {
    expect(tamano(4_096)).toBe("4 KB");
    expect(tamano(900 * 1024)).toBe("900 KB");
  });

  it("switches to MB with one decimal, written the Spanish way", () => {
    expect(tamano(6_048_210)).toBe("5,8 MB");
  });

  it("drops the decimal once the number is big enough not to need it", () => {
    expect(tamano(500 * 1024 * 1024)).toBe("500 MB");
  });

  it("says nothing rather than «0 KB» when the size is unknown", () => {
    // fsize is 0 when the scan could not stat the file, which is not a size.
    expect(tamano(0)).toBe("—");
    expect(tamano(-1)).toBe("—");
  });
});

describe("motivoEnPalabras", () => {
  it("says why a group was put together, in words", () => {
    expect(motivoEnPalabras("archivo")).toBe("Mismo archivo");
    expect(motivoEnPalabras("titulo")).toBe("Mismo título");
  });
});
