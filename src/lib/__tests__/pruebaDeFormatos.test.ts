// La prueba de audio y video de Configuración: abre un archivo corto de cada
// formato en este equipo y descarta los que no suenan. Se fija qué cuenta como
// «suena» —en un video, también que se vea—, que cada muestra se pruebe una
// detrás de otra y se suelte, y qué hace el store con el resultado: guardarlo
// para el escáner y, si hay canciones en lo descartado, preguntar antes de
// quitarlas.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MUESTRAS,
  descartadosDe,
  probarElemento,
  probarFormatos,
  type Dependencias,
  type ElementoDePrueba,
  type Muestra,
  type TipoDeMuestra,
} from "../pruebaDeFormatos";
import type { Track } from "../types";

type Reaccion = "carga" | "carga-sin-imagen" | "error" | "nada";

/** Un `<audio>`/`<video>` de mentira que reacciona a `load()` como se le diga. */
function elemento(reaccion: Reaccion): ElementoDePrueba & { soltado: boolean } {
  const oyentes: Record<string, (() => void) | undefined> = {};
  const el = {
    src: "",
    preload: "",
    muted: false,
    videoWidth: 0,
    error: null as { code: number } | null,
    soltado: false,
    addEventListener: (tipo: string, f: () => void) => (oyentes[tipo] = f),
    removeEventListener: (tipo: string) => (oyentes[tipo] = undefined),
    removeAttribute: () => {
      el.src = "";
      el.soltado = true;
    },
    load: () => {
      if (!el.src) return;
      queueMicrotask(() => {
        if (reaccion === "carga") {
          el.videoWidth = 64;
          oyentes.loadeddata?.();
        } else if (reaccion === "carga-sin-imagen") {
          oyentes.loadeddata?.();
        } else if (reaccion === "error") {
          el.error = { code: 4 };
          oyentes.error?.();
        }
      });
    },
  };
  return el;
}

describe("una muestra", () => {
  it("un audio que llega a decodificarse suena", async () => {
    const el = elemento("carga-sin-imagen");
    expect(await probarElemento(el, "blob:a", "audio")).toEqual({ ok: true });
    expect(el.muted).toBe(true);
    expect(el.soltado).toBe(true);
  });

  it("un video tiene que verse, no solo oírse", async () => {
    expect(await probarElemento(elemento("carga"), "blob:v", "video")).toEqual({ ok: true });
    const sinImagen = await probarElemento(elemento("carga-sin-imagen"), "blob:v", "video");
    expect(sinImagen.ok).toBe(false);
    expect(sinImagen.motivo).toContain("no se ve");
  });

  it("si el motor no lo abre, dice por qué con palabras", async () => {
    const r = await probarElemento(elemento("error"), "blob:x", "audio");
    expect(r).toEqual({ ok: false, motivo: "Este sistema no reproduce este formato" });
  });

  it("y si no contesta, no se espera para siempre", async () => {
    vi.useFakeTimers();
    const promesa = probarElemento(elemento("nada"), "blob:x", "video", 50);
    await vi.advanceTimersByTimeAsync(60);
    expect(await promesa).toEqual({ ok: false, motivo: "No respondió a tiempo" });
    vi.useRealTimers();
  });
});

const CORTAS: Muestra[] = [
  { ext: "mp3", nombre: "MP3", tipo: "audio", mime: "audio/mpeg" },
  { ext: "aiff", tambien: ["aif"], nombre: "AIFF", tipo: "audio", mime: "audio/aiff" },
  { ext: "wmv", nombre: "WMV", tipo: "video", mime: "video/x-ms-wmv" },
];

function dependencias(reacciones: Record<string, Reaccion>): Dependencias & { abiertas: string[]; soltadas: string[] } {
  const abiertas: string[] = [];
  const soltadas: string[] = [];
  let ultima = "";
  return {
    abiertas,
    soltadas,
    abrir: async (m) => {
      ultima = m.ext;
      abiertas.push(m.ext);
      if (m.ext === "roto") throw new Error("404");
      return `blob:${m.ext}`;
    },
    soltar: (url) => soltadas.push(url),
    crearElemento: (_tipo: TipoDeMuestra) => elemento(reacciones[ultima] ?? "carga"),
  };
}

