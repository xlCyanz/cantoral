// ChordPro sheets: reading them, and moving them to the key the group sings in.
//
// Notation is the Latin one the rest of the app already uses — Do, Rem, Sib,
// Fa#m — because that is what a Spanish-speaking worship team writes on paper.
// Anything that does not parse as a chord is left exactly as it was found: a
// sheet that comes back slightly unhelpful is recoverable, one that comes back
// with the wrong chords on it is not.

/** Natural notes and where they sit in the twelve. */
const NATURALES: Record<string, number> = { Do: 0, Re: 2, Mi: 4, Fa: 5, Sol: 7, La: 9, Si: 11 };

/** Longest first, so «Sol» is never read as «So» + something. */
const NOMBRES = Object.keys(NATURALES).sort((a, b) => b.length - a.length);

const CON_SOSTENIDOS = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
const CON_BEMOLES = ["Do", "Reb", "Re", "Mib", "Mi", "Fa", "Solb", "Sol", "Lab", "La", "Sib", "Si"];

/**
 * Which spelling each key is written with, following its key signature.
 *
 * Not a detail: a guitarist reading «Sol#» where the sheet should say «Lab»
 * has to stop and translate, which is the whole thing this is meant to save.
 * Keys not listed fall back to sharps.
 */
const BEMOLES_EN: Record<string, boolean> = {
  Fa: true, Sib: true, Mib: true, Lab: true, Reb: true, Solb: true,
  Rem: true, Solm: true, Dom: true, Fam: true, Sibm: true, Mibm: true,
};

export interface Acorde {
  /** Pitch class of the root, 0–11. */
  raiz: number;
  /** Everything after the root: `m`, `7`, `sus4`, `maj7`… kept verbatim. */
  sufijo: string;
  /** Pitch class of the bass of a slash chord, if there is one. */
  bajo?: number;
  /** Whatever followed the slash but did not parse as a note. */
  bajoLiteral?: string;
}

/** Read a chord, or `null` when it is not one. */
export function parseAcorde(texto: string): Acorde | null {
  const t = texto.trim();
  if (!t) return null;
  const [cuerpo, ...resto] = t.split("/");
  const raiz = parseNota(cuerpo);
  if (!raiz) return null;
  const acorde: Acorde = { raiz: raiz.clase, sufijo: cuerpo.slice(raiz.largo) };
  if (resto.length) {
    const bajo = parseNota(resto.join("/"));
    if (bajo && bajo.largo === resto.join("/").length) acorde.bajo = bajo.clase;
    else acorde.bajoLiteral = resto.join("/");
  }
  return acorde;
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

/** Name a pitch class, in the spelling the target key asks for. */
function nombrar(clase: number, bemoles: boolean): string {
  const i = ((clase % 12) + 12) % 12;
  return bemoles ? CON_BEMOLES[i] : CON_SOSTENIDOS[i];
}

/** Whether a key is written with flats. */
export function usaBemoles(tono: string): boolean {
  return BEMOLES_EN[tono.trim()] ?? false;
}

/**
 * Move one chord by `semitonos`.
 *
 * `bemoles` decides the spelling, and should come from the key the sheet is
 * moving *to* rather than from the chord itself.
 */
export function transponerAcorde(texto: string, semitonos: number, bemoles: boolean): string {
  const a = parseAcorde(texto);
  if (!a) return texto;
  let out = nombrar(a.raiz + semitonos, bemoles) + a.sufijo;
  if (a.bajo !== undefined) out += "/" + nombrar(a.bajo + semitonos, bemoles);
  else if (a.bajoLiteral !== undefined) out += "/" + a.bajoLiteral;
  return out;
}

/**
 * Move a key name by `semitonos`, keeping whether it is major or minor.
 *
 * Returns the input untouched when it is not a key the app can read — «—» and
 * an empty field both mean «nobody wrote it down».
 */
export function transponerTono(tono: string, semitonos: number): string {
  const t = tono.trim();
  const nota = parseNota(t);
  if (!nota) return tono;
  const sufijo = t.slice(nota.largo);
  const destino = ((nota.clase + semitonos) % 12 + 12) % 12;
  // Spell the new key by its own signature: try both and keep the one the
  // table recognises, defaulting to sharps.
  const conBemol = CON_BEMOLES[destino] + sufijo;
  const conSostenido = CON_SOSTENIDOS[destino] + sufijo;
  return BEMOLES_EN[conBemol] ? conBemol : conSostenido;
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
export function parseHoja(texto: string, semitonos = 0, bemoles = false): LineaHoja[] {
  return texto.replace(/\r\n?/g, "\n").split("\n").map((linea) => leerLinea(linea, semitonos, bemoles));
}

function leerLinea(linea: string, semitonos: number, bemoles: boolean): LineaHoja {
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
        if (parseAcorde(dentro)) {
          // A chord closes the stretch before it and opens the next one.
          if (texto || acordePendiente) segmentos.push({ acorde: acordePendiente, texto });
          acordePendiente = semitonos ? transponerAcorde(dentro, semitonos, bemoles) : dentro;
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

/** Put a sheet back as ChordPro text, in another key. */
export function transponerHoja(texto: string, semitonos: number, bemoles: boolean): string {
  if (!semitonos) return texto;
  return texto.replace(/\[([^\]]*)\]/g, (todo, dentro: string) =>
    parseAcorde(dentro) ? `[${transponerAcorde(dentro, semitonos, bemoles)}]` : todo,
  );
}

/** Whether a sheet has anything on it at all. */
export function hojaVacia(letra: string | undefined, acordes: string | undefined): boolean {
  return !(letra?.trim() || acordes?.trim());
}
