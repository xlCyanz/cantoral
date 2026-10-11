import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke, convertFileSrc: (p: string) => p }));

import { crearCola, esOscuro, puntosDeCaptura, sinMiniatura } from "../miniaturas";
import type { Captura, Dependencias } from "../miniaturas";
import { markVideoThumbnailFailed, saveVideoThumbnail } from "../api";
import { enTurno } from "../turnoDeVideo";
import type { Track } from "../types";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff]);
const ok: Captura = { imagen: JPEG };
const malo: Captura = { imagen: null, motivo: "media error 4" };

/** A queue whose captures answer from `respuestas`, with no real waiting. */
function montar(respuestas: Record<string, Captura>, ocupado: () => boolean = () => false) {
  let reloj = 0;
  const capturar = vi.fn(async (path: string) => {
    reloj += 10;
    return respuestas[path] ?? malo;
  });
  const guardar = vi.fn(async (id: string): Promise<string | null> => `/covers/${id}.jpg`);
  const aplicar = vi.fn();
  const marcarFallo = vi.fn(async () => {});
  const registrar = vi.fn();
  const esperar = vi.fn(async (_ms: number) => {});
  const d: Dependencias = {
    capturar, guardar, aplicar, marcarFallo, ocupado, registrar, esperar, ahora: () => reloj,
  };
  return { cola: crearCola(d), capturar, guardar, aplicar, marcarFallo, registrar, esperar };
}

/** Let the queue run to the end. */
const drenar = () => new Promise((r) => setTimeout(r, 0));

const pista = (id: string, path: string) => ({ id, path });

describe("video thumbnail queue", () => {
  it("makes one per video, in order, and shows what it stored", async () => {
    const m = montar({ "/a.mp4": ok, "/c.mp4": ok });
    m.cola.encolar([pista("1", "/a.mp4"), pista("2", "/b.mp4"), pista("3", "/c.mp4")]);
    await drenar();
    expect(m.capturar.mock.calls.map((c) => c[0])).toEqual(["/a.mp4", "/b.mp4", "/c.mp4"]);
    expect(m.guardar.mock.calls.map((c) => c[0])).toEqual(["1", "3"]);
    expect(m.aplicar.mock.calls).toEqual([["1", "/a.mp4", "/covers/1.jpg"], ["3", "/c.mp4", "/covers/3.jpg"]]);
  });

  it("works one video at a time", async () => {
    let enCurso = 0;
    let maximo = 0;
    const m = montar({});
    m.capturar.mockImplementation(async () => {
      enCurso++;
      maximo = Math.max(maximo, enCurso);
      await new Promise((r) => setTimeout(r, 1));
      enCurso--;
      return ok;
    });
    m.cola.encolar([pista("1", "/a.mp4"), pista("2", "/b.mp4")]);
    m.cola.encolar([pista("3", "/c.mp4")]);
    await new Promise((r) => setTimeout(r, 20));
    expect(m.capturar).toHaveBeenCalledTimes(3);
    expect(maximo).toBe(1);
  });

  it("records a failure so the next launch does not try again", async () => {
    const m = montar({ "/a.mp4": ok });
    m.cola.encolar([pista("1", "/a.mp4"), pista("2", "/malo.mp4")]);
    await drenar();
    expect(m.marcarFallo.mock.calls).toEqual([["2", "/malo.mp4"]]);
  });

  it("does not retry a video in the same session when the pending list changes", async () => {
    const m = montar({ "/a.mp4": ok });
    m.cola.encolar([pista("1", "/a.mp4"), pista("2", "/malo.mp4")]);
    await drenar();
    m.cola.encolar([pista("2", "/malo.mp4")]);
    await drenar();
    expect(m.capturar).toHaveBeenCalledTimes(2);
  });

  it("tries a relocated video again under its new path", async () => {
    const m = montar({ "/viejo.mp4": ok, "/nuevo.mp4": ok });
    m.cola.encolar([pista("1", "/viejo.mp4")]);
    await drenar();
    m.cola.encolar([pista("1", "/nuevo.mp4")]);
    await drenar();
    expect(m.capturar).toHaveBeenCalledTimes(2);
  });

  it("records early failures only once a video has worked", async () => {
    const m = montar({ "/c.mp4": ok });
    m.cola.encolar([pista("1", "/a.mp4"), pista("2", "/b.mp4"), pista("3", "/c.mp4")]);
    await drenar();
    expect(m.marcarFallo.mock.calls).toEqual([["1", "/a.mp4"], ["2", "/b.mp4"]]);
  });

  it("stops without recording anything when every video fails from the start", async () => {
    // Most likely the webview, not the files: recording them would leave the
    // whole library without thumbnails for good.
    const m = montar({});
    const pistas = Array.from({ length: 8 }, (_, i) => pista(String(i), `/${i}.mp4`));
    m.cola.encolar(pistas);
    await drenar();
    expect(m.capturar).toHaveBeenCalledTimes(5);
    expect(m.marcarFallo).not.toHaveBeenCalled();
    m.cola.encolar([pista("99", "/nuevo.mp4")]);
    await drenar();
    expect(m.capturar).toHaveBeenCalledTimes(5);
    expect(m.registrar).toHaveBeenCalledWith(
      "warn", "video thumbnails: stopping for this session (the first 5 videos all failed)",
    );
  });

  it("stops at once when the webview refuses to read the canvas", async () => {
    const m = montar({
      "/a.mp4": { imagen: null, motivo: "SecurityError: tainted", plataforma: true },
      "/b.mp4": ok,
    });
    m.cola.encolar([pista("1", "/a.mp4"), pista("2", "/b.mp4")]);
    await drenar();
    expect(m.capturar).toHaveBeenCalledTimes(1);
    expect(m.marcarFallo).not.toHaveBeenCalled();
  });

  it("does not record a failure when storing fails, and keeps going", async () => {
    const m = montar({ "/a.mp4": ok, "/b.mp4": ok });
    m.guardar.mockRejectedValueOnce(new Error("database is locked"));
    m.cola.encolar([pista("1", "/a.mp4"), pista("2", "/b.mp4")]);
    await drenar();
    expect(m.marcarFallo).not.toHaveBeenCalled();
    expect(m.aplicar.mock.calls).toEqual([["2", "/b.mp4", "/covers/2.jpg"]]);
    expect(m.registrar).toHaveBeenCalledWith("error", "video thumbnail failed for «/a.mp4»: Error: database is locked");
  });

  it("discards a thumbnail whose track changed meanwhile", async () => {
    const m = montar({ "/a.mp4": ok });
    m.guardar.mockResolvedValueOnce(null);
    m.cola.encolar([pista("1", "/a.mp4")]);
    await drenar();
    expect(m.aplicar).not.toHaveBeenCalled();
    expect(m.marcarFallo).not.toHaveBeenCalled();
  });

  it("waits while something plays or is projected", async () => {
    let ocupado = 3;
    const m = montar({ "/a.mp4": ok }, () => ocupado-- > 0);
    m.cola.encolar([pista("1", "/a.mp4")]);
    await drenar();
    expect(m.esperar.mock.calls.map((c) => c[0])).toEqual([150, 5000, 5000, 5000]);
    expect(m.capturar).toHaveBeenCalledTimes(1);
  });

  it("logs every failure and a summary", async () => {
    const m = montar({ "/a.mp4": ok, "/lento.mp4": { imagen: null, motivo: "timeout" } });
    m.cola.encolar([pista("1", "/a.mp4"), pista("2", "/lento.mp4")]);
    await drenar();
    const lineas = m.registrar.mock.calls.map((c) => `${c[0]} ${c[1]}`);
    expect(lineas[0]).toBe("info video thumbnails: making 2 missing ones");
    expect(lineas).toContain("warn video thumbnail: could not make one for «/lento.mp4» (timeout, 10 ms)");
    expect(lineas[lineas.length - 1]).toMatch(/^info video thumbnails: 1 made, 1 failed, in /);
  });
});

