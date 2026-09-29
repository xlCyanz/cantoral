// Buscar por la letra (#144). En la app la búsqueda la hace FTS5 en el núcleo
// (probada en db.rs); aquí, la versión en memoria del navegador, cómo se suma
// a la búsqueda por campos y cómo el store la pide.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyFilters, fragmentosDeLetra, useStore } from "../../store";
import type { CantoralState } from "../../store";
import { usarBackend } from "../backend";
import { crearMemoria } from "../backend/memoria";
import { buscaEnLetras, buscarEnHojas, coincidenciaEnHoja, palabrasDe } from "../buscarLetra";
import type { Track } from "../types";

function pista(id: string, over: Partial<Track> = {}): Track {
  return {
    id,
    titulo: `Pista ${id}`,
    artista: "Coro",
    album: "",
    dur: "3:00",
    durSec: 180,
    ocasion: "",
    formato: "MP3",
    carpeta: "Himnos",
    fav: false,
    missing: false,
    tieneHoja: false,
    added: 1,
    ...over,
  };
}

const hoja = (trackId: string, letra: string, acordes = "") => ({ trackId, letra, acordes });

describe("la búsqueda en una hoja", () => {
  it("encuentra un verso sin mirar tildes, mayúsculas ni orden", () => {
    const h = hoja("a", "Sublime gracia del Señor\nque a un infeliz salvó");
    expect(coincidenciaEnHoja(h, "sublime gracia del")).toBe("Sublime gracia del Señor");
    expect(coincidenciaEnHoja(h, "SENOR sublime")).toBe("Sublime gracia del Señor");
    expect(coincidenciaEnHoja(h, "salvo")).toBe("que a un infeliz salvó");
    expect(coincidenciaEnHoja(h, "sublime grande")).toBeNull();
  });

  it("lee los acordes sin los acordes", () => {
    const h = hoja("a", "", "[Sol]Sublime [Do]gracia del [Re]Señor");
    expect(coincidenciaEnHoja(h, "sublime gracia")).toBe("Sublime gracia del Señor");
  });

  it("las comillas y los signos no son parte de lo buscado", () => {
    expect(palabrasDe("«Corazón», ¡Señor!")).toEqual(["corazon", "senor"]);
    expect(coincidenciaEnHoja(hoja("a", "Mi corazón"), "¿?")).toBeNull();
  });

  it("solo busca desde tres letras", () => {
    expect(buscaEnLetras("mi")).toBe(false);
    expect(buscaEnLetras("  mi  ")).toBe(false);
    expect(buscaEnLetras("¡¿…")).toBe(false);
    expect(buscaEnLetras("dios")).toBe(true);
  });

  it("un verso largo se corta para caber en la fila", () => {
    const larga = "palabra ".repeat(30);
    const f = coincidenciaEnHoja(hoja("a", larga), "palabra")!;
    expect(f.length).toBeLessThanOrEqual(80);
    expect(f.endsWith("…")).toBe(true);
  });

  it("devuelve las pistas y su fragmento", () => {
    const hits = buscarEnHojas([hoja("a", "Santo, santo"), hoja("b", "Aleluya")], "santo");
    expect(hits).toEqual([{ trackId: "a", fragmento: "Santo, santo" }]);
  });
});

describe("la base en memoria busca como el núcleo", () => {
  it("encuentra por la letra, sigue a lo que se edita y olvida lo quitado", async () => {
    const b = crearMemoria({
      tracks: [pista("a"), pista("b")],
      folders: [],
      playlists: [],
      sheets: { a: hoja("a", "Te doy mi corazón") },
    });
    expect((await b.searchLyrics("corazon")).map((h) => h.trackId)).toEqual(["a"]);

    await b.updateTrackSheet("b", "Mi CORAZON es tuyo", "");
    expect((await b.searchLyrics("Corazón")).map((h) => h.trackId).sort()).toEqual(["a", "b"]);

    await b.updateTrackSheet("a", "Aleluya", "");
    await b.deleteTrack("b");
    expect(await b.searchLyrics("corazon")).toEqual([]);
  });
});

