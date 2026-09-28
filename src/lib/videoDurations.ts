import { useEffect } from "react";
import { isTauri, registrar, toAssetUrl, updateTrackDuration } from "./api";
import { fmt } from "./covers";
import { useStore } from "../store";

/** Lo que dejó leer un video: su duración, o por qué no se pudo. */
export type Sondeo = { dur: number } | { dur: null; motivo: string };

/** Lo que se espera a un video antes de darlo por ilegible. */
const LIMITE_MS = 15000;
/** Respiro entre un video y el siguiente. */
const PAUSA_MS = 100;
/** Un video que tarda más que esto se anota en el log aunque se lea bien. */
const LENTO_MS = 3000;

/** Reads metadata only; this element never plays or joins the transport. */
export async function videoDuration(path: string): Promise<Sondeo> {
  const url = await toAssetUrl(path);
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const finish = (sondeo: Sondeo) => {
      clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.ondurationchange = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      resolve(sondeo);
    };
    const metadata = () => {
      const duration = Math.round(video.duration);
      if (Number.isFinite(duration) && duration > 0) finish({ dur: duration });
    };
    const timeout = setTimeout(() => finish({ dur: null, motivo: "timeout" }), LIMITE_MS);
    video.onloadedmetadata = metadata;
    video.ondurationchange = metadata;
    video.onerror = () => finish({ dur: null, motivo: `media error ${video.error?.code ?? "?"}` });
    video.src = url;
    video.load();
  });
}

export interface Pista {
  id: string;
  path: string;
}

/** Everything the backfill touches outside itself, so it can be tested. */
export interface Dependencias {
  sondear: (path: string) => Promise<Sondeo>;
  guardar: (id: string, path: string, dur: number) => Promise<void>;
  aplicar: (id: string, path: string, dur: number) => void;
  registrar: (nivel: "info" | "warn" | "error", mensaje: string) => void;
  esperar: (ms: number) => Promise<void>;
  ahora: () => number;
}

/**
 * Una cola que lee, de uno en uno, la duración de los videos cuyas etiquetas
 * no la traían.
 *
 * Cada video se intenta una sola vez por sesión, salga bien o mal. Antes el
 * relleno colgaba de un efecto que se abortaba y volvía a empezar cada vez
 * que un video recibía su duración, así que los que no se dejaban leer se
 * reintentaban tras cada acierto —hasta 15 s cada uno— y con 200 videos al
 * abrir la app eso eran minutos con Windows entregando archivos desde el
 * hilo de la ventana. Ahora lo nuevo se añade al final y lo que ya se
 * intentó no vuelve.
 */
export function crearRelleno(d: Dependencias) {
  const vistos = new Set<string>();
  const cola: Pista[] = [];
  let trabajando = false;

  async function trabajar() {
    trabajando = true;
    const inicio = d.ahora();
    let leidos = 0;
    let fallidos = 0;
    d.registrar("info", `video durations: reading ${cola.length} videos without one`);
    while (cola.length) {
      const t = cola.shift()!;
      // Antes de cada video, no después: la primera también espera a que la
      // ventana termine de abrir.
      await d.esperar(PAUSA_MS);
      const antes = d.ahora();
      try {
        const sondeo = await d.sondear(t.path);
        const ms = Math.round(d.ahora() - antes);
        if (sondeo.dur === null) {
          fallidos++;
          d.registrar("warn", `video duration: could not read «${t.path}» (${sondeo.motivo}, ${ms} ms)`);
          continue;
        }
        if (ms > LENTO_MS) d.registrar("warn", `video duration: «${t.path}» took ${ms} ms`);
        await d.guardar(t.id, t.path, sondeo.dur);
        d.aplicar(t.id, t.path, sondeo.dur);
        leidos++;
      } catch (err) {
        fallidos++;
        d.registrar("error", `video duration failed for «${t.path}»: ${String(err)}`);
      }
    }
    const s = ((d.ahora() - inicio) / 1000).toFixed(1);
    d.registrar("info", `video durations: ${leidos} read, ${fallidos} unreadable, in ${s}s`);
    trabajando = false;
  }

  return {
    encolar(pistas: readonly Pista[]) {
      for (const t of pistas) {
        const clave = `${t.id}:${t.path}`;
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        cola.push({ id: t.id, path: t.path });
      }
      if (!trabajando && cola.length) void trabajar();
    },
  };
}

const relleno = crearRelleno({
  sondear: videoDuration,
  guardar: updateTrackDuration,
  aplicar: (id, path, dur) =>
    useStore.setState((s) => ({
      tracks: s.tracks.map((t) => (t.id === id && t.path === path ? { ...t, durSec: dur, dur: fmt(dur) } : t)),
    })),
  registrar,
  esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
  ahora: () => performance.now(),
});

/** Backfills old and newly scanned videos whose tags provided no duration. */
export function useVideoDurations() {
  const pending = useStore((s) => s.tracks
    .filter((t) => t.video && t.path && !t.missing && t.durSec === 0)
    .map((t) => `${t.id}:${t.path}`).join("\0"));

  useEffect(() => {
    if (!isTauri() || !pending) return;
    relleno.encolar(
      useStore.getState().tracks
        .filter((t) => t.video && t.path && !t.missing && t.durSec === 0)
        .map((t) => ({ id: t.id, path: t.path! })),
    );
  }, [pending]);
}
