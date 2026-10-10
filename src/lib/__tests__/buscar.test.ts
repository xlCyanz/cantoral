// Buscar sin mirar mayúsculas ni tildes: lo que usan la biblioteca y el diálogo
// de «Agregar canciones».

import { describe, expect, it } from "vitest";
import { coincideEnCampos, sinTildes } from "../buscar";
import type { Track } from "../types";

function pista(over: Partial<Track> = {}): Track {
  return {
    id: "a",
    titulo: "Sublime gracia",
    artista: "Coro de la Iglesia",
    album: "Himnos del Señor",
    dur: "3:00",
    durSec: 180,
    ocasion: "",
    formato: "MP3",
    carpeta: "Himnos",
    fav: false,
    missing: false,
    added: 1,
    ...over,
  };
}

describe("sinTildes", () => {
  it("deja el texto en minúsculas y sin tildes", () => {
    expect(sinTildes("Señor, ÉL Salvó")).toBe("senor, el salvo");
  });
});

describe("coincideEnCampos", () => {
  it("encuentra en el título, el artista y el álbum sin mirar tildes", () => {
    const t = pista();
    expect(coincideEnCampos(t, sinTildes("SUBLIME"))).toBe(true);
    expect(coincideEnCampos(t, sinTildes("iglesia"))).toBe(true);
    expect(coincideEnCampos(t, sinTildes("senor"))).toBe(true);
    expect(coincideEnCampos(t, sinTildes("grande"))).toBe(false);
  });
});
