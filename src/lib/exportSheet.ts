// Printable sheet for a culto list. Produces a self-contained HTML document —
// no external CSS, fonts or images — that opens in the system browser, where
// Cmd/Ctrl+P → «Guardar como PDF» turns it into a PDF.

import { parseHoja } from "./chords";
import type { Sheet } from "./api";
import type { Playlist, Track } from "./types";

/** Escape text for HTML body / attribute interpolation. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Strip characters that filesystems reject, so the sheet gets a usable name. */
export function sheetFileName(nombre: string): string {
  const clean = nombre.replace(/[\\/:*?"<>|]/g, "").trim();
  return `${clean || "lista"}.html`;
}

/**
 * Render the playlist as a printable sheet.
 *
 * `tracks` must already be in service order, with any pending edits applied.
 */
/**
 * The lyrics of the repertoire, each song on its own page.
 *
 * Printed after the table rather than instead of it: the table is what the
 * person running the service reads, and this is what the musicians read. Songs
 * with nothing written are left out rather than printed as a blank page.
 */
function lyricsHtml(tracks: Track[], sheets: Record<string, Sheet>): string {
  const paginas = tracks
    .map((t) => {
      const hoja = sheets[t.id];
      const acordes = hoja?.acordes?.trim() ?? "";
      const letra = hoja?.letra?.trim() ?? "";
      if (!escrita(hoja)) return "";
      const cuerpo = acordes ? lineasHtml(acordes) : `<pre class="letra">${esc(letra)}</pre>`;
      return `  <section class="hoja">
    <h2>${esc(t.titulo)}</h2>
    <p class="meta">${esc(t.artista)}</p>
${cuerpo}
  </section>`;
    })
    .filter(Boolean);
  return paginas.join("\n");
}

/**
 * Whether a sheet would print anything.
 *
 * A sheet that was opened and closed again holds newlines, not words, and a
 * page with nothing on it is worse than no page.
 */
function escrita(hoja: Sheet | undefined): boolean {
  return !!(hoja?.acordes?.trim() || hoja?.letra?.trim());
}

/**
 * Whether this list has any lyrics to print at all.
 *
 * Decides whether the preview may offer «con letras y acordes»: an option that
 * changes nothing is an option that makes the user wonder what they missed.
 */
export function hayLetras(tracks: readonly Track[], sheets: Record<string, Sheet>): boolean {
  return tracks.some((t) => escrita(sheets[t.id]));
}

/** One ChordPro sheet as chords stacked over the words they fall on. */
function lineasHtml(acordes: string): string {
  return parseHoja(acordes)
    .map((linea) => {
      if (linea.tipo === "vacia") return '    <div class="blanco"></div>';
      if (linea.tipo === "seccion") return `    <h3>${esc(linea.etiqueta ?? "")}</h3>`;
      const trozos = linea.segmentos
        .map(
          (seg) =>
            `<span class="t"><span class="a">${esc(seg.acorde)}</span><span class="w">${esc(seg.texto)}</span></span>`,
        )
        .join("");
      return `    <div class="linea">${trozos}</div>`;
    })
    .join("\n");
}

export function playlistSheetHtml(
  pl: Playlist,
  tracks: Track[],
  durLabel: string,
  sheets: Record<string, Sheet> = {},
): string {
  const rows = tracks
    .map((t, i) => {
      const cells = [
        String(i + 1),
        esc(t.titulo),
        esc(t.artista),
        esc(t.ocasion),
        t.bpm ? String(t.bpm) : "",
        esc(t.dur),
      ];
      return `      <tr>
        <td class="num">${cells[0]}</td>
        <td class="titulo">${cells[1]}</td>
        <td>${cells[2]}</td>
        <td>${cells[3]}</td>
        <td class="num">${cells[4]}</td>
        <td class="num">${cells[5]}</td>
      </tr>`;
    })
    .join("\n");

  const lyrics = lyricsHtml(tracks, sheets);
  const meta = [pl.ocasion, `${tracks.length} ${tracks.length === 1 ? "pista" : "pistas"}`, durLabel]
    .filter(Boolean)
    .map(esc)
    .join(" · ");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${esc(pl.nombre)} — Cantoral</title>
<style>
  @page { margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 28px 32px;
    font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    color: #191c21; background: #fff;
  }
  header { border-bottom: 2px solid #3a4d8f; padding-bottom: 14px; margin-bottom: 22px; }
  .eyebrow {
    font-size: 10px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase;
    color: #3a4d8f; margin: 0 0 6px;
  }
  h1 { font-size: 26px; font-weight: 700; letter-spacing: -.4px; margin: 0 0 8px; }
  .meta { font-size: 12px; color: #5a626d; margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left; font-size: 10px; font-weight: 700; letter-spacing: .5px;
    text-transform: uppercase; color: #5a626d;
    border-bottom: 1px solid #cbd1da; padding: 0 8px 7px;
  }
  td { padding: 9px 8px; border-bottom: 1px solid #e1e5ea; vertical-align: top; }
  tr { page-break-inside: avoid; }
  .titulo { font-weight: 600; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  th.num { text-align: right; }
  footer { margin-top: 26px; font-size: 10.5px; color: #8d95a1; }
  .hoja { page-break-before: always; margin-top: 34px; }
  .hoja h2 { font-size: 19px; margin: 0 0 2px; }
  .hoja .meta { font-size: 11px; color: #8d95a1; margin: 0 0 14px; }
  .hoja h3 { font-size: 11px; letter-spacing: .5px; text-transform: uppercase; color: #3a4d8f; margin: 16px 0 4px; }
  .linea { display: flex; flex-wrap: wrap; margin-bottom: 3px; font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: 13px; line-height: 1.25; }
  .linea .t { display: inline-block; white-space: pre; }
  .linea .a { display: block; font-weight: 700; color: #3a4d8f; min-height: 1.2em; }
  .linea .w { display: block; }
  .blanco { height: 12px; }
  pre.letra { font-family: inherit; font-size: 13px; line-height: 1.6; white-space: pre-wrap; margin: 0; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <header>
    <p class="eyebrow">Lista para culto</p>
    <h1>${esc(pl.nombre)}</h1>
    <p class="meta">${meta}</p>
  </header>
  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th>Título</th>
        <th>Artista</th>
        <th>Ocasión</th>
        <th class="num">BPM</th>
        <th class="num">Dur.</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
${lyrics}
  <footer>Generado por Cantoral · Imprime esta hoja o guárdala como PDF (Cmd/Ctrl + P).</footer>
</body>
</html>
`;
}
