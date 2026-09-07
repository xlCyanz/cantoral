import { describe, expect, it } from "vitest";
import { applyFilters, buildGroups, ocasiones, plDur, playQueue, queueForView } from "../../store";
import type { CantoralState } from "../../store";
import type { Track } from "../types";

function track(over: Partial<Track> & { id: string }): Track {
  return {
    titulo: "Pista",
    artista: "Artista",
    album: "Album",
    dur: "3:00",
    durSec: 180,
    tono: "Do",
    bpm: 80,
    ocasion: "Adoración",
    formato: "MP3",
    carpeta: "Himnos",
    tags: [],
    fav: false,
    missing: false,
    added: 1,
    ...over,
  };
}

const TRACKS: Track[] = [
  track({ id: "1", titulo: "Zacarías", ocasion: "Comunión", album: "B", added: 1, durSec: 100 }),
  track({ id: "2", titulo: "Alabaré", ocasion: "Adoración", album: "A", added: 3, fav: true, durSec: 300 }),
  track({ id: "3", titulo: "Ñandú", ocasion: "Adoración", album: "A", added: 2, missing: true, durSec: 200 }),
];

/** Minimal state for the pure selectors; they only read these fields. */
function state(over: Partial<CantoralState> = {}): CantoralState {
  return {
    tracks: TRACKS,
    edit: {},
    queue: [],
    plOrder: {},
    curPlaylist: "",
    view: "biblioteca",
    qf: null,
    ocasion: null,
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

  it("searches across title, artist, album, key, occasion and tags", () => {
    const s = state({ tracks: [...TRACKS, track({ id: "4", titulo: "Otra", tags: ["ensayo"] })] });
    expect(applyFilters({ ...s, query: "ensayo" }).map((t) => t.id)).toEqual(["4"]);
    expect(applyFilters({ ...s, query: "comunión" }).map((t) => t.id)).toEqual(["1"]);
  });

  it("matches the search case-insensitively", () => {
    expect(applyFilters(state({ query: "ALABARÉ" })).map((t) => t.id)).toEqual(["2"]);
  });

  it("applies pending edits before filtering", () => {
    const s = state({ edit: { "1": { ocasion: "Adoración" } } });
    expect(applyFilters({ ...s, ocasion: "Adoración" }).map((t) => t.id)).toEqual(["2", "3", "1"]);
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

  it("sees occasions added by a pending edit", () => {
    const s = state({ edit: { "1": { ocasion: "Bautismo" } } });
    expect(ocasiones(s)).toContain("Bautismo");
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
