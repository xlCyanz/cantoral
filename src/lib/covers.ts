import type { CSSProperties } from "react";
import type { Track } from "./types";

// Paleta de las carátulas generadas — verbatim del rediseño.
//
// Antes eran ocho gradientes de colores distintos; ahora son seis tonos de la
// misma familia azul sobre un fondo oscuro. Una pista sin carátula deja de
// competir por la atención con las que sí la tienen, que es lo que se ve en
// una biblioteca de iglesia: casi ninguna trae arte incrustado.
export const COVERS: [string, string][] = [
  ["#3a4d8f", "rgba(0,0,0,.45)"],
  ["#465584", "rgba(0,0,0,.45)"],
  ["#2b3a6e", "rgba(0,0,0,.45)"],
  ["#546496", "rgba(0,0,0,.45)"],
  ["#3c4560", "rgba(0,0,0,.45)"],
  ["#6c7bb5", "rgba(0,0,0,.45)"],
];

/** Deterministic string hash (djb-ish, matches the design's hash()). */
export function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Format a number of seconds as m:ss. */
export function fmt(s: number): string {
  s = Math.max(0, Math.round(s));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

/** Inline style for a track's cover (real embedded art if present, else a
 *  generated gradient swatch — ported from cover()). */
export function coverStyle(
  t: Pick<Track, "id" | "missing" | "cover"> | null | undefined,
  size: number,
): CSSProperties {
  const r = size >= 64 ? "14px" : size >= 48 ? "11px" : "8px";
  const base: CSSProperties = {
    width: size + "px",
    height: size + "px",
    borderRadius: r,
    flex: "0 0 auto",
    display: "grid",
    placeItems: "center",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,.2), inset 0 -10px 20px rgba(0,0,0,.14)",
  };
  if (t && t.missing) {
    return {
      ...base,
      background: "linear-gradient(140deg,#7b828d,#4e545e)",
      filter: "saturate(.5)",
    };
  }
  if (t && t.cover) {
    return {
      ...base,
      backgroundColor: "var(--surface-3)",
      backgroundImage: `url("${t.cover}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  const p = COVERS[hash(t ? t.id : "x") % COVERS.length];
  return { ...base, background: `linear-gradient(140deg,${p[0]},${p[1]})` };
}

/** Whether a track shows real cover art (so the white glyph overlay is hidden). */
export function hasCover(t: Pick<Track, "missing" | "cover"> | null | undefined): boolean {
  return !!(t && t.cover && !t.missing);
}

/** Linear-gradient background for a playlist cover, keyed by id. */
export function gradientFor(id: string, angle = 145): CSSProperties {
  const p = COVERS[hash(id) % COVERS.length];
  return {
    position: "absolute",
    inset: 0,
    background: `linear-gradient(${angle}deg,${p[0]},${p[1]})`,
  };
}
