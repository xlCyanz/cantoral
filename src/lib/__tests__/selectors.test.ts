import { describe, expect, it } from "vitest";
import { applyFilters, buildGroups, filasDeLista, ocasiones, plantillas, plDur, playQueue, queueForView } from "../../store";
import type { CantoralState } from "../../store";
import type { Folder, Playlist, Track } from "../types";

function track(over: Partial<Track> & { id: string }): Track {
  return {
    titulo: "Pista",
    artista: "Artista",
    album: "Album",
    dur: "3:00",
    durSec: 180,
    bpm: 80,
    ocasion: "Adoración",
    formato: "MP3",
    carpeta: "Himnos",
    fav: false,
    missing: false,
    tieneHoja: false,
    added: 1,
    ...over,
  };
}

const TRACKS: Track[] = [
  track({ id: "1", titulo: "Zacarías", ocasion: "Comunión", album: "B", added: 1, durSec: 100 }),
  track({ id: "2", titulo: "Alabaré", ocasion: "Adoración", album: "A", added: 3, fav: true, durSec: 300 }),
  track({ id: "3", titulo: "Ñandú", ocasion: "Adoración", album: "A", added: 2, missing: true, durSec: 200 }),
];

/**
 * One shared empty filter, the way the store holds one.
 *
 * A fresh `[]` per call would be a new identity every read, and the memoised
 * selectors key on identity — so the fixture would quietly stop exercising the
 * memo it is meant to check.
 */
const SIN_ETIQUETAS: string[] = [];

/** Same reasoning as `SIN_ETIQUETAS`, for the selectors keyed on `playlists`. */
const SIN_LISTAS: Playlist[] = [];

/** Idem, for the two arrays `buildGroups` keys on. */
const SIN_CARPETAS: Folder[] = [];
const NADA_PLEGADO: string[] = [];

/** Una raíz indexada y tres pistas repartidas en dos subcarpetas suyas. */
const CARPETAS: Folder[] = [
  { id: "f1", nombre: "Himnos", ruta: "C:\\Música\\Iglesia\\Himnos", count: 3 },
];
const EN_SUBCARPETAS: Track[] = [
  track({ id: "a", titulo: "Alfa", path: "C:\\Música\\Iglesia\\Himnos\\Clásicos\\a.mp3" }),
  track({ id: "b", titulo: "Beta", path: "C:\\Música\\Iglesia\\Himnos\\Clásicos\\b.mp3" }),
  track({ id: "c", titulo: "Gama", path: "C:\\Música\\Iglesia\\Himnos\\Coritos\\c.mp3" }),
];

/** Minimal state for the pure selectors; they only read these fields. */
function state(over: Partial<CantoralState> = {}): CantoralState {
  return {
    tracks: TRACKS,
    queue: [],
    plOrder: {},
    playlists: SIN_LISTAS,
    folders: SIN_CARPETAS,
    gruposColapsados: NADA_PLEGADO,
    curPlaylist: "",
    view: "biblioteca",
    qf: null,
    ocasion: null,
    tagFilter: SIN_ETIQUETAS,
    query: "",
    groupBy: "none",
    sortKey: "titulo",
    sortDir: "asc",
    ...over,
  } as CantoralState;
}

