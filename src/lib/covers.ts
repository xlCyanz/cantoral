import type { CSSProperties } from "react";
import type { Track } from "./types";

// Warm gradient palette used for generated cover art — verbatim from the design.
export const COVERS: [string, string][] = [
  ["#C77A4E", "#A9502E"],
  ["#8F9668", "#6E7549"],
  ["#6E8E8A", "#4F6E6A"],
  ["#A9787F", "#87565E"],
  ["#C4A46A", "#A5834A"],
  ["#7C8AA6", "#5C6A86"],
  ["#B08157", "#8E6039"],
  ["#9C7BA0", "#7B5A80"],
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
      background: "linear-gradient(140deg,#8a8178,#5f574e)",
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
