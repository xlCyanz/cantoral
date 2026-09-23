// Elegir por qué pantalla sale la proyección es la decisión que más caro sale
// equivocar: si por defecto apunta a la pantalla del operador, lo primero que
// ve la congregación un domingo es el escritorio de quien opera. Lo que se fija
// aquí es que por defecto vaya a la otra, que mover la salida en marcha no la
// cierre, y que no se mande nada a una salida que no está abierta.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EstadoProyeccion, MonitorInfo, SalidaProyeccion } from "../api";
import type { Track } from "../types";

const projectionMonitors = vi.fn<() => Promise<MonitorInfo[]>>();
const openProjectionCmd = vi.fn<(m: number) => Promise<void>>();
const closeProjectionCmd = vi.fn<() => Promise<void>>();
const setProjectionCmd = vi.fn<(c: SalidaProyeccion) => Promise<void>>();
/** Lo que la salida devuelve, para poder empujarlo desde el test. */
let contestar: ((e: EstadoProyeccion) => void) | null = null;
/** El aviso de «ya estoy escuchando» que manda la ventana de salida. */
let avisarLista: (() => void) | null = null;

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  isTauri: () => true,
  projectionMonitors: () => projectionMonitors(),
  openProjectionCmd: (m: number) => openProjectionCmd(m),
  closeProjectionCmd: () => closeProjectionCmd(),
  setProjectionCmd: (c: SalidaProyeccion) => setProjectionCmd(c),
  onProjectionState: (cb: (e: EstadoProyeccion) => void) => {
    contestar = cb;
    return Promise.resolve(() => {
      contestar = null;
    });
  },
  onProjectionReady: (cb: () => void) => {
    avisarLista = cb;
    return Promise.resolve(() => {
      avisarLista = null;
    });
  },
}));

const { useStore } = await import("../../store");
const initial = useStore.getState();

function pantalla(indice: number, over: Partial<MonitorInfo> = {}): MonitorInfo {
  return { indice, nombre: `Pantalla ${indice + 1}`, ancho: 1920, alto: 1080, principal: false, ...over };
}

const PORTATIL = pantalla(0, { nombre: "Built-in", principal: true });
const PROYECTOR = pantalla(1, { nombre: "DELL P2219H" });

beforeEach(() => {
  useStore.setState(initial, true);
  for (const m of [projectionMonitors, openProjectionCmd, closeProjectionCmd, setProjectionCmd]) m.mockReset();
  projectionMonitors.mockResolvedValue([PORTATIL, PROYECTOR]);
  openProjectionCmd.mockResolvedValue(undefined);
  closeProjectionCmd.mockResolvedValue(undefined);
  setProjectionCmd.mockResolvedValue(undefined);
  contestar = null;
  avisarLista = null;
});

describe("elegir pantalla", () => {
  it("por defecto sale por la que no es la del operador", async () => {
    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitorSalida).toBe(PROYECTOR.indice);
  });

  it("con una sola pantalla no queda más remedio que esa", async () => {
    // Preparando un jueves, sin proyector: la salida tapará la ventana, que es
    // lo que de verdad pasa, y es mejor que un botón que no hace nada.
    projectionMonitors.mockResolvedValue([PORTATIL]);

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitorSalida).toBe(PORTATIL.indice);
  });

  it("sin ninguna pantalla no se inventa un índice", async () => {
    projectionMonitors.mockResolvedValue([]);

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitores).toEqual([]);
    expect(useStore.getState().monitorSalida).toBe(0);
  });

  it("si ya se está proyectando, volver a mirar no cambia la pantalla debajo", async () => {
    // Enchufar un teclado no puede mover la proyección a mitad de un culto.
    await useStore.getState().cargarMonitores();
    useStore.getState().elegirMonitor(0);
    useStore.setState({ proyectando: true });

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitorSalida).toBe(0);
  });

  it("y si el índice elegido ya no existe, vuelve a decidir", async () => {
    useStore.setState({ proyectando: true, monitorSalida: 7 });

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitorSalida).toBe(PROYECTOR.indice);
  });

  it("que el núcleo falle deja la lista vacía, no revienta la vista", async () => {
    projectionMonitors.mockRejectedValue(new Error("sin ventana"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await useStore.getState().cargarMonitores();

    expect(useStore.getState().monitores).toEqual([]);
  });
});

