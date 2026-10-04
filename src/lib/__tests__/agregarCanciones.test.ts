// «Agregar canciones…» desde el culto: elegir varias de la biblioteca de una
// vez en lugar de ir y volver por cada una. Se fija qué encuentra el buscador,
// qué hace un clic con y sin Mayúsculas, a dónde van las flechas, que lo
// elegido entra al final del culto en el orden en que se marcó y sin repetir,
// y el marcado que lee un lector de pantalla, también con miles de canciones.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Playlist, Track } from "../types";
import { alternar, buscarCanciones, marcarRango, siguienteElegible, textoDeAgregar } from "../elegirCanciones";
import { crearMemoria } from "../backend/memoria";
import { usarBackend } from "../backend";
import { estadoDeEjemplo } from "./estadoDeEjemplo";

/** El estado que ven los componentes; cada prueba pone el suyo. */
let estado: Record<string, unknown> = {};

// En el servidor zustand lee el estado inicial, no el que se le pone, así que
// los componentes leen de aquí. Las pruebas del store usan el de verdad.
vi.mock("../../store", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../store")>();
  return {
    ...real,
    useStore: Object.assign((selector: (s: Record<string, unknown>) => unknown) => selector(estado), {
      getState: () => real.useStore.getState(),
      setState: real.useStore.setState,
    }),
  };
});
const { useStore, applyFilters } = await vi.importActual<typeof import("../../store")>("../../store");
const { default: AgregarCancionesDialog } = await import("../../components/AgregarCancionesDialog");
const { default: PlaylistView } = await import("../../components/PlaylistView");

const inicial = useStore.getState();

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
    carpeta: "Música",
    fav: false,
    missing: false,
    added: 0,
    tieneHoja: false,
    ...over,
  };
}

const html = (c: Parameters<typeof createElement>[0]) => renderToStaticMarkup(createElement(c));

describe("el buscador del diálogo", () => {
  const tracks = [
    pista("1", { titulo: "Santo, santo, santo" }),
    pista("2", { titulo: "Al que está sentado", artista: "Marcos Witt" }),
    pista("3", { titulo: "Cordero de Dios", ocasion: "Comunión" }),
    pista("4", { titulo: "Bendito", album: "En vivo desde Jerusalén" }),
  ];

  it("sin nada escrito, toda la biblioteca por título", () => {
    expect(buscarCanciones(tracks, "").map((t) => t.id)).toEqual(["2", "4", "3", "1"]);
  });

  it("busca en título, artista, álbum y ocasión", () => {
    expect(buscarCanciones(tracks, "santo").map((t) => t.id)).toEqual(["1"]);
    expect(buscarCanciones(tracks, "witt").map((t) => t.id)).toEqual(["2"]);
    expect(buscarCanciones(tracks, "vivo").map((t) => t.id)).toEqual(["4"]);
    expect(buscarCanciones(tracks, "comunion").map((t) => t.id)).toEqual(["3"]);
  });

  it("sin tildes ni mayúsculas, en los dos sentidos", () => {
    expect(buscarCanciones(tracks, "ESTÁ").map((t) => t.id)).toEqual(["2"]);
    expect(buscarCanciones(tracks, "jerusalen").map((t) => t.id)).toEqual(["4"]);
    expect(buscarCanciones(tracks, "Cómunión").map((t) => t.id)).toEqual(["3"]);
  });

  it("encuentra lo mismo que la biblioteca", () => {
    // La tabla y el diálogo comparten la coincidencia: lo que se encuentra en
    // uno se encuentra en el otro.
    const s = { ...useStore.getState(), tracks, qf: null, ocasion: null, letras: null, sortKey: "titulo", sortDir: "asc" } as never;
    for (const q of ["santo", "jerusalen", "ESTÁ", "comunion"]) {
      expect(applyFilters({ ...(s as object), query: q } as never).map((t: Track) => t.id)).toEqual(buscarCanciones(tracks, q).map((t) => t.id));
    }
  });
});