describe("la prueba entera", () => {
  it("prueba una detrás de otra, avisa de cada una y suelta lo que abrió", async () => {
    const d = dependencias({ aiff: "error" });
    const vistos: string[] = [];

    const resultados = await probarFormatos(d, (r) => vistos.push(r.ext), CORTAS);

    expect(d.abiertas).toEqual(["mp3", "aiff", "wmv"]);
    expect(vistos).toEqual(["mp3", "aiff", "wmv"]);
    expect(d.soltadas).toEqual(["blob:mp3", "blob:aiff", "blob:wmv"]);
    expect(resultados.map((r) => r.ok)).toEqual([true, false, true]);
  });

  it("una muestra que no se pudo leer cuenta como que no suena", async () => {
    const roto: Muestra = { ext: "roto", nombre: "Roto", tipo: "audio", mime: "audio/x-roto" };
    const [r] = await probarFormatos(dependencias({}), undefined, [roto]);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("No se pudo leer la muestra");
  });

  it("lo que no suena se descarta con sus extensiones hermanas", () => {
    const resultados = [
      { ext: "mp3", ok: true },
      { ext: "aiff", ok: false },
      { ext: "wmv", ok: false },
    ];
    expect(descartadosDe(resultados, CORTAS)).toEqual(["aif", "aiff", "wmv"]);
  });

  it("hay una muestra en la app por cada formato que se prueba", () => {
    const archivos = Object.keys(import.meta.glob("../../../public/pruebas-de-formato/*", { query: "?url" }))
      .map((r) => r.split("/").pop());
    for (const m of MUESTRAS) expect(archivos, m.ext).toContain(`prueba.${m.ext}`);
  });
});

const { useStore } = await import("../../store");
const { backend } = await import("../backend");

describe("el resultado, en el store", () => {
  const inicial = useStore.getState();
  beforeEach(() => useStore.setState(inicial, true));

  function pista(id: string, formato: string): Track {
    return {
      id, titulo: id, artista: "", album: "", dur: "3:00", durSec: 180, formato, carpeta: "Música",
      fav: false, missing: false, added: 0, singers: [], path: `/m/${id}.${formato.toLowerCase()}`,
    };
  }

  it("guarda lo descartado y, con canciones en ello, pregunta antes de quitarlas", async () => {
    const descartar = vi.spyOn(backend(), "descartarFormatos");
    useStore.setState({ tracks: [pista("1", "MP3"), pista("2", "WMV")] });

    await useStore.getState().probarFormatos(dependencias({ wmv: "error" }));

    expect(useStore.getState().formatosDescartados).toContain("wmv");
    expect(descartar).toHaveBeenLastCalledWith(expect.arrayContaining(["wmv"]), false);
    const pregunta = useStore.getState().confirm;
    expect(pregunta?.detail).toContain("1 pista");

    useStore.getState().acceptConfirm();
    await vi.waitFor(() => expect(descartar).toHaveBeenLastCalledWith(expect.arrayContaining(["wmv"]), true));
    descartar.mockRestore();
  });

  it("si ni el MP3 suena, la que falla es la prueba: no se descarta nada", async () => {
    const descartar = vi.spyOn(backend(), "descartarFormatos");
    useStore.setState({ tracks: [pista("1", "MP3")] });
    const todoFalla = Object.fromEntries(MUESTRAS.map((m) => [m.ext, "error" as const]));

    await useStore.getState().probarFormatos(dependencias(todoFalla));

    expect(descartar).not.toHaveBeenCalled();
    expect(useStore.getState().formatosDescartados).toEqual([]);
    expect(useStore.getState().confirm).toBeNull();
    expect(useStore.getState().toast?.type).toBe("error");
    descartar.mockRestore();
  });

  it("sin canciones en lo descartado no pregunta nada: lo dice", async () => {
    useStore.setState({ tracks: [pista("1", "MP3")] });

    await useStore.getState().probarFormatos(dependencias({}));

    expect(useStore.getState().confirm).toBeNull();
    expect(useStore.getState().formatosDescartados).toEqual([]);
    expect(useStore.getState().toast?.titulo).toBe("Este equipo reproduce todos los formatos");
    expect(useStore.getState().pruebaDeFormatos.estado).toBe("hecha");
  });
});