describe("which videos still need one", () => {
  const base: Track = {
    id: "1", titulo: "", artista: "", album: "", dur: "0:00", durSec: 0, formato: "MP4",
    carpeta: "", fav: false, missing: false, added: 1, video: true, path: "/v.mp4",
  };
  it("skips audio, missing files, videos with a cover and those that failed", () => {
    const tracks: Track[] = [
      base,
      { ...base, id: "2", video: false, path: "/a.mp3" },
      { ...base, id: "3", missing: true },
      { ...base, id: "4", cover: "asset://x/4.jpg" },
      { ...base, id: "5", miniaturaFallida: true },
      { ...base, id: "6", path: undefined },
    ];
    expect(sinMiniatura(tracks)).toEqual([{ id: "1", path: "/v.mp4" }]);
  });
});

describe("where to look for a frame", () => {
  it("skips the opening, caps how far it reads and stays inside the video", () => {
    expect(puntosDeCaptura(100)).toEqual([10, 100 / 3]);
    expect(puntosDeCaptura(3600)).toEqual([60, 180]);
    expect(puntosDeCaptura(0.05)).toEqual([0]);
    expect(puntosDeCaptura(NaN)).toEqual([1]);
    expect(puntosDeCaptura(Infinity)).toEqual([1]);
  });

  it("tells a black frame from one with a picture", () => {
    const negro = new Uint8ClampedArray(4 * 100);
    const gris = new Uint8ClampedArray(4 * 100).fill(128);
    expect(esOscuro(negro)).toBe(true);
    expect(esOscuro(gris)).toBe(false);
  });
});

describe("one off-screen video at a time", () => {
  it("runs the duration and thumbnail loads one after the other", async () => {
    const orden: string[] = [];
    const tarea = (n: string) => async () => {
      orden.push(`${n}+`);
      await new Promise((r) => setTimeout(r, 1));
      orden.push(`${n}-`);
    };
    await Promise.all([enTurno(tarea("a")), enTurno(async () => { throw new Error("x"); }).catch(() => {}), enTurno(tarea("b"))]);
    expect(orden).toEqual(["a+", "a-", "b+", "b-"]);
  });
});

describe("outside the app", () => {
  beforeEach(() => invoke.mockClear());
  it("never reaches the core: the browser has no files to read", async () => {
    expect(await saveVideoThumbnail("1", "/v.mp4", JPEG)).toBeNull();
    await markVideoThumbnailFailed("1", "/v.mp4");
    expect(invoke).not.toHaveBeenCalled();
  });
});
