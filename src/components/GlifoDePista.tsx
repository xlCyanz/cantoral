import type { ReactNode } from "react";
import { formaDeGlifo } from "../lib/covers";
import type { FormaDeGlifo } from "../lib/covers";
import type { Track } from "../lib/types";

type Tamano = "fila" | "compacta" | "lista" | "detalle" | "barra";

/** Side in px, stroke width and stroke opacity of one glyph at one size. */
interface Trazo {
  lado: number;
  grosor: number;
  alfa: number;
}

/**
 * Each place a swatch appears tuned its glyphs by eye: the camera is drawn a
 * little larger than the note so both read as the same weight, and the big
 * detail cover thins the stroke so it does not look bold. The numbers are the
 * ones each screen already used, kept here so the drawing itself lives once.
 */
const TAMANOS: Record<Tamano, Record<FormaDeGlifo, Trazo>> = {
  /** Library row, normal density (40 px swatch). */
  fila: {
    faltante: { lado: 16, grosor: 2, alfa: 0.92 },
    video: { lado: 17, grosor: 1.9, alfa: 0.92 },
    nota: { lado: 15, grosor: 2, alfa: 0.9 },
  },
  /** Library row, compact density (24 px swatch): the same glyphs at 62 %. */
  compacta: {
    faltante: { lado: 10, grosor: 2, alfa: 0.92 },
    video: { lado: 11, grosor: 1.9, alfa: 0.92 },
    nota: { lado: 9, grosor: 2, alfa: 0.9 },
  },
  /** Culto list row (40 px swatch). */
  lista: {
    faltante: { lado: 14, grosor: 2, alfa: 0.9 },
    video: { lado: 15, grosor: 1.8, alfa: 0.92 },
    nota: { lado: 14, grosor: 1.8, alfa: 0.9 },
  },
  /** Detail panel (74 px swatch). */
  detalle: {
    faltante: { lado: 40, grosor: 1.7, alfa: 0.92 },
    video: { lado: 44, grosor: 1.5, alfa: 0.92 },
    nota: { lado: 40, grosor: 1.6, alfa: 0.9 },
  },
  /** Player bar (38 px swatch). It pins the note (see `forma`), so the
   *  other two are only here to keep the table total. */
  barra: {
    faltante: { lado: 16, grosor: 1.8, alfa: 0.9 },
    video: { lado: 16, grosor: 1.8, alfa: 0.9 },
    nota: { lado: 16, grosor: 1.8, alfa: 0.9 },
  },
};

const TRAZOS: Record<FormaDeGlifo, ReactNode> = {
  // Lucide's triangle-alert.
  faltante: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  // Lucide's video.
  video: (
    <>
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </>
  ),
  // Lucide's music.
  nota: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
};

/**
 * White glyph shown inside a generated cover swatch: a triangle for a missing
 * file, a camera for a video, a note otherwise — and nothing when the track has
 * real art, which the swatch already shows.
 *
 * `forma` pins the glyph regardless of the track; the player bar uses it to
 * keep showing a note for whatever is loaded, as it always has.
 */
export default function GlifoDePista({
  t,
  size,
  forma,
}: {
  t: Pick<Track, "missing" | "cover" | "video"> | null | undefined;
  size: Tamano;
  forma?: FormaDeGlifo;
}) {
  const elegida = formaDeGlifo(t);
  if (!elegida) return null;
  const f = forma ?? elegida;
  const { lado, grosor, alfa } = TAMANOS[size][f];
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={`rgba(255,255,255,${alfa})`}
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: lado, height: lado }}
    >
      {TRAZOS[f]}
    </svg>
  );
}