describe("applyFilters suma la letra a los campos", () => {
  const TRACKS = [pista("1", { titulo: "Track 03" }), pista("2", { titulo: "Sublime gracia" }), pista("3")];
  const letras = { consulta: "sublime", fragmentos: { "1": "Sublime gracia del Señor", "2": "Sublime gracia" } };

  function state(over: Partial<CantoralState> = {}): CantoralState {
    return {
      tracks: TRACKS,
      qf: null,
      ocasion: null,
      query: "",
      letras: null,
      sortKey: "titulo",
      sortDir: "asc",
      ...over,
    } as CantoralState;
  }

  it("sin respuesta del núcleo, solo los campos", () => {
    expect(applyFilters(state({ query: "sublime" })).map((t) => t.id)).toEqual(["2"]);
  });

  it("con ella, también las que solo lo tienen en la letra", () => {
    const s = state({ query: "sublime", letras });
    expect(applyFilters(s).map((t) => t.id)).toEqual(["2", "1"]);
    // Solo la que salió por la letra lleva el verso: la otra ya lo dice el título.
    expect([...fragmentosDeLetra(s)]).toEqual([["1", "Sublime gracia del Señor"]]);
  });

  it("mientras se sigue escribiendo, la respuesta anterior vale si lo nuevo la continúa", () => {
    expect(applyFilters(state({ query: "sublime gr", letras })).map((t) => t.id)).toContain("1");
    expect(applyFilters(state({ query: "santo", letras })).map((t) => t.id)).toEqual([]);
  });

  it("con menos de tres letras, la letra no cuenta", () => {
    const corta = { consulta: "tr", fragmentos: { "3": "tr" } };
    expect(applyFilters(state({ query: "tr", letras: corta })).map((t) => t.id)).toEqual(["1"]);
  });
});

describe("el store pregunta por la letra", () => {
  const initial = useStore.getState();

  beforeEach(async () => {
    usarBackend(
      crearMemoria({
        tracks: [pista("a", { titulo: "Track 03" }), pista("b", { titulo: "Otra" })],
        folders: [],
        playlists: [],
        sheets: { a: hoja("a", "Sublime gracia del Señor") },
      }),
    );
    useStore.setState(initial, true);
    await useStore.getState().hydrate();
  });

  it("el título sale al instante y la letra cuando contesta", async () => {
    useStore.getState().onQuery("otra");
    expect(applyFilters(useStore.getState()).map((t) => t.id)).toEqual(["b"]);

    useStore.getState().onQuery("gracia del senor");
    expect(applyFilters(useStore.getState())).toEqual([]);
    await vi.waitFor(() => expect(applyFilters(useStore.getState()).map((t) => t.id)).toEqual(["a"]));
    expect(fragmentosDeLetra(useStore.getState()).get("a")).toBe("Sublime gracia del Señor");
  });

  it("editar la letra actualiza el resultado sin volver a buscar", async () => {
    useStore.getState().onQuery("aleluya");
    await useStore.getState().buscarEnLetras();
    expect(applyFilters(useStore.getState())).toEqual([]);

    useStore.getState().openSheetEditor("b");
    useStore.getState().setSheet("letra", "Aleluya, aleluya");
    useStore.getState().closeSheetEditor();

    await vi.waitFor(() => expect(applyFilters(useStore.getState()).map((t) => t.id)).toEqual(["b"]));
  });

  it("una respuesta que llega tarde no pisa a la nueva", async () => {
    useStore.setState({ query: "sublime" });
    const vieja = useStore.getState().buscarEnLetras();
    useStore.setState({ query: "nada que ver" });
    await Promise.all([vieja, useStore.getState().buscarEnLetras()]);
    expect(useStore.getState().letras).toEqual({ consulta: "nada que ver", fragmentos: {} });
  });

  it("borrar la búsqueda suelta la letra", async () => {
    useStore.setState({ query: "sublime" });
    await useStore.getState().buscarEnLetras();
    expect(useStore.getState().letras).not.toBeNull();

    useStore.getState().clearQuery();
    await useStore.getState().buscarEnLetras();
    expect(useStore.getState().letras).toBeNull();
  });
});
