// Un `latest.json` que apunta a una descarga que no existe deja a cada
// instalación intentando actualizarse y fallando, en un PC de iglesia donde
// nadie va a leer el error. Por eso el manifiesto se arma de lo que hay y se
// niega a publicarse vacío.

import { describe, expect, it } from "vitest";
// @ts-expect-error — script del workflow, sin tipos: se prueba su comportamiento.
import { manifiesto, notasDe, plataformaDe } from "../../../.github/scripts/latest-json.mjs";

const base = {
  version: "1.2.3",
  notas: "Novedades",
  fecha: "2026-09-21T12:00:00.000Z",
  repo: "xlCyanz/cantoral",
  tag: "v1.2.3",
};

describe("plataformaDe", () => {
  it("reconoce lo que el actualizador descarga", () => {
    expect(plataformaDe("Cantoral.app.tar.gz")).toBe("darwin-aarch64");
    expect(plataformaDe("Cantoral_1.2.3_x64-setup.exe")).toBe("windows-x86_64");
  });

  it("ignora lo que solo sirve para instalar a mano", () => {
    // El .dmg y el .msi no los sabe abrir el actualizador.
    expect(plataformaDe("Cantoral_1.2.3_aarch64.dmg")).toBeNull();
    expect(plataformaDe("Cantoral_1.2.3_x64_en-US.msi")).toBeNull();
    expect(plataformaDe("Cantoral.exe")).toBeNull();
  });
});

describe("manifiesto", () => {
  it("junta cada artefacto firmado con su URL del release", () => {
    const m = manifiesto({
      ...base,
      artefactos: [
        "artifacts/cantoral-macos/Cantoral.app.tar.gz",
        "artifacts/cantoral-windows/Cantoral_1.2.3_x64-setup.exe",
      ],
      firmas: {
        "artifacts/cantoral-macos/Cantoral.app.tar.gz": "firma-mac\n",
        "artifacts/cantoral-windows/Cantoral_1.2.3_x64-setup.exe": "firma-win",
      },
    });

    expect(m.version).toBe("1.2.3");
    expect(m.notes).toBe("Novedades");
    expect(m.platforms["darwin-aarch64"]).toEqual({
      signature: "firma-mac",
      url: "https://github.com/xlCyanz/cantoral/releases/download/v1.2.3/Cantoral.app.tar.gz",
    });
    expect(m.platforms["windows-x86_64"].url).toContain("Cantoral_1.2.3_x64-setup.exe");
  });

  it("deja fuera un artefacto sin firma en vez de publicarlo sin verificar", () => {
    // Una entrada sin firma haría fallar la verificación en cada cliente.
    const m = manifiesto({
      ...base,
      artefactos: [
        "artifacts/a/Cantoral.app.tar.gz",
        "artifacts/b/Cantoral_1.2.3_x64-setup.exe",
      ],
      firmas: { "artifacts/a/Cantoral.app.tar.gz": "firma-mac" },
    });

    expect(Object.keys(m.platforms)).toEqual(["darwin-aarch64"]);
  });

  it("una firma en blanco tampoco cuenta", () => {
    expect(() =>
      manifiesto({
        ...base,
        artefactos: ["artifacts/a/Cantoral.app.tar.gz"],
        firmas: { "artifacts/a/Cantoral.app.tar.gz": "   \n" },
      }),
    ).toThrow(/ningún artefacto firmado/);
  });

  it("se niega a salir vacío", () => {
    // Publicar un manifiesto sin plataformas es peor que no publicarlo: el
    // cliente lo lee, no encuentra la suya y falla en cada comprobación.
    expect(() => manifiesto({ ...base, artefactos: [], firmas: {} })).toThrow(
      /ningún artefacto firmado/,
    );
    expect(() =>
      manifiesto({
        ...base,
        artefactos: ["artifacts/a/Cantoral_1.2.3_aarch64.dmg"],
        firmas: { "artifacts/a/Cantoral_1.2.3_aarch64.dmg": "firma" },
      }),
    ).toThrow(/ningún artefacto firmado/);
  });

  it("escapa el nombre del archivo en la URL", () => {
    const m = manifiesto({
      ...base,
      artefactos: ["artifacts/a/Cantoral 1.2.3.app.tar.gz"],
      firmas: { "artifacts/a/Cantoral 1.2.3.app.tar.gz": "firma" },
    });

    expect(m.platforms["darwin-aarch64"].url).toContain("Cantoral%201.2.3.app.tar.gz");
  });
});

describe("notasDe", () => {
  const changelog = [
    "# Registro de cambios",
    "",
    "## [Sin publicar]",
    "",
    "- algo que viene",
    "",
    "## [1.2.3] - 2026-09-21",
    "",
    "### Añadido",
    "",
    "- lo de esta versión",
    "",
    "## [1.2.2] - 2026-08-01",
    "",
    "- lo viejo",
  ].join("\n");

  it("saca la sección de esta versión y solo esa", () => {
    const notas = notasDe(changelog, "1.2.3");

    expect(notas).toContain("lo de esta versión");
    expect(notas).not.toContain("lo viejo");
    expect(notas).not.toContain("algo que viene");
  });

  it("si no hay sección, dice al menos qué versión es", () => {
    expect(notasDe(changelog, "9.9.9")).toBe("Cantoral 9.9.9");
  });

  it("una sección vacía tampoco se publica en blanco", () => {
    const vacio = "## [1.0.0] - 2026-01-01\n\n## [0.9.0]\n- viejo";

    expect(notasDe(vacio, "1.0.0")).toBe("Cantoral 1.0.0");
  });
});
