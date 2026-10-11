import { describe, expect, it } from "vitest";
import { applyFilters, buildGroups, filasDeLista, pistasPorId, plantillas, plDur, playQueue, queueForView, ultimoId } from "../../store";
import type { CantoralState } from "../../store";
import type { Folder, Playlist, Track } from "../types";

function track(over: Partial<Track> & { id: string }): Track {
  return {
    titulo: "Pista",
    artista: "Artista",
    album: "Album",
    dur: "3:00",
    durSec: 180,
    formato: "MP3",
    carpeta: "Himnos",
    fav: false,
    missing: false,
    added: 1,
    ...over,
  };
}

const TRACKS: Track[] = [
  track({ id: "1", titulo: "Zacarías", album: "B", added: 1, durSec: 100 }),
  track({ id: "2", titulo: "Alabaré", album: "A", added: 3, fav: true, durSec: 300 }),
  track({ id: "3", titulo: "Ñandú", album: "A", added: 2, missing: true, durSec: 200 }),
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

  it("«recientes» shows what the latest scan brought, newest first, ignoring the sort column", () => {
    const tracks = [
      ...TRACKS.map((t) => ({ ...t, nueva: t.id !== "1" })),
      ...Array.from({ length: 12 }, (_, i) => track({ id: `n${i}`, added: 10 + i, nueva: true })),
    ];
    const ids = applyFilters(state({ tracks, qf: "recent" })).map((t) => t.id);
    // Todas las del último escaneo, no las ocho de id más alto (#139).
    expect(ids).toHaveLength(14);
    expect(ids.slice(0, 2)).toEqual(["n11", "n10"]);
    expect(ids.slice(-2)).toEqual(["2", "3"]);
    expect(ids).not.toContain("1");
  });

  it("«recientes» is empty after a scan that brought nothing", () => {
    expect(applyFilters(state({ qf: "recent" }))).toEqual([]);
  });

  it("searches across title, artist and album", () => {
    const s = state({ tracks: [...TRACKS, track({ id: "4", titulo: "Otra", album: "Ensayo", artista: "Coro Emanuel" })] });
    expect(applyFilters({ ...s, query: "ensayo" }).map((t) => t.id)).toEqual(["4"]);
    expect(applyFilters({ ...s, query: "emanuel" }).map((t) => t.id)).toEqual(["4"]);
  });

  it("matches the search case-insensitively", () => {
    expect(applyFilters(state({ query: "ALABARÉ" })).map((t) => t.id)).toEqual(["2"]);
  });

  it("filters on what the catalogue holds, edits included", () => {
    // Editing writes straight into `tracks`, so a changed artist is just a
    // changed track — there is no pending overlay to apply first.
    const editada = TRACKS.map((t) => (t.id === "1" ? { ...t, artista: "Coro Emanuel" } : t));
    const s = state({ tracks: editada, query: "emanuel" });
    expect(applyFilters(s).map((t) => t.id)).toEqual(["1"]);
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
    const s = state({ groupBy: "album" });
    const groups = buildGroups(s, applyFilters(s));
    expect(groups.map((g) => g.label)).toEqual(["A", "B"]);
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
    const s = state({ groupBy: "album" });
    const groups = buildGroups(s, applyFilters(s));

    expect(groups.map((g) => g.clave)).toEqual(["A", "B"]);
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
    const s = state({ groupBy: "album" });
    const list = applyFilters(s);
    expect(buildGroups(s, list)).toBe(buildGroups(s, list));
    expect(buildGroups(state({ groupBy: "carpeta" }), list)).not.toBe(buildGroups(s, list));
  });

  it("remembers the open list as well", () => {
    const s = state({ curPlaylist: "p1", plOrder: { p1: ["3", "1"] } });
    expect(filasDeLista(s)).toBe(filasDeLista(s));
  });

  it("remembers the templates", () => {
    // It feeds views the player is sitting under, so a fresh array each read
    // would re-render them once a second for nothing.
    const listas = [
      { id: "p1", nombre: "Culto", tocada: "", ids: [], plantilla: false },
      { id: "p2", nombre: "Dominical", tocada: "", ids: [], plantilla: true },
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

describe("pistasPorId", () => {
  it("encuentra cada pista por su id", () => {
    const tracks = state().tracks;
    const porId = pistasPorId(tracks);
    for (const t of tracks) expect(porId.get(t.id)).toBe(t);
    expect(porId.get("999")).toBeUndefined();
  });

  it("se construye una vez por catálogo, no una por consulta", () => {
    const tracks = state().tracks;
    expect(pistasPorId(tracks)).toBe(pistasPorId(tracks));
    expect(pistasPorId([...tracks])).not.toBe(pistasPorId(tracks));
  });
});

describe("ultimoId", () => {
  it("compara como números: 10 va después de 9", () => {
    const t = state().tracks[0];
    expect(ultimoId([{ ...t, id: "9" }, { ...t, id: "10" }])).toBe(10);
  });

  it("es 0 sin pistas", () => {
    expect(ultimoId([])).toBe(0);
  });
});
