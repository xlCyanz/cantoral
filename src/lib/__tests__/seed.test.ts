// El catálogo de ejemplo hace de backend en el modo navegador, así que tiene
// que parecerse al de verdad. En particular, cada pista trae su `path`: el panel
// de detalle lo muestra tal cual desde que dejó de fabricarlo.

import { describe, expect, it } from "vitest";
import { SEED_FOLDERS, SEED_TRACKS } from "../seed";

describe("el catálogo de ejemplo", () => {
  it("da una ruta a cada pista", () => {
    expect(SEED_TRACKS.every((t) => !!t.path)).toBe(true);
  });

  it("la cuelga de la carpeta a la que la pista dice pertenecer", () => {
    for (const t of SEED_TRACKS) {
      const carpeta = SEED_FOLDERS.find((f) => f.nombre === t.carpeta);
      if (!carpeta) continue;
      expect(t.path!.startsWith(carpeta.ruta)).toBe(true);
    }
  });

  it("le pone la extensión del formato que declara", () => {
    for (const t of SEED_TRACKS) {
      expect(t.path!.toLowerCase().endsWith(`.${t.formato.toLowerCase()}`)).toBe(true);
    }
  });
});