describe("applyFilters", () => {
  it("sorts titles with Spanish collation, not raw code points", () => {
    // A naive sort puts «Zacarías» before «Ñandú»; es collation does not.
    expect(applyFilters(state()).map((t) => t.titulo)).toEqual(["Alabaré", "Ñandú", "Zacarías"]);
  });

  it("reverses on descending", () => {
    expect(applyFilters(state({ sortDir: "desc" })).map((t) => t.id)).toEqual(["1", "3", "2"]);
  });

  it("sorts by seconds, not by the formatted duration string", () => {
    const ids = applyFilters(state({ sortKey: "dur" })).map((t) => t.id);
    expect(ids).toEqual(["1", "3", "2"]);
  });

  it("filters favourites and missing files", () => {
    expect(applyFilters(state({ qf: "fav" })).map((t) => t.id)).toEqual(["2"]);
    expect(applyFilters(state({ qf: "missing" })).map((t) => t.id)).toEqual(["3"]);
  });

  it("orders «recientes» by recency and ignores the sort column", () => {
    expect(applyFilters(state({ qf: "recent" })).map((t) => t.id)).toEqual(["2", "3", "1"]);
  });

  it("filters by occasion", () => {
    expect(applyFilters(state({ ocasion: "Adoración" })).map((t) => t.id)).toEqual(["2", "3"]);
  });

  it("searches across title, artist, album and occasion", () => {
    const s = state({ tracks: [...TRACKS, track({ id: "4", titulo: "Otra", album: "Ensayo" })] });
    expect(applyFilters({ ...s, query: "ensayo" }).map((t) => t.id)).toEqual(["4"]);
    expect(applyFilters({ ...s, query: "comunión" }).map((t) => t.id)).toEqual(["1"]);
  });

  it("matches the search case-insensitively", () => {
    expect(applyFilters(state({ query: "ALABARÉ" })).map((t) => t.id)).toEqual(["2"]);
  });

  it("filters on what the catalogue holds, edits included", () => {
    // Editing writes straight into `tracks`, so a changed occasion is just a
    // changed track — there is no pending overlay to apply first.
    const editada = TRACKS.map((t) => (t.id === "1" ? { ...t, ocasion: "Adoración" } : t));
    const s = state({ tracks: editada, ocasion: "Adoración" });
    expect(applyFilters(s).map((t) => t.id)).toEqual(["2", "3", "1"]);
  });
});

describe("buildGroups", () => {
  it("returns one headerless group when grouping is off", () => {
    const list = applyFilters(state());
    const groups = buildGroups(state(), list);
    expect(groups).toHaveLength(1);
    expect(groups[0].showHeader).toBe(false);
    expect(groups[0].tracks.map((t) => t.num)).toEqual([1, 2, 3]);
  });

  it("groups by a field and numbers continuously across groups", () => {
    const s = state({ groupBy: "ocasion" });
    const groups = buildGroups(s, applyFilters(s));
    expect(groups.map((g) => g.label)).toEqual(["Adoración", "Comunión"]);
    expect(groups[0].countLabel).toBe("2 pistas");
    expect(groups[1].countLabel).toBe("1 pista");
    expect(groups.flatMap((g) => g.tracks.map((t) => t.num))).toEqual([1, 2, 3]);
  });

  it("agrupa por la carpeta del disco, no por la raíz indexada", () => {
    // Las tres pistas dicen pertenecer a «Himnos», pero en el disco están en
    // dos subcarpetas distintas. Agrupar por la raíz las metía en un montón.
    const s = state({
      groupBy: "carpeta",
      folders: CARPETAS,
      tracks: EN_SUBCARPETAS,
    });
    const groups = buildGroups(s, applyFilters(s));

    expect(groups.map((g) => g.label)).toEqual(["Himnos / Clásicos", "Himnos / Coritos"]);
    expect(groups[0].ruta).toBe("C:\\Música\\Iglesia\\Himnos\\Clásicos");
    expect(groups.map((g) => g.count)).toEqual([2, 1]);
  });

  it("un grupo plegado no entrega pistas, pero sigue diciendo cuántas tiene", () => {
    const s = state({
      groupBy: "carpeta",
      folders: CARPETAS,
      tracks: EN_SUBCARPETAS,
      gruposColapsados: ["f1/Clásicos"],
    });
    const groups = buildGroups(s, applyFilters(s));

    expect(groups[0].colapsado).toBe(true);
    expect(groups[0].tracks).toEqual([]);
    expect(groups[0].count).toBe(2);
    expect(groups[0].countLabel).toBe("2 pistas");
    // El encabezado sigue ahí: si desapareciera no habría dónde desplegarlo.
    expect(groups[0].showHeader).toBe(true);
  });

  it("la numeración solo cuenta lo que se está viendo", () => {
    // Con «Clásicos» plegado, la primera fila visible es la 1 y no la 3.
    const s = state({
      groupBy: "carpeta",
      folders: CARPETAS,
      tracks: EN_SUBCARPETAS,
      gruposColapsados: ["f1/Clásicos"],
    });
    const groups = buildGroups(s, applyFilters(s));

    expect(groups.flatMap((g) => g.tracks.map((t) => t.num))).toEqual([1]);
  });

  it("cada grupo lleva su clave, que es con lo que se plega", () => {
    const s = state({ groupBy: "ocasion" });
    const groups = buildGroups(s, applyFilters(s));

    expect(groups.map((g) => g.clave)).toEqual(["Adoración", "Comunión"]);
  });

  it("sin agrupar no hay nada que plegar", () => {
    const groups = buildGroups(state(), applyFilters(state()));

    expect(groups[0].clave).toBe("");
    expect(groups[0].colapsado).toBe(false);
    expect(groups[0].count).toBe(3);
  });
});