describe("marcar", () => {
  const visibles = ["a", "b", "c", "d", "e"];
  const ninguna = new Set<string>();

  it("las elegidas guardan el orden en que se marcaron", () => {
    expect(alternar(alternar(alternar([], "c"), "a"), "e")).toEqual(["c", "a", "e"]);
    expect(alternar(["c", "a", "e"], "a")).toEqual(["c", "e"]);
  });

  it("Mayúsculas marca el tramo, en el orden que se ve, detrás de lo ya elegido", () => {
    expect(marcarRango(visibles, ["e", "b"], "b", "d", true, ninguna)).toEqual(["e", "b", "c", "d"]);
    // Hacia arriba es el mismo tramo.
    expect(marcarRango(visibles, ["d"], "d", "b", true, ninguna)).toEqual(["d", "b", "c"]);
  });

  it("desmarcando con Mayúsculas, se desmarca el tramo", () => {
    expect(marcarRango(visibles, ["a", "b", "c", "e"], "a", "c", false, ninguna)).toEqual(["e"]);
  });

  it("el tramo se salta las que ya están en el culto", () => {
    expect(marcarRango(visibles, ["a"], "a", "d", true, new Set(["c"]))).toEqual(["a", "b", "d"]);
  });

  it("sin el punto de partida a la vista es un clic normal", () => {
    expect(marcarRango(visibles, [], "z", "c", true, ninguna)).toEqual(["c"]);
  });

  it("las flechas se saltan las que ya están y se paran en los bordes", () => {
    const ya = new Set(["b", "c"]);
    expect(siguienteElegible(visibles, 0, 1, ya)).toBe(3);
    expect(siguienteElegible(visibles, 3, -1, ya)).toBe(0);
    expect(siguienteElegible(visibles, -1, 1, new Set(["a"]))).toBe(1);
    expect(siguienteElegible(visibles, 4, 1, ya)).toBeNull();
    expect(siguienteElegible(visibles, 0, -1, ya)).toBeNull();
  });

  it("el botón dice cuántas", () => {
    expect(textoDeAgregar(0)).toBe("Agregar canciones");
    expect(textoDeAgregar(1)).toBe("Agregar 1 canción");
    expect(textoDeAgregar(12)).toBe("Agregar 12 canciones");
  });
});

describe("en el store", () => {
  const culto: Playlist = {
    id: "p1",
    nombre: "Domingo",
    ocasion: "",
    ids: ["a", "m:1"],
    momentos: [{ id: "m:1", tipo: "oracion", titulo: "Oración", texto: "" }],
    plantilla: false,
    tocada: "",
  };

  beforeEach(async () => {
    useStore.setState(inicial, true);
    usarBackend(crearMemoria({ tracks: ["a", "b", "c", "d"].map((id) => pista(id)), playlists: [culto] }));
    await useStore.getState().hydrate();
    useStore.setState({ curPlaylist: "p1", view: "lista", selection: ["d"] });
  });

  it("abre el diálogo sobre el culto abierto", () => {
    useStore.getState().abrirAgregarCanciones();
    expect(useStore.getState().dialog).toBe("agregarCanciones");
  });

  it("sin un culto abierto no abre nada", () => {
    useStore.setState({ curPlaylist: "no-existe" });
    useStore.getState().abrirAgregarCanciones();
    expect(useStore.getState().dialog).toBeNull();
  });

  it("agrega todas de una vez, al final y en el orden en que se marcaron", async () => {
    useStore.getState().abrirAgregarCanciones();
    useStore.getState().agregarAlCultoAbierto(["c", "b"]);

    expect(useStore.getState().dialog).toBeNull();
    // Detrás del momento, que era lo último.
    await vi.waitFor(() => expect(useStore.getState().plOrder.p1).toEqual(["a", "m:1", "c", "b"]));
    expect(useStore.getState().toast?.detalle).toBe("2 pistas, al final del culto.");
  });

  it("no repite las que ya estaban", async () => {
    useStore.getState().agregarAlCultoAbierto(["a", "b"]);

    await vi.waitFor(() => expect(useStore.getState().plOrder.p1).toEqual(["a", "m:1", "b"]));
  });

  it("no toca la selección de la biblioteca", async () => {
    useStore.getState().agregarAlCultoAbierto(["b"]);

    await vi.waitFor(() => expect(useStore.getState().plOrder.p1).toContain("b"));
    expect(useStore.getState().selection).toEqual(["d"]);
  });
});

