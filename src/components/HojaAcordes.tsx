import type { CSSProperties } from "react";
import { parseHoja } from "../lib/chords";

/**
 * The measurements of one place a sheet is read in.
 *
 * The editor preview, the music stand and the printed page lay out the same
 * structure — section in capitals, chord in bold over its syllable, a fixed gap
 * for a blank line — but at sizes that were tuned separately for each, and not
 * as multiples of one another. Keeping the numbers as data here, rather than as
 * a single scale factor, is what lets all three share this component without
 * any of them moving.
 */
interface Medidas {
  /** Font size of the chords and words, in px. */
  letra: number;
  /** Line height of the chords and words, unitless. */
  interlinea: number;
  /** Space under each line of words, in px. */
  entreLineas: number;
  /** Height of a blank line — the gap between verses — in px. */
  vacia: number;
  seccion: {
    tamano: number;
    espaciado: string;
    arriba: number;
    abajo: number;
    /**
     * On screen the heading is set in the same monospace as the chords; on
     * paper it inherits the sans-serif of the rest of the page. `undefined`
     * means inherit from wherever the sheet is placed.
     */
    familia?: string;
    interlinea?: number;
  };
  /** Colour of chords and headings. The printed page has no theme variables. */
  acento: string;
}

// ui-monospace is what WebKit (the macOS webview) resolves; Chromium — the
// Windows webview and most browsers the printed sheet opens in — skips it and
// lands on the next one it has, so the same stack reads the same everywhere.
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, monospace';

const MEDIDAS = {
  /** The «Cómo se verá» preview beside the editor. */
  editor: {
    letra: 13,
    interlinea: 1.35,
    entreLineas: 2,
    vacia: 14,
    seccion: { tamano: 11.5, espaciado: ".5px", arriba: 14, abajo: 4, familia: MONO, interlinea: 1.35 },
    acento: "var(--primary)",
  },
  /** Modo culto: read from the stand, a couple of metres away. */
  atril: {
    letra: 19,
    interlinea: 1.3,
    entreLineas: 4,
    vacia: 20,
    seccion: { tamano: 14, espaciado: ".6px", arriba: 22, abajo: 6, familia: MONO, interlinea: 1.3 },
    acento: "var(--primary)",
  },
  /** The printable sheet's lyrics pages. */
  impresion: {
    letra: 13,
    interlinea: 1.25,
    entreLineas: 3,
    vacia: 12,
    seccion: { tamano: 11, espaciado: ".5px", arriba: 16, abajo: 4 },
    acento: "#3a4d8f",
  },
} satisfies Record<string, Medidas>;

export type Tamano = keyof typeof MEDIDAS;

/**
 * A ChordPro sheet as chords stacked over the words they fall on.
 *
 * The one place `parseHoja` becomes something to look at: the editor preview,
 * modo culto and the printed sheet (through `renderToStaticMarkup`) all draw
 * with this, so a change in how a chord or a heading is shown lands in all
 * three at once. Text goes through React, which escapes it — the printed sheet
 * relies on that, since the sheet is text the user typed.
 *
 * `escala` multiplies every length; it is the size control of modo culto.
 */
export default function HojaAcordes({
  acordes,
  tamano,
  escala = 1,
}: {
  acordes: string;
  tamano: Tamano;
  escala?: number;
}) {
  const m: Medidas = MEDIDAS[tamano];
  const linea: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    marginBottom: m.entreLineas * escala,
    fontFamily: MONO,
    fontSize: m.letra * escala,
    lineHeight: m.interlinea,
  };
  // An empty chord still takes exactly one line of height, so the words of a
  // stretch without a chord sit level with those that have one. It used to be
  // a hand-picked em value a little under the line height (1.3em against 1.35
  // in the editor, 1.25 against 1.3 in modo culto, 1.2 against 1.25 on paper),
  // which dropped chordless words a fraction of a pixel higher.
  const acorde: CSSProperties = {
    display: "block",
    fontWeight: 700,
    color: m.acento,
    minHeight: `${m.interlinea}em`,
  };
  return (
    <div>
      {parseHoja(acordes).map((l, i) => {
        if (l.tipo === "vacia") return <div key={i} style={{ height: m.vacia * escala }} />;
        if (l.tipo === "seccion") {
          return (
            <h3
              key={i}
              style={{
                fontFamily: m.seccion.familia,
                fontSize: m.seccion.tamano * escala,
                lineHeight: m.seccion.interlinea,
                fontWeight: 700,
                letterSpacing: m.seccion.espaciado,
                textTransform: "uppercase",
                color: m.acento,
                margin: `${m.seccion.arriba * escala}px 0 ${m.seccion.abajo * escala}px`,
              }}
            >
              {l.etiqueta}
            </h3>
          );
        }
        return (
          <div key={i} style={linea}>
            {l.segmentos.map((seg, j) => (
              <span key={j} style={{ display: "inline-block", whiteSpace: "pre" }}>
                <span style={acorde}>{seg.acorde}</span>
                <span style={{ display: "block" }}>{seg.texto}</span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