describe("queueForView", () => {
  it("uses the culto list when the playlist view is open", () => {
    const s = state({ view: "lista", curPlaylist: "p1", plOrder: { p1: ["3", "1"] } });
    expect(queueForView(s)).toEqual(["3", "1"]);
  });

  it("uses the filtered library everywhere else", () => {
    expect(queueForView(state())).toEqual(["2", "3", "1"]);
  });

  it("copies the playlist order so later edits do not mutate it", () => {
    const plOrder = { p1: ["3", "1"] };
    const q = queueForView(state({ view: "lista", curPlaylist: "p1", plOrder }));
    q.push("2");
    expect(plOrder.p1).toEqual(["3", "1"]);
  });
});

describe("playQueue", () => {
  it("returns the live queue when one is set", () => {
    expect(playQueue(state({ queue: ["3", "1"] }))).toEqual(["3", "1"]);
  });

  it("drops ids whose track no longer exists", () => {
    expect(playQueue(state({ queue: ["3", "999", "1"] }))).toEqual(["3", "1"]);
  });

  it("falls back to the library when the queue is empty or fully stale", () => {
    expect(playQueue(state())).toEqual(["2", "3", "1"]);
    expect(playQueue(state({ queue: ["999"] }))).toEqual(["2", "3", "1"]);
  });
});

describe("plDur", () => {
  it("totals the durations of the given ids, rounded to minutes", () => {
    expect(plDur(state(), ["1", "2"])).toBe("7 min");
  });

  it("ignores ids that are not in the library", () => {
    expect(plDur(state(), ["1", "999"])).toBe("2 min");
  });

  it("reports zero for an empty list", () => {
    expect(plDur(state(), [])).toBe("0 min");
  });
});

describe("ocasiones", () => {
  it("lists the occasions present in the catalogue, deduplicated and sorted", () => {
    expect(ocasiones(state())).toEqual(["Adoración", "Comunión"]);
  });

  it("is empty when no track carries an occasion", () => {
    const sinOcasion = TRACKS.map((t) => ({ ...t, ocasion: "" }));
    expect(ocasiones(state({ tracks: sinOcasion }))).toEqual([]);
  });

  it("ignores whitespace-only occasions", () => {
    const s = state({ tracks: [track({ id: "1", ocasion: "   " })] });
    expect(ocasiones(s)).toEqual([]);
  });

  it("picks up an occasion the moment a track carries it", () => {
    const editada = TRACKS.map((t) => (t.id === "1" ? { ...t, ocasion: "Bautismo" } : t));
    expect(ocasiones(state({ tracks: editada }))).toContain("Bautismo");
  });

  it("keeps the active filter listed even once no track carries it", () => {
    // Otherwise the chip disappears and the filter can never be switched off.
    const sinOcasion = TRACKS.map((t) => ({ ...t, ocasion: "" }));
    expect(ocasiones(state({ tracks: sinOcasion, ocasion: "Adoración" }))).toEqual(["Adoración"]);
  });

  it("sorts with Spanish collation", () => {
    const s = state({
      tracks: [
        track({ id: "1", ocasion: "Zacarías" }),
        track({ id: "2", ocasion: "Ñandú" }),
        track({ id: "3", ocasion: "Adoración" }),
      ],
    });
    expect(ocasiones(s)).toEqual(["Adoración", "Ñandú", "Zacarías"]);
  });
});