describe("abrir y cerrar la salida", () => {
  it("abre por la pantalla elegida y lo recuerda", async () => {
    await useStore.getState().cargarMonitores();

    useStore.getState().alternarProyeccion();

    expect(openProjectionCmd).toHaveBeenCalledWith(PROYECTOR.indice);
    await vi.waitFor(() => expect(useStore.getState().proyectando).toBe(true));
  });

  it("si no se pudo abrir, no se queda diciendo que está en vivo", async () => {
    openProjectionCmd.mockRejectedValue(new Error("no hay pantalla 2"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await useStore.getState().cargarMonitores();

    useStore.getState().alternarProyeccion();

    await vi.waitFor(() => expect(useStore.getState().toast?.type).toBe("error"));
    expect(useStore.getState().proyectando).toBe(false);
  });

  it("el mismo botón la corta", async () => {
    useStore.setState({ proyectando: true });

    useStore.getState().alternarProyeccion();

    expect(closeProjectionCmd).toHaveBeenCalled();
    expect(useStore.getState().proyectando).toBe(false);
  });

  it("cambiar de pantalla en marcha la mueve, no la cierra", async () => {
    // Cerrar y volver a abrir sería un parpadeo delante de la congregación.
    useStore.setState({ proyectando: true, monitores: [PORTATIL, PROYECTOR] });

    useStore.getState().elegirMonitor(0);

    expect(openProjectionCmd).toHaveBeenCalledWith(0);
    expect(closeProjectionCmd).not.toHaveBeenCalled();
    expect(useStore.getState().proyectando).toBe(true);
  });

  it("y apagada solo se apunta cuál será", () => {
    useStore.setState({ proyectando: false, monitores: [PORTATIL, PROYECTOR] });

    useStore.getState().elegirMonitor(1);

    expect(openProjectionCmd).not.toHaveBeenCalled();
    expect(useStore.getState().monitorSalida).toBe(1);
  });
});

describe("mandar contenido a la salida", () => {
  it("no manda nada si no hay salida abierta", () => {
    useStore.setState({ proyectando: false });

    useStore.getState().proyectar({ vista: { modo: "negro" } });

    expect(setProjectionCmd).not.toHaveBeenCalled();
  });

  it("y con la salida abierta manda lo que se le pide", () => {
    useStore.setState({ proyectando: true });

    useStore.getState().proyectar({ vista: { modo: "titulo", titulo: "Sublime Gracia" } });

    expect(setProjectionCmd).toHaveBeenCalledWith({ vista: { modo: "titulo", titulo: "Sublime Gracia" } });
  });
});


// ---------------------------------------------------------------- la cola

/**
 * Un culto de tres elementos, con la pista del medio en video.
 *
 * Con rutas reales y no ids: lo que viaja a la salida es la ruta, y media
 * mitad de lo que se fija aquí es exactamente *qué ruta* llega.
 */
function pista(id: string, over: Partial<Track> = {}): Track {
  return {
    id,
    titulo: `Pista ${id}`,
    artista: "Coro",
    album: "",
    dur: "3:00",
    durSec: 180,
    tono: "",
    bpm: 0,
    ocasion: "",
    formato: "MP3",
    carpeta: "Música",
    tags: [],
    fav: false,
    missing: false,
    added: 0,
    tieneHoja: false,
    path: `/m/${id}.mp3`,
    ...over,
  };
}

/** Deja un culto de tres abierto y la salida en marcha. */
function culto(pistas: Track[] = [pista("a"), pista("b", { video: true, path: "/m/b.mp4" }), pista("c")]) {
  useStore.setState({
    tracks: pistas,
    curPlaylist: "p1",
    plOrder: { p1: pistas.map((t) => t.id) },
    proyectando: true,
    proyeccionIdx: -1,
  });
  return pistas;
}

/** El último mensaje mandado a la salida. */
const ultimo = (): SalidaProyeccion => {
  const llamadas = setProjectionCmd.mock.calls;
  return llamadas[llamadas.length - 1][0];
};

describe("proyectar el culto", () => {
  it("pone en pantalla el elemento pedido y precarga el siguiente", () => {
    culto();

    useStore.getState().proyectarElemento(0);

    expect(useStore.getState().proyeccionIdx).toBe(0);
    expect(ultimo().vista).toMatchObject({ modo: "media", src: "/m/a.mp3", video: false, reproduciendo: true });
    // Lo que viene después ya va cargándose: el salto de un elemento a otro
    // es lo único que se nota desde la congregación.
    expect(ultimo().precarga).toBe("/m/b.mp4");
  });

  it("un video se manda marcado como tal", () => {
    culto();

    useStore.getState().proyectarElemento(1);

    expect(ultimo().vista).toMatchObject({ modo: "media", src: "/m/b.mp4", video: true });
  });

  it("«Siguiente» avanza uno y arrastra la precarga", () => {
    culto();
    useStore.getState().proyectarElemento(0);

    useStore.getState().proyeccionSiguiente();

    expect(useStore.getState().proyeccionIdx).toBe(1);
    expect(ultimo().vista).toMatchObject({ src: "/m/b.mp4" });
    expect(ultimo().precarga).toBe("/m/c.mp3");
  });

  it("y al final del culto deja el proyector en negro sin volver al principio", () => {
    // Que la última canción arranque otra vez sola delante de todos es
    // exactamente lo que no puede pasar.
    culto();
    useStore.getState().proyectarElemento(2);

    useStore.getState().proyeccionSiguiente();

    expect(ultimo().vista).toEqual({ modo: "negro" });
    expect(useStore.getState().proyeccionIdx).toBe(2);
  });

  it("no se sale de la cola por ninguno de los dos lados", () => {
    culto();
    useStore.getState().proyectarElemento(0);
    setProjectionCmd.mockClear();

    useStore.getState().proyectarElemento(-1);
    useStore.getState().proyectarElemento(3);

    expect(setProjectionCmd).not.toHaveBeenCalled();
    expect(useStore.getState().proyeccionIdx).toBe(0);
  });

  it("el negro no pierde por dónde iba el culto", () => {
    culto();
    useStore.getState().proyectarElemento(1);

    useStore.getState().proyeccionNegro();

    expect(ultimo().vista).toEqual({ modo: "negro" });
    expect(useStore.getState().proyeccionIdx).toBe(1);
    // Apuntado pero sin verse: la cola tiene que dejar de decir «en pantalla».
    expect(useStore.getState().proyeccionEnNegro).toBe(true);
    // Y lo siguiente sigue cargado, para que volver del negro sea inmediato.
    expect(ultimo().precarga).toBe("/m/c.mp3");
  });

  it("cortar la salida conserva el sitio, y volver a proyectar lo retoma", async () => {
    culto();
    useStore.setState({ monitores: [PORTATIL, PROYECTOR] });
    useStore.getState().proyectarElemento(1);

    useStore.getState().alternarProyeccion();
    expect(useStore.getState().proyeccionIdx).toBe(1);

    useStore.getState().alternarProyeccion();

    await vi.waitFor(() => expect(useStore.getState().proyectando).toBe(true));
    expect(useStore.getState().proyeccionIdx).toBe(1);
    expect(ultimo().vista).toMatchObject({ src: "/m/b.mp4" });
  });

  it("y sin haber empezado, proyectar empieza por el primero", async () => {
    culto();
    useStore.setState({ proyectando: false, monitores: [PORTATIL, PROYECTOR] });

    useStore.getState().alternarProyeccion();

    await vi.waitFor(() => expect(useStore.getState().proyeccionIdx).toBe(0));
    expect(ultimo().vista).toMatchObject({ src: "/m/a.mp3" });
  });

  it("con el culto vacío, proyectar sale en negro y no se inventa un elemento", async () => {
    useStore.setState({ tracks: [], curPlaylist: "p1", plOrder: { p1: [] }, proyectando: false, monitores: [PORTATIL, PROYECTOR] });

    useStore.getState().alternarProyeccion();

    await vi.waitFor(() => expect(setProjectionCmd).toHaveBeenCalled());
    expect(ultimo().vista).toEqual({ modo: "negro" });
    expect(useStore.getState().proyeccionIdx).toBe(-1);
  });
});

describe("lo que no se puede reproducir", () => {
  it("una pista sin archivo sale como su título, no como un negro sin explicación", () => {
    // Por el proyector se canta esa canción igual.
    culto([pista("a", { path: undefined }), pista("b")]);

    useStore.getState().proyectarElemento(0);

    expect(ultimo().vista).toEqual({ modo: "titulo", titulo: "Pista a", sub: "Coro" });
  });

  it("un archivo que ya no está, igual", () => {
    culto([pista("a", { missing: true }), pista("b")]);

    useStore.getState().proyectarElemento(0);

    expect(ultimo().vista).toMatchObject({ modo: "titulo" });
  });

  it("y un formato que ningún motor decodifica ni se intenta", () => {
    culto([pista("a", { path: "/m/testimonio.mkv", video: true }), pista("b")]);

    useStore.getState().proyectarElemento(0);

    expect(ultimo().vista).toMatchObject({ modo: "titulo", titulo: "Pista a" });
  });

  it("ni se precarga: el hueco se deja vacío en vez de cargar lo que va a fallar", () => {
    culto([pista("a"), pista("b", { path: "/m/roto.avi" })]);

    useStore.getState().proyectarElemento(0);

    expect(ultimo().precarga).toBeUndefined();
  });

  it("el motivo se queda en los mandos y no viaja al proyector", () => {
    // A la congregación no le importa que falte un archivo.
    culto([pista("a", { missing: true })]);

    useStore.getState().proyectarElemento(0);

    expect(JSON.stringify(ultimo())).not.toContain("Falta el archivo");
  });
});

describe("lo que devuelve la salida", () => {
  it("el tiempo del archivo que está en pantalla se apunta", async () => {
    culto();
    await useStore.getState().escucharProyeccion();
    useStore.getState().proyectarElemento(0);

    contestar!({ src: "/m/a.mp3", pos: 64, dur: 192, fin: false });

    expect(useStore.getState().proyeccionPos).toBe(64);
    expect(useStore.getState().proyeccionDur).toBe(192);
  });

  it("y el de otro archivo se tira", async () => {
    // Llega al pasar de elemento: escribirlo pondría el tiempo de la canción
    // anterior debajo de la que acaba de empezar.
    culto();
    await useStore.getState().escucharProyeccion();
    useStore.getState().proyectarElemento(1);

    contestar!({ src: "/m/a.mp3", pos: 175, dur: 180, fin: false });

    expect(useStore.getState().proyeccionPos).toBe(0);
  });

  it("un fallo se apunta en el elemento que lo dio y se dice", async () => {
    culto();
    await useStore.getState().escucharProyeccion();
    useStore.getState().proyectarElemento(0);

    contestar!({ src: "/m/a.mp3", pos: 0, dur: 0, fin: false, error: 4 });

    expect(useStore.getState().proyeccionFallos.a).toContain("no reproduce este formato");
    expect(useStore.getState().proyeccionFallos.b).toBeUndefined();
    expect(useStore.getState().toast?.type).toBe("error");
  });

  it("y se borra en cuanto el archivo vuelve a ir", async () => {
    // Pasa al reapuntar la pista o al convertirla sin cerrar la app.
    culto();
    await useStore.getState().escucharProyeccion();
    useStore.getState().proyectarElemento(0);
    contestar!({ src: "/m/a.mp3", pos: 0, dur: 0, fin: false, error: 3 });

    contestar!({ src: "/m/a.mp3", pos: 2, dur: 180, fin: false });

    expect(useStore.getState().proyeccionFallos.a).toBeUndefined();
  });

  it("con la salida cortada no se escribe nada de lo que llegue tarde", async () => {
    culto();
    await useStore.getState().escucharProyeccion();
    useStore.getState().proyectarElemento(0);
    useStore.setState({ proyectando: false });

    contestar!({ src: "/m/a.mp3", pos: 99, dur: 180, fin: false });

    expect(useStore.getState().proyeccionPos).toBe(0);
  });
});

describe("proyectar una lista y mirar otra", () => {
  /** Dos cultos a la vez: el que está en el aire y el que se abre a buscar algo. */
  function dosCultos() {
    const pistas = [pista("a"), pista("b"), pista("z", { path: "/m/z.mp3" })];
    useStore.setState({
      tracks: pistas,
      curPlaylist: "enVivo",
      plOrder: { enVivo: ["a", "b"], otra: ["z"] },
      proyectando: true,
      proyeccionIdx: -1,
      proyeccionLista: "",
    });
  }

  it("«Siguiente» sigue la lista que está en el aire, no la que se está mirando", () => {
    // En pleno culto se abre otra lista para buscar algo. Si «Siguiente»
    // avanzara por esa, sacaría por el proyector una pista que nadie pidió.
    dosCultos();
    useStore.getState().proyectarElemento(0);
    useStore.setState({ curPlaylist: "otra" });

    useStore.getState().proyeccionSiguiente();

    expect(ultimo().vista).toMatchObject({ src: "/m/b.mp3" });
    expect(useStore.getState().proyeccionLista).toBe("enVivo");
  });

  it("y la precarga también: lo que se va cargando es lo siguiente del aire", () => {
    // Mirar otra lista no puede poner a cargar una pista de esa otra lista,
    // porque es la que arrancaría al pulsar «Siguiente».
    dosCultos();
    useStore.getState().proyectarElemento(0);
    useStore.setState({ curPlaylist: "otra" });

    useStore.getState().proyeccionNegro();

    expect(ultimo().precarga).toBe("/m/b.mp3");
  });

  it("y proyectar a propósito desde la otra la pone a ella en el aire", () => {
    dosCultos();
    useStore.getState().proyectarElemento(0);
    useStore.setState({ curPlaylist: "otra" });

    useStore.getState().proyectarElemento(0);

    expect(ultimo().vista).toMatchObject({ src: "/m/z.mp3" });
    expect(useStore.getState().proyeccionLista).toBe("otra");
  });

  it("retomar tras cortar vuelve a la lista con la que se empezó", async () => {
    dosCultos();
    useStore.setState({ monitores: [PORTATIL, PROYECTOR] });
    useStore.getState().proyectarElemento(1);
    useStore.getState().alternarProyeccion();
    useStore.setState({ curPlaylist: "otra" });

    useStore.getState().alternarProyeccion();

    await vi.waitFor(() => expect(useStore.getState().proyectando).toBe(true));
    expect(ultimo().vista).toMatchObject({ src: "/m/b.mp3" });
  });

  it("«Proyectar» de la tarjeta En vivo abre el culto que la tarjeta nombra", () => {
    // La tarjeta nombra un culto concreto; proyectar otro sería lo último que
    // quien opera va a revisar antes de empezar.
    dosCultos();
    useStore.setState({ curPlaylist: "enVivo" });

    useStore.getState().showProyeccion("otra");

    expect(useStore.getState().curPlaylist).toBe("otra");
    expect(useStore.getState().view).toBe("proyeccion");
  });

  it("y sin decir cuál, deja abierto el que ya lo estaba", () => {
    dosCultos();

    useStore.getState().showProyeccion();

    expect(useStore.getState().curPlaylist).toBe("enVivo");
  });
});


describe("el arranque de la ventana de salida", () => {
  it("lo primero del culto se manda otra vez cuando la salida dice que ya escucha", async () => {
    // Abrir la ventana y mandarle lo primero son dos cosas seguidas, y entre
    // una y otra el webview está arrancando. Sin esto, el primer elemento se
    // perdía entero y el proyector se quedaba en negro justo al empezar.
    culto();
    await useStore.getState().escucharProyeccion();
    useStore.getState().proyectarElemento(0);
    setProjectionCmd.mockClear();

    avisarLista!();

    expect(ultimo().vista).toMatchObject({ modo: "media", src: "/m/a.mp3", reproduciendo: true });
  });

  it("y si no había nada en pantalla, se le manda el negro", async () => {
    culto();
    await useStore.getState().escucharProyeccion();
    setProjectionCmd.mockClear();

    avisarLista!();

    expect(ultimo().vista).toEqual({ modo: "negro" });
  });

  it("con la salida cortada no se contesta a nada", async () => {
    culto();
    await useStore.getState().escucharProyeccion();
    useStore.setState({ proyectando: false });
    setProjectionCmd.mockClear();

    avisarLista!();

    expect(setProjectionCmd).not.toHaveBeenCalled();
  });

  it("dejar de escuchar suelta las dos suscripciones", async () => {
    culto();
    const soltar = await useStore.getState().escucharProyeccion();

    soltar();

    expect(avisarLista).toBeNull();
    expect(contestar).toBeNull();
  });
});

describe("cuando se acaba un elemento", () => {
  it("el proyector se queda en negro, sin arrancar el siguiente por su cuenta", async () => {
    // El video se termina mientras alguien está hablando. Arrancar la canción
    // de después solo, delante de la congregación, no lo decide la app.
    culto();
    await useStore.getState().escucharProyeccion();
    useStore.getState().proyectarElemento(0);

    contestar!({ src: "/m/a.mp3", pos: 180, dur: 180, fin: true });

    expect(ultimo().vista).toEqual({ modo: "negro" });
    expect(useStore.getState().proyeccionIdx).toBe(0);
    expect(useStore.getState().proyeccionEnNegro).toBe(true);
  });

  it("y lo siguiente se queda cargado, a un botón de distancia", async () => {
    culto();
    await useStore.getState().escucharProyeccion();
    useStore.getState().proyectarElemento(0);

    contestar!({ src: "/m/a.mp3", pos: 180, dur: 180, fin: true });

    expect(ultimo().precarga).toBe("/m/b.mp4");
    useStore.getState().proyeccionSiguiente();
    expect(ultimo().vista).toMatchObject({ src: "/m/b.mp4", reproduciendo: true });
    expect(useStore.getState().proyeccionEnNegro).toBe(false);
  });

  it("volver a proyectar el mismo elemento lo saca del negro", async () => {
    culto();
    await useStore.getState().escucharProyeccion();
    useStore.getState().proyectarElemento(0);
    contestar!({ src: "/m/a.mp3", pos: 180, dur: 180, fin: true });

    useStore.getState().proyectarElemento(0);

    expect(useStore.getState().proyeccionEnNegro).toBe(false);
    expect(ultimo().vista).toMatchObject({ src: "/m/a.mp3", reproduciendo: true });
  });
});

// ------------------------------------------------ las opciones de la salida

/** Un culto de dos pistas de audio, la primera con letra de tres estrofas. */
function cultoConLetra() {
  const pistas = [pista("a", { cover: "asset://portada-a" }), pista("b")];
  useStore.setState({
    tracks: pistas,
    curPlaylist: "p1",
    plOrder: { p1: ["a", "b"] },
    sheets: {
      a: { letra: "Uno uno\nUno dos\n\nDos uno\n\nTres uno", acordes: "" } as never,
    },
    proyectando: true,
    proyeccionIdx: -1,
    proyeccionLista: "",
    proyeccionEstrofa: 0,
    salidaDeAudio: "letra",
    transicionProyeccion: "negro",
  });
}

/** Lo que la salida tiene que dibujar encima del negro. */
const fondo = () => {
  const v = ultimo().vista;
  return v.modo === "media" ? v.audio : undefined;
};

describe("qué sale con una pista de solo audio", () => {
  it("con «Solo la letra», la primera estrofa", () => {
    cultoConLetra();

    useStore.getState().proyectarElemento(0);

    expect(fondo()).toMatchObject({ tipo: "letra", lineas: ["Uno uno", "Uno dos"] });
  });

  it("con «Portada y letra», además la carátula de fondo", () => {
    cultoConLetra();
    useStore.setState({ salidaDeAudio: "portada" });

    useStore.getState().proyectarElemento(0);

    expect(fondo()).toMatchObject({ tipo: "portada", portada: "asset://portada-a" });
  });

  it("y con «Negro» no se manda nada que dibujar", () => {
    // Hay cultos donde lo que se quiere mientras suena la ofrenda es una
    // pantalla apagada.
    cultoConLetra();
    useStore.setState({ salidaDeAudio: "negro" });

    useStore.getState().proyectarElemento(0);

    expect(fondo()).toEqual({ tipo: "negro" });
  });

  it("la carátula no viaja si no se pidió la portada", () => {
    cultoConLetra();

    useStore.getState().proyectarElemento(0);

    expect(fondo()?.portada).toBeUndefined();
  });

  it("una pista sin letra no manda líneas: la salida cae al título", () => {
    cultoConLetra();

    useStore.getState().proyectarElemento(1);

    expect(fondo()?.lineas).toBeUndefined();
  });

  it("un video no lleva nada de esto: ya llena la pantalla", () => {
    culto();
    useStore.setState({ salidaDeAudio: "letra" });

    useStore.getState().proyectarElemento(1);

    const v = ultimo().vista;
    expect(v.modo === "media" && v.video).toBe(true);
    expect(fondo()).toBeUndefined();
  });

  it("cambiar el ajuste en marcha se ve al momento", () => {
    // Quien lo toca lo toca para ver el efecto, no para la siguiente canción.
    cultoConLetra();
    useStore.getState().proyectarElemento(0);

    useStore.getState().setSalidaDeAudio("negro");

    expect(fondo()).toEqual({ tipo: "negro" });
  });

  it("pero con el proyector en negro no se manda nada al tocarlo", () => {
    cultoConLetra();
    useStore.getState().proyectarElemento(0);
    useStore.getState().proyeccionNegro();
    setProjectionCmd.mockClear();

    useStore.getState().setSalidaDeAudio("portada");

    expect(setProjectionCmd).not.toHaveBeenCalled();
  });
});

describe("pasar de estrofa", () => {
  it("«Siguiente» recorre la letra antes de cambiar de canción", () => {
    // Un solo botón y una sola tecla: desde el atril no se quiere elegir entre
    // dos, se quiere pasar a lo que viene.
    cultoConLetra();
    useStore.getState().proyectarElemento(0);

    useStore.getState().proyeccionSiguiente();

    expect(useStore.getState().proyeccionIdx).toBe(0);
    expect(useStore.getState().proyeccionEstrofa).toBe(1);
    expect(fondo()?.lineas).toEqual(["Dos uno"]);
  });

  it("y al acabarse la letra sí pasa a la siguiente pista", () => {
    cultoConLetra();
    useStore.getState().proyectarElemento(0);
    useStore.getState().proyeccionSiguiente();
    useStore.getState().proyeccionSiguiente();

    useStore.getState().proyeccionSiguiente();

    expect(useStore.getState().proyeccionIdx).toBe(1);
    expect(useStore.getState().proyeccionEstrofa).toBe(0);
  });

  it("con «Negro» elegido no hay estrofas que recorrer", () => {
    cultoConLetra();
    useStore.setState({ salidaDeAudio: "negro" });
    useStore.getState().proyectarElemento(0);

    useStore.getState().proyeccionSiguiente();

    expect(useStore.getState().proyeccionIdx).toBe(1);
  });

  it("desde el negro, «Siguiente» pasa de pista y no de estrofa", () => {
    // Estando en negro no hay letra en pantalla que avanzar.
    cultoConLetra();
    useStore.getState().proyectarElemento(0);
    useStore.getState().proyeccionNegro();

    useStore.getState().proyeccionSiguiente();

    expect(useStore.getState().proyeccionIdx).toBe(1);
  });

  it("volver a poner la misma pista empieza otra vez por la primera estrofa", () => {
    cultoConLetra();
    useStore.getState().proyectarElemento(0);
    useStore.getState().proyeccionSiguiente();

    useStore.getState().proyectarElemento(0);

    expect(useStore.getState().proyeccionEstrofa).toBe(0);
  });
});

describe("la transición entre elementos", () => {
  it("cambiar de elemento la lleva", () => {
    cultoConLetra();
    useStore.setState({ transicionProyeccion: "cuenta" });
    useStore.getState().proyectarElemento(0);
    // Las tres estrofas primero: hasta que se acaba la letra, «Siguiente» no
    // cambia de pista y por tanto no hay nada entre lo que transicionar.
    useStore.getState().proyeccionSiguiente();
    useStore.getState().proyeccionSiguiente();

    useStore.getState().proyeccionSiguiente();

    expect(useStore.getState().proyeccionIdx).toBe(1);
    expect(ultimo().transicion).toBe("cuenta");
  });

  it("pasar de estrofa no la lleva", () => {
    // Serían medio segundo de negro en mitad de una canción.
    cultoConLetra();
    useStore.getState().proyectarElemento(0);

    useStore.getState().proyeccionSiguiente();

    expect(ultimo().transicion).toBeUndefined();
  });

  it("volver a poner lo que ya estaba, tampoco", () => {
    cultoConLetra();
    useStore.getState().proyectarElemento(0);

    useStore.getState().proyectarElemento(0);

    expect(ultimo().transicion).toBeUndefined();
  });

  it("pero volver del negro sí, porque se estaba viniendo de otra cosa", () => {
    cultoConLetra();
    useStore.getState().proyectarElemento(0);
    useStore.getState().proyeccionNegro();

    useStore.getState().proyectarElemento(0);

    expect(ultimo().transicion).toBe("negro");
  });

  it("y el negro a mano no lleva transición: corta ya", () => {
    cultoConLetra();
    useStore.getState().proyectarElemento(0);

    useStore.getState().proyeccionNegro();

    expect(ultimo().transicion).toBeUndefined();
  });
});
