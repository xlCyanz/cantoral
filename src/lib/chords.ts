// ChordPro sheets: reading them to lay out on screen and on paper.
//
// Notation is the Latin one the rest of the app already uses — Do, Rem, Sib,
// Fa#m — because that is what a Spanish-speaking worship team writes on paper.
// Anything that does not parse as a chord is left exactly as it was found: a
// sheet that comes back slightly unhelpful is recoverable, one that comes back
// with the wrong chords on it is not.
//
// Chords are only ever *recognised* here, never rewritten. The sheet shows the
// chords its author typed.

/** Natural notes and where they sit in the twelve. */
const NATURALES: Record<string, number> = { Do: 0, Re: 2, Mi: 4, Fa: 5, Sol: 7, La: 9, Si: 11 };

/** Longest first, so «Sol» is never read as «So» + something. */
const NOMBRES = Object.keys(NATURALES).sort((a, b) => b.length - a.length);

/**
 * Whether a bracketed token is a chord and not something else the author wrote.
 *
 * `[x2]`, `[Puente]` and `[N.C.]` are not chords, and what tells them apart is
 * only the root: everything after it — `m`, `7`, `sus4`, `maj7` — is whatever
 * the author typed and is never read.
 */
export function esAcorde(texto: string): boolean {
  const t = texto.trim();
  if (!t) return false;
  // The root is what makes it one: the bass of a slash chord is not checked,
  // so «Do/loquesea» is still read as a chord rather than as words.
  return parseNota(t.split("/")[0]) !== null;
}

function parseNota(texto: string): { clase: number; largo: number } | null {
  for (const nombre of NOMBRES) {
    if (!texto.startsWith(nombre)) continue;
    let clase = NATURALES[nombre];
    let largo = nombre.length;
    const siguiente = texto[largo];
    if (siguiente === "#") {
      clase += 1;
      largo += 1;
    } else if (siguiente === "b") {
      clase -= 1;
      largo += 1;
    }
    return { clase: ((clase % 12) + 12) % 12, largo };
  }
  return null;
}

/** One stretch of a lyric line: the chord over it, and the words under it. */
export interface Segmento {
  /** Empty when this stretch carries no chord. */
  acorde: string;
  texto: string;
}

export interface LineaHoja {
  tipo: "letra" | "seccion" | "vacia";
  /** For a section line: what it is called, e.g. «Coro». */
  etiqueta?: string;
  segmentos: Segmento[];
}

/**
 * Read a ChordPro sheet into lines the view can lay out.
 *
 * `{coro}` and `{comment: Coro}` become headings. Square brackets holding
 * something that is not a chord — `[x2]`, `[Puente]` — stay in the words where
 * the author put them, rather than being silently eaten.
 */
export function parseHoja(texto: string): LineaHoja[] {
  return texto.replace(/\r\n?/g, "\n").split("\n").map(leerLinea);
}

function leerLinea(linea: string): LineaHoja {
  const recortada = linea.trim();
  if (!recortada) return { tipo: "vacia", segmentos: [] };

  const directiva = /^\{\s*([^}]*)\}$/.exec(recortada);
  if (directiva) {
    const dentro = directiva[1];
    const dosPuntos = dentro.indexOf(":");
    const etiqueta = (dosPuntos >= 0 ? dentro.slice(dosPuntos + 1) : dentro).trim();
    return { tipo: "seccion", etiqueta, segmentos: [] };
  }

  const segmentos: Segmento[] = [];
  let acordePendiente = "";
  let texto = "";
  let i = 0;
  while (i < linea.length) {
    if (linea[i] === "[") {
      const cierre = linea.indexOf("]", i);
      if (cierre > i) {
        const dentro = linea.slice(i + 1, cierre);
        if (esAcorde(dentro)) {
          // A chord closes the stretch before it and opens the next one.
          if (texto || acordePendiente) segmentos.push({ acorde: acordePendiente, texto });
          acordePendiente = dentro;
          texto = "";
          i = cierre + 1;
          continue;
        }
        // Not a chord: the author meant those brackets to be read.
        texto += linea.slice(i, cierre + 1);
        i = cierre + 1;
        continue;
      }
    }
    texto += linea[i];
    i += 1;
  }
  if (texto || acordePendiente) segmentos.push({ acorde: acordePendiente, texto });
  return { tipo: "letra", segmentos };
}

/** Whether a sheet has anything on it at all. */
export function hojaVacia(letra: string | undefined, acordes: string | undefined): boolean {
  return !(letra?.trim() || acordes?.trim());
}
