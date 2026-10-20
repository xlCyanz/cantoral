// Cada escritura en el store despierta a todos sus suscriptores —unos 460 con
// la biblioteca en pantalla—, cambie algo o no. Lo que se fija aquí es que lo
// que llega muchas veces por segundo sin cambiar nada (el `timeupdate` del
// reproductor, la posición que devuelve el proyector, el `dragover`) no
// escriba, y que el resto siga llegando igual.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EstadoProyeccion, SalidaProyeccion } from "../api";
import type { Folder, Track } from "../types";

let contestar: ((e: EstadoProyeccion) => void) | null = null;

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  projectionMonitors: () =>
    Promise.resolve([
      { indice: 0, nombre: "Pantalla 1", ancho: 1920, alto: 1080, principal: true, sistema: "A", x: 0, y: 0 },
      { indice: 1, nombre: "Pantalla 2", ancho: 1920, alto: 1080, principal: false, sistema: "B", x: 1920, y: 0 },
    ]),
  openProjectionCmd: () => Promise.resolve(),
  closeProjectionCmd: () => Promise.resolve(),
  setProjectionCmd: (_c: SalidaProyeccion) => Promise.resolve(),
  onProjectionState: (cb: (e: EstadoProyeccion) => void) => {
    contestar = cb;
    return Promise.resolve(() => (contestar = null));
  },
  onProjectionReady: () => Promise.resolve(() => {}),
}));

const { useStore } = await import("../../store");
const { mismasCarpetas } = await import("../../store/contexto");
const { informarPosicion, fijarDuracion } = await import("../media");
const initial = useStore.getState();

function pista(id: string, over: Partial<Track> = {}): Track {
  return {
    id,
    titulo: `Pista ${id}`,
    artista: "Coro",
    album: "",
    dur: "3:00",
    durSec: 180,
    formato: "MP3",
    carpeta: "Música",
    fav: false,
    missing: false,
    added: 0,
    path: `/m/${id}.mp3`,
    ...over,
  };
}

/** Cuántas veces se avisó a los suscriptores mientras corría `fn`. */
function escrituras(fn: () => void): number {
  let n = 0;
  const soltar = useStore.subscribe(() => n++);
  fn();
  soltar();
  return n;
}

/** Diez segundos de `timeupdate` a cuatro por segundo, como los manda el webview. */
const DIEZ_SEGUNDOS = Array.from({ length: 40 }, (_, i) => 30 + i * 0.25);

beforeEach(() => {
  useStore.setState(initial, true);
  contestar = null;
});

describe("reproduciendo en el portátil", () => {
  it("el timeupdate escribe una vez por segundo, no cuatro", () => {
    const n = escrituras(() => DIEZ_SEGUNDOS.forEach(informarPosicion));

    // Antes: 40 escrituras en diez segundos.
    expect(n).toBe(10);
    expect(useStore.getState().posSec).toBe(39);
  });

  it("la duración que ya coincide no rehace el catálogo", () => {
    useStore.setState({ tracks: [pista("a"), pista("b")] });
    const antes = useStore.getState().tracks;

    expect(escrituras(() => fijarDuracion("a", 180))).toBe(0);
    expect(useStore.getState().tracks).toBe(antes);

    fijarDuracion("a", 200);
    expect(useStore.getState().tracks.find((t) => t.id === "a")).toMatchObject({ durSec: 200, dur: "3:20" });
  });
});

describe("lo que devuelve el proyector", () => {
  it("la misma posición del video no se vuelve a escribir", async () => {
    const video = pista("v", { video: true, path: "/m/v.mp4", formato: "MP4" });
    useStore.setState({ tracks: [video], queue: ["v"], playerId: "" });
    await useStore.getState().escucharProyeccion();
    useStore.getState().play("v", ["v"]);
    await new Promise((r) => setTimeout(r, 0));
    expect(useStore.getState().proyeccionPista).toBe("v");

    const n = escrituras(() => {
      for (const pos of [5, 5, 5, 5, 6, 6, 6, 6]) contestar!({ src: "/m/v.mp4", pos, dur: 180, fin: false });
    });

    expect(n).toBe(2);
    expect(useStore.getState().posSec).toBe(6);
  });
});

describe("arrastrar sobre el culto", () => {
  it("pasar por encima de la misma fila no escribe", () => {
    useStore.getState().setOver("a");

    expect(escrituras(() => {
      for (let i = 0; i < 30; i++) useStore.getState().setOver("a");
    })).toBe(0);
    expect(escrituras(() => useStore.getState().setOver("b"))).toBe(1);
  });
});

describe("el refresco en vivo del escaneo", () => {
  const carpeta = (over: Partial<Folder> = {}): Folder => ({ id: "1", nombre: "Música", ruta: "/m", count: 3, lastScan: "x", ...over });

  it("las mismas carpetas, recién llegadas, cuentan como iguales", () => {
    expect(mismasCarpetas([carpeta()], [carpeta()])).toBe(true);
    expect(mismasCarpetas([carpeta()], [carpeta({ count: 4 })])).toBe(false);
    expect(mismasCarpetas([carpeta()], [])).toBe(false);
  });
});
