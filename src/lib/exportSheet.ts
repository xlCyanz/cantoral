// Printable sheet for a culto list. Produces a self-contained HTML document —
// no external CSS, fonts or images — that opens in the system browser, where
// Cmd/Ctrl+P → «Guardar como PDF» turns it into a PDF.

import type { Playlist, Track } from "./types";
import { etiquetaDeTipo } from "./momentos";
import type { Elemento } from "./momentos";

/**
 * Lo que entra en la hoja: el culto entero en su orden (#145), o solo sus
 * pistas, que es como se llamaba antes de que hubiera momentos.
 */
export type FilaDeHoja = Track | Elemento;

function comoElemento(f: FilaDeHoja): Elemento {
  return "clase" in f ? f : { clase: "pista", id: f.id, pista: f };
}

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
 * `filas` must already be in service order, with any pending edits applied.
 */
export function playlistSheetHtml(
  pl: Playlist,
  filas: readonly FilaDeHoja[],
  durLabel: string,
): string {
  const elementos = filas.map(comoElemento);
  const tracks = elementos.flatMap((e) => (e.clase === "pista" ? [e.pista] : []));
  const momentos = elementos.length - tracks.length;
  const rows = elementos
    .map((e, i) => {
      // Un momento sin música es una fila sin duración, en cursiva (#145): quien
      // dirige ve que ahí no se toca, y en qué orden va.
      if (e.clase === "momento") {
        const m = e.momento;
        return `      <tr class="momento">
        <td class="num">${i + 1}</td>
        <td class="titulo">${esc(m.titulo)}</td>
        <td>${[etiquetaDeTipo(m.tipo), m.texto].filter(Boolean).map(esc).join(" · ")}</td>
        <td class="num"></td>
      </tr>`;
      }
      const t = e.pista;
      const cells = [
        String(i + 1),
        esc(t.titulo),
        esc(t.artista),
        esc(t.dur),
      ];
      return `      <tr>
        <td class="num">${cells[0]}</td>
        <td class="titulo">${cells[1]}</td>
        <td>${cells[2]}</td>
        <td class="num">${cells[3]}</td>
      </tr>`;
    })
    .join("\n");

  const meta = [
    `${tracks.length} ${tracks.length === 1 ? "pista" : "pistas"}`,
    momentos > 0 ? `${momentos} ${momentos === 1 ? "momento" : "momentos"}` : "",
    durLabel,
  ]
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
  tr.momento td { font-style: italic; color: #5a626d; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  th.num { text-align: right; }
  footer { margin-top: 26px; font-size: 10.5px; color: #8d95a1; }
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