describe("el diálogo", () => {
  beforeEach(() => {
    estado = { ...useStore.getState(), ...estadoDeEjemplo(), dialog: "agregarCanciones" };
  });

  it("cerrado no pinta nada", () => {
    estado = { ...estado, dialog: null };
    expect(html(AgregarCancionesDialog)).toBe("");
  });

  it("tiene nombre, dice dónde caen y empieza en el buscador", () => {
    const h = html(AgregarCancionesDialog);

    expect(h).toMatch(/role="dialog" aria-modal="true" aria-labelledby="agregar-canciones-titulo" aria-describedby="agregar-canciones-ayuda"/);
    expect(h).toContain("Agregar canciones a «Culto dominical»");
    expect(h).toMatch(/<input[^>]*type="search"[^>]*aria-label="Buscar en la biblioteca"/);
  });

  it("una casilla de verdad por canción, y las del culto marcadas y deshabilitadas", () => {
    const h = html(AgregarCancionesDialog);
    const casillas = h.match(/<input type="checkbox"[^>]*>/g) ?? [];
    const enElCulto = (estado.plOrder as Record<string, string[]>).p1.length;

    expect(casillas).toHaveLength((estado.tracks as Track[]).length);
    expect(casillas.filter((c) => c.includes('disabled=""') && c.includes('checked=""'))).toHaveLength(enElCulto);
    expect(h.match(/Ya está en el culto/g)).toHaveLength(enElCulto);
    // La pintada no se anuncia dos veces.
    expect(h).toMatch(/<span aria-hidden="true" class="casilla-marca"/);
  });

  it("una sola parada de Tab en la lista", () => {
    const h = html(AgregarCancionesDialog);
    expect(h.match(/<input type="checkbox"[^>]*tabindex="0"/g)).toHaveLength(1);
  });

  it("sin nada marcado, el botón de agregar está apagado", () => {
    expect(html(AgregarCancionesDialog)).toMatch(/<button disabled=""[^>]*>.*?Agregar canciones<\/button>/);
  });

  it("con miles de canciones solo pinta las que se ven", () => {
    const muchas = Array.from({ length: 5000 }, (_, i) => pista(String(i + 1), { titulo: `Canción ${String(i).padStart(4, "0")}` }));
    estado = { ...estado, tracks: muchas };

    const h = html(AgregarCancionesDialog);
    const casillas = h.match(/<input type="checkbox"/g) ?? [];

    expect(casillas.length).toBeGreaterThan(0);
    expect(casillas.length).toBeLessThan(40);
    // El alto de la lista entera sostiene la barra de desplazamiento.
    expect(h).toContain("height:250000px");
    expect(h).toContain('aria-label="5000 canciones de la biblioteca"');
  });

  it("con la biblioteca vacía lo dice", () => {
    estado = { ...estado, tracks: [] };
    expect(html(AgregarCancionesDialog)).toContain("La biblioteca está vacía");
  });
});

describe("dónde se abre", () => {
  beforeEach(() => {
    estado = { ...useStore.getState(), ...estadoDeEjemplo(), view: "lista" };
  });

  it("junto a las acciones del culto", () => {
    expect(html(PlaylistView)).toContain("Agregar canciones…");
  });

  it("y en un culto vacío, como la acción principal", () => {
    estado = { ...estado, plOrder: { ...(estado.plOrder as object), p1: [] } };
    const h = html(PlaylistView);

    expect(h).toContain("Esta lista está vacía");
    expect(h).toMatch(/class="hb-primary"[^>]*>.*?Agregar canciones…<\/button>/);
    expect(h).not.toContain("Ir a la biblioteca");
  });
});
