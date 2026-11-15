// Las listas de formatos viven en dos idiomas: el escáner (Rust) decide qué
// entra en la biblioteca y el frontend decide qué ofrece «Localizar…» y qué
// avisa el panel. Cuando se separaron, el diálogo dejaba elegir un `.wma` que
// el escáner ya no indexaba y la app no reproducía (#130). Lo que se fija aquí
// es que las listas de `formatos.ts`, las del diálogo y las de `scanner.rs`
// digan lo mismo, leyendo el código de Rust tal cual está.

import { describe, expect, it, vi } from "vitest";
import scannerRs from "../../../src-tauri/src/scanner.rs?raw";
import { EXTENSIONES_AUDIO, EXTENSIONES_VIDEO } from "../formatos";
import { MUESTRAS } from "../pruebaDeFormatos";

const abrir = vi.hoisted(() => vi.fn((_opciones: unknown) => Promise.resolve(null)));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: abrir, save: vi.fn() }));

/** Las cadenas de `const NOMBRE: &[&str] = &[...];` en `scanner.rs`. */
function listaDeRust(nombre: string): string[] {
  const m = scannerRs.match(new RegExp(`const ${nombre}: &\\[&str\\] =\\s*&\\[([^\\]]*)\\];`));
  if (!m) throw new Error(`no encuentro ${nombre} en scanner.rs`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((c) => c[1]);
}

const ordenada = (l: readonly string[]) => [...l].sort();

describe("formatos.ts y scanner.rs", () => {
  it("indexan el mismo audio", () => {
    expect(ordenada(EXTENSIONES_AUDIO)).toEqual(ordenada(listaDeRust("AUDIO_EXTS")));
  });

  it("el mismo video", () => {
    expect(ordenada(EXTENSIONES_VIDEO)).toEqual(ordenada(listaDeRust("VIDEO_EXTS")));
  });

  it("y la prueba de audio y video prueba justo lo que se indexa", () => {
    // Un formato que se indexa y no se prueba no se podría descartar nunca;
    // uno que se prueba y no se indexa, no haría falta.
    const probadas = MUESTRAS.flatMap((m) => [m.ext, ...(m.tambien ?? [])]);
    expect(ordenada(probadas)).toEqual(ordenada([...EXTENSIONES_AUDIO, ...EXTENSIONES_VIDEO]));
    for (const m of MUESTRAS) {
      const lista = m.tipo === "audio" ? EXTENSIONES_AUDIO : EXTENSIONES_VIDEO;
      expect(lista, m.ext).toContain(m.ext);
    }
  });
});

describe("«Localizar…»", () => {
  it("ofrece justo lo que el escáner indexa", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const { pickMediaFile } = await import("../api");
    await pickMediaFile();
    vi.unstubAllGlobals();

    const opciones = abrir.mock.calls[0][0] as { filters: { extensions: string[] }[] };
    const ofrecidas = opciones.filters.flatMap((f) => f.extensions);
    expect(ordenada(ofrecidas)).toEqual(
      ordenada([...listaDeRust("AUDIO_EXTS"), ...listaDeRust("VIDEO_EXTS")]),
    );
  });
});
