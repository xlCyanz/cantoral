// «Todas» de la barra lateral solo cambiaba de vista. Estando ya en la
// biblioteca con un filtro puesto no hacía nada: ni se encendía el botón ni
// cambiaba la tabla, que es exactamente como se lee un botón roto.
//
// Lo que se fija aquí es que suelte *todo* lo que estreche la biblioteca —el
// filtro rápido, la ocasión, las etiquetas y la búsqueda— y que no se lleve
// por delante la pantalla de una biblioteca sin indexar.

import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../../store";

const initial = useStore.getState();

beforeEach(() => {
  useStore.setState(initial, true);
});

describe("ver toda la biblioteca", () => {
  it("suelta el filtro rápido", () => {
    useStore.setState({ view: "biblioteca", qf: "fav" });

    useStore.getState().verTodaLaBiblioteca();

    expect(useStore.getState().qf).toBeNull();
  });

  it("suelta la ocasión", () => {
    useStore.setState({ ocasion: "Adoración" });

    useStore.getState().verTodaLaBiblioteca();

    expect(useStore.getState().ocasion).toBeNull();
  });

  it("suelta las etiquetas", () => {
    // «Todas» quiere decir todas: una etiqueta puesta dejaba la tabla
    // filtrada con el botón diciendo que estaban todas.
    useStore.setState({ tagFilter: ["clásico", "lento"] });

    useStore.getState().verTodaLaBiblioteca();

    expect(useStore.getState().tagFilter).toEqual([]);
  });

  it("y suelta la búsqueda", () => {
    useStore.setState({ query: "coro" });

    useStore.getState().verTodaLaBiblioteca();

    expect(useStore.getState().query).toBe("");
  });

  it("lleva a la biblioteca desde donde sea", () => {
    useStore.setState({ view: "config" });

    useStore.getState().verTodaLaBiblioteca();

    expect(useStore.getState().view).toBe("biblioteca");
  });

  it("saca de la pantalla de error, que es lo que costaba", () => {
    useStore.setState({ libState: "error", tracks: initial.tracks });

    useStore.getState().verTodaLaBiblioteca();

    expect(useStore.getState().libState).toBe("content");
  });

  it("pero no finge que hay biblioteca cuando no hay nada indexado", () => {
    // Poner «content» a secas enseñaría una tabla vacía en vez de la pantalla
    // que explica cómo empezar.
    useStore.setState({ tracks: [], libState: "empty" });

    useStore.getState().verTodaLaBiblioteca();

    expect(useStore.getState().libState).toBe("empty");
  });
});

describe("ir a la biblioteca sin tocar nada", () => {
  it("es otra cosa: `⌘F` no puede borrar lo que se está buscando", () => {
    // El atajo de buscar lleva a la biblioteca y enfoca el campo. Si de paso
    // limpiara la búsqueda, pulsarlo dos veces borraría lo escrito.
    useStore.setState({ view: "config", query: "coro", qf: "fav" });

    useStore.getState().showBiblioteca();

    expect(useStore.getState().view).toBe("biblioteca");
    expect(useStore.getState().query).toBe("coro");
    expect(useStore.getState().qf).toBe("fav");
  });
});

describe("el filtro rápido", () => {
  it("tampoco finge contenido sobre una biblioteca vacía", () => {
    useStore.setState({ tracks: [], libState: "empty" });

    useStore.getState().onQuickFilter("fav");

    expect(useStore.getState().libState).toBe("empty");
  });

  it("y se apaga al volver a pulsarlo", () => {
    useStore.setState({ qf: "fav" });

    useStore.getState().onQuickFilter("fav");

    expect(useStore.getState().qf).toBeNull();
  });
});
