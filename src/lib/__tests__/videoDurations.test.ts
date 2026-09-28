import { describe, expect, it, vi } from "vitest";
import { crearRelleno } from "../videoDurations";
import type { Dependencias, Sondeo } from "../videoDurations";

/** A backfill whose probes answer from `respuestas`, with no real waiting. */
function montar(respuestas: Record<string, Sondeo>) {
  let reloj = 0;
  const sondear = vi.fn(async (path: string) => {
    reloj += 10;
    return respuestas[path] ?? { dur: null, motivo: "media error 4" };
  });
  const guardar = vi.fn(async () => {});
  const aplicar = vi.fn();
  const registrar = vi.fn();
  const d: Dependencias = { sondear, guardar, aplicar, registrar, esperar: async () => {}, ahora: () => reloj };
  return { relleno: crearRelleno(d), sondear, guardar, aplicar, registrar };
}

/** Let the queue run to the end. */
const drenar = () => new Promise((r) => setTimeout(r, 0));

describe("video duration backfill", () => {
  it("reads each video once and stores what it could read", async () => {
    const m = montar({ "/a.mp4": { dur: 76 }, "/c.mp4": { dur: 12 } });
    m.relleno.encolar([
      { id: "1", path: "/a.mp4" },
      { id: "2", path: "/b.mp4" },
      { id: "3", path: "/c.mp4" },
    ]);
    await drenar();
    expect(m.sondear.mock.calls.map((c) => c[0])).toEqual(["/a.mp4", "/b.mp4", "/c.mp4"]);
    expect(m.guardar.mock.calls).toEqual([["1", "/a.mp4", 76], ["3", "/c.mp4", 12]]);
    expect(m.aplicar).toHaveBeenCalledTimes(2);
  });

  it("does not retry a video that failed when the pending list changes", async () => {
    // What froze Windows: every success changed the pending list, the backfill
    // started over and re-probed every unreadable video again.
    const m = montar({ "/a.mp4": { dur: 76 } });
    const pendientes = [{ id: "1", path: "/a.mp4" }, { id: "2", path: "/malo.mp4" }];
    m.relleno.encolar(pendientes);
    await drenar();
    m.relleno.encolar([{ id: "2", path: "/malo.mp4" }]);
    await drenar();
    expect(m.sondear).toHaveBeenCalledTimes(2);
  });

  it("queues videos that arrive while it is busy without starting over", async () => {
    const m = montar({ "/a.mp4": { dur: 1 }, "/b.mp4": { dur: 2 } });
    m.relleno.encolar([{ id: "1", path: "/a.mp4" }]);
    m.relleno.encolar([{ id: "1", path: "/a.mp4" }, { id: "2", path: "/b.mp4" }]);
    await drenar();
    expect(m.sondear.mock.calls.map((c) => c[0])).toEqual(["/a.mp4", "/b.mp4"]);
  });

  it("probes a relocated video again under its new path", async () => {
    const m = montar({ "/viejo.mp4": { dur: 5 }, "/nuevo.mp4": { dur: 5 } });
    m.relleno.encolar([{ id: "1", path: "/viejo.mp4" }]);
    await drenar();
    m.relleno.encolar([{ id: "1", path: "/nuevo.mp4" }]);
    await drenar();
    expect(m.sondear).toHaveBeenCalledTimes(2);
  });

  it("logs every unreadable video and a summary", async () => {
    const m = montar({ "/a.mp4": { dur: 3 }, "/lento.mp4": { dur: null, motivo: "timeout" } });
    m.relleno.encolar([{ id: "1", path: "/a.mp4" }, { id: "2", path: "/lento.mp4" }]);
    await drenar();
    const lineas = m.registrar.mock.calls.map((c) => `${c[0]} ${c[1]}`);
    expect(lineas[0]).toBe("info video durations: reading 2 videos without one");
    expect(lineas).toContain("warn video duration: could not read «/lento.mp4» (timeout, 10 ms)");
    expect(lineas[lineas.length - 1]).toMatch(/^info video durations: 1 read, 1 unreadable, in /);
  });

  it("keeps going when storing a duration fails", async () => {
    const m = montar({ "/a.mp4": { dur: 3 }, "/b.mp4": { dur: 4 } });
    m.guardar.mockRejectedValueOnce(new Error("database is locked"));
    m.relleno.encolar([{ id: "1", path: "/a.mp4" }, { id: "2", path: "/b.mp4" }]);
    await drenar();
    expect(m.aplicar.mock.calls).toEqual([["2", "/b.mp4", 4]]);
    expect(m.registrar).toHaveBeenCalledWith("error", "video duration failed for «/a.mp4»: Error: database is locked");
  });
});