describe("lo que los selectores recuerdan", () => {
  // Every one of these returns an array. If a fresh array came back on each
  // call, a component subscribing to the selector would re-render on every
  // change to the store — including the `posSec` the player writes several
  // times a second — even though nothing it shows had moved.

  it("hands back the very same list while nothing it reads has changed", () => {
    const s = state();
    expect(applyFilters(s)).toBe(applyFilters(s));
    expect(applyFilters(state())).toBe(applyFilters(s));
  });

  it("ignores a change it does not read, so playback does not re-filter", () => {
    const antes = applyFilters(state());
    expect(applyFilters(state({ posSec: 42, playing: true }))).toBe(antes);
  });

  it("recomputes as soon as a field it does read changes", () => {
    const antes = applyFilters(state());
    expect(applyFilters(state({ query: "alab" }))).not.toBe(antes);
  });

  it("recomputes when the catalogue itself is replaced", () => {
    const antes = applyFilters(state());
    expect(applyFilters(state({ tracks: [...TRACKS] }))).not.toBe(antes);
  });

  it("remembers the groups too, until the list or the grouping moves", () => {
    const s = state({ groupBy: "ocasion" });
    const list = applyFilters(s);
    expect(buildGroups(s, list)).toBe(buildGroups(s, list));
    expect(buildGroups(state({ groupBy: "album" }), list)).not.toBe(buildGroups(s, list));
  });

  it("remembers the occasions and the open list as well", () => {
    expect(ocasiones(state())).toBe(ocasiones(state()));
    const s = state({ curPlaylist: "p1", plOrder: { p1: ["3", "1"] } });
    expect(filasDeLista(s)).toBe(filasDeLista(s));
  });

  it("remembers the templates", () => {
    // It feeds views the player is sitting under, so a fresh array each read
    // would re-render them once a second for nothing.
    const listas = [
      { id: "p1", nombre: "Culto", tocada: "", ocasion: "Servicio dominical", ids: [], plantilla: false },
      { id: "p2", nombre: "Dominical", tocada: "", ocasion: "Servicio dominical", ids: [], plantilla: true },
    ];
    const s = state({ playlists: listas });

    expect(plantillas(s)).toBe(plantillas(s));
    expect(plantillas(s).map((p) => p.id)).toEqual(["p2"]);
    expect(plantillas(state({ playlists: [...listas] }))).not.toBe(plantillas(s));
  });

  it("never lets the play queue hand out the remembered list itself", () => {
    // The cached array is shared, so a caller that kept a reference to it and
    // pushed onto it would corrupt what every other caller reads.
    const s = state();
    const lista = applyFilters(s);
    queueForView(s).push("x");
    playQueue(s).push("x");
    expect(applyFilters(s)).toBe(lista);
    expect(lista).toHaveLength(3);
  });
});

describe("filasDeLista", () => {
  it("returns the open list's tracks in its order", () => {
    const s = state({ curPlaylist: "p1", plOrder: { p1: ["3", "1"] } });
    expect(filasDeLista(s).map((t) => t.id)).toEqual(["3", "1"]);
  });

  it("skips ids whose track is no longer in the catalogue", () => {
    const s = state({ curPlaylist: "p1", plOrder: { p1: ["3", "999", "1"] } });
    expect(filasDeLista(s).map((t) => t.id)).toEqual(["3", "1"]);
  });

  it("is empty for a list that has no order yet", () => {
    expect(filasDeLista(state({ curPlaylist: "p9" }))).toEqual([]);
  });
});
