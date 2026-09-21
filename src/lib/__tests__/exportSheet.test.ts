import { describe, expect, it } from "vitest";
import { playlistSheetHtml, sheetFileName } from "../exportSheet";
import type { Sheet } from "../api";
import type { Playlist, Track } from "../types";

function track(over: Partial<Track> = {}): Track {
  return {
    id: "1",
    titulo: "Santo, Santo, Santo",
    artista: "Ensamble Getsemaní",
    album: "Himnos",
    dur: "3:48",
    durSec: 228,
    tono: "Re",
    bpm: 72,
    ocasion: "Adoración",
    formato: "MP3",
    carpeta: "Himnos",
    tags: [],
    fav: false,
    missing: false,
    tieneHoja: false,
    added: 1,
    ...over,
  };
}

const pl: Playlist = {
  id: "p1",
  nombre: "Culto Domingo",
  fecha: "Domingo 13 de julio",
  ocasion: "Servicio dominical",
  ids: ["1"],
  plantilla: false,
};

describe("sheetFileName", () => {
  it("keeps a plain name and appends the extension", () => {
    expect(sheetFileName("Culto Domingo")).toBe("Culto Domingo.html");
  });

  it("drops characters filesystems reject", () => {
    expect(sheetFileName('Culto 13/07: "especial"?')).toBe("Culto 1307 especial.html");
  });

  it("falls back when the name is empty or only illegal characters", () => {
    expect(sheetFileName("")).toBe("lista.html");
    expect(sheetFileName("///")).toBe("lista.html");
  });
});

describe("playlistSheetHtml", () => {
  it("lists the tracks in the order given, numbered from one", () => {
    const html = playlistSheetHtml(
      pl,
      [track({ id: "1", titulo: "Primera" }), track({ id: "2", titulo: "Segunda" })],
      "8 min",
    );
    expect(html.indexOf("Primera")).toBeLessThan(html.indexOf("Segunda"));
    expect(html).toContain('<td class="num">1</td>');
    expect(html).toContain('<td class="num">2</td>');
  });

  it("puts the playlist metadata in the header", () => {
    const html = playlistSheetHtml(pl, [track()], "24 min");
    expect(html).toContain("Culto Domingo");
    expect(html).toContain("Domingo 13 de julio · Servicio dominical · 1 pista · 24 min");
  });

  it("pluralises the track count", () => {
    const html = playlistSheetHtml(pl, [track(), track({ id: "2" })], "8 min");
    expect(html).toContain("2 pistas");
  });

  it("omits empty metadata fields instead of leaving stray separators", () => {
    const html = playlistSheetHtml({ ...pl, fecha: "", ocasion: "" }, [track()], "4 min");
    expect(html).toContain("1 pista · 4 min");
    expect(html).not.toContain("· ·");
  });

  it("escapes HTML so a track title cannot inject markup", () => {
    const html = playlistSheetHtml(pl, [track({ titulo: '<script>alert("x")</script>' })], "4 min");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("leaves the BPM cell blank when the track has none", () => {
    const html = playlistSheetHtml(pl, [track({ bpm: 0 })], "4 min");
    expect(html).toContain('<td class="num"></td>');
  });

  it("declares utf-8 so Spanish accents survive the round trip", () => {
    const html = playlistSheetHtml(pl, [track()], "4 min");
    expect(html).toContain('<meta charset="utf-8" />');
    expect(html).toContain("Ensamble Getsemaní");
  });
});

describe("las letras en la hoja impresa", () => {
  const hoja = (over: Partial<Sheet> = {}): Record<string, Sheet> => ({
    "1": { trackId: "1", letra: "", acordes: "", ...over },
  });

  it("imprime los acordes encima de la sílaba donde caen", () => {
    const html = playlistSheetHtml(pl, [track()], "4 min", hoja({ acordes: "[Sol]Sublime [Do]gracia" }));

    expect(html).toContain('<span class="a">Sol</span><span class="w">Sublime </span>');
    expect(html).toContain('<span class="a">Do</span><span class="w">gracia</span>');
  });

  it("encabeza cada hoja con el título, el artista y el tono", () => {
    const html = playlistSheetHtml(pl, [track()], "4 min", hoja({ letra: "Aleluya" }));

    expect(html).toContain("<h2>Santo, Santo, Santo</h2>");
    expect(html).toContain("Ensamble Getsemaní · Tono Re");
  });

  it("imprime la letra sola cuando no hay acordes", () => {
    const html = playlistSheetHtml(pl, [track()], "4 min", hoja({ letra: "Aleluya\nAmén" }));

    expect(html).toContain('<pre class="letra">Aleluya\nAmén</pre>');
  });

  it("no imprime una página en blanco por una pista sin letra", () => {
    const html = playlistSheetHtml(pl, [track()], "4 min", hoja());

    expect(html).not.toContain('class="hoja"');
  });

  it("tampoco cuando no se le pasan letras en absoluto", () => {
    // La tabla sola es lo que se imprimía hasta ahora, y sigue valiendo.
    const html = playlistSheetHtml(pl, [track()], "4 min");

    expect(html).not.toContain('class="hoja"');
    expect(html).toContain("Santo, Santo, Santo");
  });

  it("escapa la letra, que es texto que el usuario escribe", () => {
    const html = playlistSheetHtml(pl, [track()], "4 min", hoja({ letra: "<script>alert(1)</script>" }));

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("marca las secciones que la hoja declara", () => {
    const html = playlistSheetHtml(pl, [track()], "4 min", hoja({ acordes: "{Coro}\n[Sol]Santo" }));

    expect(html).toContain("<h3>Coro</h3>");
  });
});
