import { describe, expect, it } from "vitest";
import { playlistSheetHtml, sheetFileName } from "../exportSheet";
import type { Playlist, Track } from "../types";

function track(over: Partial<Track> = {}): Track {
  return {
    id: "1",
    titulo: "Santo, Santo, Santo",
    artista: "Ensamble Getsemaní",
    album: "Himnos",
    dur: "3:48",
    durSec: 228,
    ocasion: "Adoración",
    formato: "MP3",
    carpeta: "Himnos",
    fav: false,
    missing: false,
    added: 1,
    ...over,
  };
}

const pl: Playlist = {
  id: "p1",
  nombre: "Culto Domingo",
  tocada: "",
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
    expect(html).toContain("Servicio dominical · 1 pista · 24 min");
  });

  it("pluralises the track count", () => {
    const html = playlistSheetHtml(pl, [track(), track({ id: "2" })], "8 min");
    expect(html).toContain("2 pistas");
  });

  it("omits empty metadata fields instead of leaving stray separators", () => {
    const html = playlistSheetHtml({ ...pl, tocada: "", ocasion: "" }, [track()], "4 min");
    expect(html).toContain("1 pista · 4 min");
    expect(html).not.toContain("· ·");
  });

  it("escapes HTML so a track title cannot inject markup", () => {
    const html = playlistSheetHtml(pl, [track({ titulo: '<script>alert("x")</script>' })], "4 min");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("has five columns and no tempo one (#141)", () => {
    const html = playlistSheetHtml(pl, [track()], "4 min");
    expect(html.match(/<th[ >]/g)).toHaveLength(5);
    expect(html.match(/<td[ >]/g)).toHaveLength(5);
    expect(html).not.toMatch(/bpm/i);
  });

  it("declares utf-8 so Spanish accents survive the round trip", () => {
    const html = playlistSheetHtml(pl, [track()], "4 min");
    expect(html).toContain('<meta charset="utf-8" />');
    expect(html).toContain("Ensamble Getsemaní");
  });
});

describe("sin letras", () => {
  it("la hoja es solo el repertorio: ninguna página de letra detrás", () => {
    const html = playlistSheetHtml(pl, [track()], "4 min");

    expect(html).not.toContain('class="hoja"');
    expect(html).toContain("Santo, Santo, Santo");
  });
});

describe("la cabecera de la hoja", () => {
  it("no lleva fecha: un culto no la tiene", () => {
    // Cuándo se tocó por última vez es cosa de la app, no de la hoja que se
    // reparte en el culto.
    const html = playlistSheetHtml({ ...pl, tocada: "2026-09-25T10:00:00.000Z" }, [track()], "4 min");

    expect(html).not.toContain("2026");
    expect(html).not.toContain("septiembre");
  });

  it("sin ocasión no se imprime un hueco", () => {
    const html = playlistSheetHtml({ ...pl, ocasion: "" }, [track()], "4 min");

    expect(html).toContain("Culto Domingo");
    expect(html).not.toContain("· ·");
    expect(html).toContain("1 pista · 4 min");
  });
});
