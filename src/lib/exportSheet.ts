// Printable sheet for a culto list. Produces a self-contained HTML document —
// no external CSS, fonts or images — that opens in the system browser, where
// Cmd/Ctrl+P → «Guardar como PDF» turns it into a PDF.

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
export function playlistSheetHtml(pl: Playlist, tracks: Track[], durLabel: string): string {
  const rows = tracks
    .map((t, i) => {
      const cells = [
        String(i + 1),
        esc(t.titulo),
        esc(t.artista),
        esc(t.ocasion),
        esc(t.tono),
        t.bpm ? String(t.bpm) : "",
        esc(t.dur),
      ];
      return `      <tr>
        <td class="num">${cells[0]}</td>
        <td class="titulo">${cells[1]}</td>
        <td>${cells[2]}</td>
        <td>${cells[3]}</td>
        <td class="tono">${cells[4]}</td>
        <td class="num">${cells[5]}</td>
        <td class="num">${cells[6]}</td>
      </tr>`;
    })
    .join("\n");

  const meta = [pl.fecha, pl.ocasion, `${tracks.length} ${tracks.length === 1 ? "pista" : "pistas"}`, durLabel]
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
    color: #1c1613; background: #fff;
  }
  header { border-bottom: 2px solid #a9502e; padding-bottom: 14px; margin-bottom: 22px; }
  .eyebrow {
    font-size: 10px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase;
    color: #a9502e; margin: 0 0 6px;
  }
  h1 { font-size: 26px; font-weight: 700; letter-spacing: -.4px; margin: 0 0 8px; }
  .meta { font-size: 12px; color: #6b5d52; margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left; font-size: 10px; font-weight: 700; letter-spacing: .5px;
    text-transform: uppercase; color: #6b5d52;
    border-bottom: 1px solid #d9cebe; padding: 0 8px 7px;
  }
  td { padding: 9px 8px; border-bottom: 1px solid #ece5db; vertical-align: top; }
  tr { page-break-inside: avoid; }
  .titulo { font-weight: 600; }
  .tono { font-weight: 600; white-space: nowrap; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  th.num { text-align: right; }
  footer { margin-top: 26px; font-size: 10.5px; color: #9a8b7d; }
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
        <th>Tono</th>
        <th class="num">BPM</th>
        <th class="num">Dur.</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <footer>Generado por Cantoral · Imprime esta hoja o guárdala como PDF (Cmd/Ctrl + P).</footer>
</body>
</html>
`;
}
