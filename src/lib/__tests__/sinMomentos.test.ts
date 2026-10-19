// Los momentos sin música (#145) se quitaron. El núcleo ya no los devuelve,
// pero un orden que todavía traiga un `m:…` —de una sesión de antes, de un
// archivo armado a mano— no puede colarse en lo que suena ni en la hoja: se
// salta, como una pista que ya no está en la biblioteca.

import { beforeEach, describe, expect, it } from "vitest";
import type { Playlist, Track } from "../types";
import { playlistSheetHtml } from "../exportSheet";

const { useStore, filasDeLista, playQueue } = await import("../../store");
const initial = useStore.getState();

function pista(id: string): Track {
  return { id, titulo: `Canción ${id}`, artista: "Coro", album: "", dur: "3:00", durSec: 180, formato: "MP3", carpeta: "Música", fav: false, missing: false, added: 0 };
}

const culto: Playlist = { id: "p1", nombre: "Domingo", ids: ["a", "m:1", "b"], plantilla: false, tocada: "" };

beforeEach(() => {
  useStore.setState(initial, true);
  useStore.setState({ tracks: [pista("a"), pista("b")], playlists: [culto], plOrder: { p1: culto.ids.slice() }, curPlaylist: "p1", view: "lista" });
});

describe("un orden con un momento de antes", () => {
  it("la tabla del culto solo enseña las canciones", () => {
    expect(filasDeLista(useStore.getState()).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("«Reproducir todo» las pone en cola sin el momento", () => {
    useStore.getState().playAll();

    const s = useStore.getState();
    expect(s.queue).toEqual(["a", "b"]);
    expect(playQueue(s)).toEqual(["a", "b"]);
  });

  it("y la cola salta por encima aunque lo traiga", () => {
    useStore.getState().play("a", ["a", "m:1", "b"]);

    useStore.getState().next();

    expect(useStore.getState().playerId).toBe("b");
  });

  it("la hoja impresa no tiene fila para él", () => {
    const html = playlistSheetHtml(culto, filasDeLista(useStore.getState()), "6:00");

    expect(html).toContain("2 pistas");
    expect(html).not.toContain("m:1");
    expect(html).not.toMatch(/momento/i);
  });
});
