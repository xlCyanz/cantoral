// El tamaño de toda la interfaz, para quien no ve bien la letra pequeña.
//
// La app está hecha con medidas en píxeles escritas a mano en cada componente
// —12 px aquí, 56 px de fila allá—, así que agrandarla pieza a pieza sería
// tocar cada archivo y descuadrar las cuentas que dependen de esos números
// (los altos de fila de `virtual.ts`, el menú contextual). En su lugar se
// agranda la página entera con el zoom del propio webview, el mismo que el
// Ctrl + de un navegador: el texto se vuelve a dibujar a su tamaño, nítido, y
// para la página la ventana simplemente es más pequeña. `innerWidth`,
// `clientX`, `getBoundingClientRect` y las medidas de CSS siguen hablando la
// misma unidad, y nada de lo que mide se entera.
//
// Solo la ventana principal: la de proyección es otro webview, y el proyector
// tiene su propio tamaño.

import { fijarZoom, isTauri, registrar, tamanoDeLaVentana } from "./api";

/** Los tres tamaños que se ofrecen. */
export type TamanoUi = "normal" | "grande" | "muyGrande";

/**
 * Los tamaños, de menor a mayor, con lo que crece cada uno.
 *
 * Tres escalones y no un deslizador: «más grande» y «mucho más grande» se
 * eligen de un vistazo, y un 1,27 no le dice nada a nadie.
 */
export const TAMANOS: { valor: TamanoUi; etiqueta: string; factor: number }[] = [
  { valor: "normal", etiqueta: "Normal", factor: 1 },
  { valor: "grande", etiqueta: "Grande", factor: 1.15 },
  { valor: "muyGrande", etiqueta: "Muy grande", factor: 1.35 },
];

/**
 * El de fábrica.
 *
 * «Grande» y no «Normal»: la letra de la app es menuda (11–13 px), y quien la
 * usa el domingo suele estar de pie y a un paso de la pantalla.
 */
export const TAMANO_DE_FABRICA: TamanoUi = "grande";

export function esTamano(v: unknown): v is TamanoUi {
  return TAMANOS.some((t) => t.valor === v);
}

/** Cuánto crece un tamaño. */
export function factorDe(t: TamanoUi): number {
  return TAMANOS.find((x) => x.valor === t)?.factor ?? 1;
}

/** El tamaño de al lado, sin pasarse de los extremos. */
export function escalonar(t: TamanoUi, paso: 1 | -1): TamanoUi {
  const i = TAMANOS.findIndex((x) => x.valor === t);
  const j = Math.min(TAMANOS.length - 1, Math.max(0, (i < 0 ? 0 : i) + paso));
  return TAMANOS[j].valor;
}

/**
 * Lo mínimo que tiene que quedarle a la página, en píxeles de CSS.
 *
 * Con la barra lateral (226), una tabla de la biblioteca que se lea entera y
 * la barra del reproductor sin montarse; de alto, la barra de título, la de
 * arriba, la del reproductor y unas cuantas filas.
 */
export const HUECO_MINIMO = { ancho: 800, alto: 520 };

/**
 * El zoom que de verdad se aplica: el del tamaño elegido, salvo que la
 * ventana no dé para él.
 *
 * En una ventana pequeña —un portátil de 1366 × 768 con la escala de Windows
 * al 125 %, o la ventana encogida a su mínimo— «Muy grande» dejaría a la
 * página menos sitio del que su diseño necesita, y una app que no cabe no se
 * ve mejor por tener la letra más grande. Ahí crece lo que cabe, que nunca es
 * menos que «Normal»; al agrandar la ventana vuelve a ser el elegido.
 *
 * `ancho` y `alto` son el interior de la ventana en píxeles lógicos (los del
 * sistema, sin el zoom). Se redondea hacia abajo a la centésima para que un
 * borde arrastrado no pida un zoom distinto por cada píxel.
 */
export function factorQueCabe(factor: number, ancho: number, alto: number): number {
  if (!(ancho > 0) || !(alto > 0)) return factor;
  const cabe = Math.min(ancho / HUECO_MINIMO.ancho, alto / HUECO_MINIMO.alto);
  const f = Math.min(factor, Math.max(1, cabe));
  return Math.floor(f * 100 + 1e-9) / 100;
}

// ---------------------------------------------------------------- atajos

/** Lo que pide una tecla: agrandar, achicar, volver al de fábrica, o nada. */
export type AtajoDeTamano = 1 | -1 | 0 | null;

/**
 * Leer Ctrl/⌘ +, Ctrl/⌘ − y Ctrl/⌘ 0.
 *
 * Por `key` y por `code` a la vez: en un teclado español el «+» tiene su
 * propia tecla y en uno inglés es Mayús + «=», y el teclado numérico tiene
 * los suyos. Con Alt no: en algunos teclados Ctrl + Alt es AltGr, que escribe.
 */
export function atajoDeTamano(e: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey">): AtajoDeTamano {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd") return 1;
  if (e.key === "-" || e.key === "_" || e.code === "NumpadSubtract") return -1;
  if (e.key === "0" || e.code === "Digit0" || e.code === "Numpad0") return 0;
  return null;
}

// ---------------------------------------------------------------- arranque

/**
 * El tamaño del último dibujo, para el primero.
 *
 * Como el tema (ver `temaGuardado.ts`): el elegido vive en la base, que se
 * lee con la ventana ya pintada, y sin esto la app aparecía a un tamaño y
 * saltaba a otro un momento después.
 */
export const CLAVE_TAMANO = "cantoral.tamano";

/** El tamaño del último dibujo, o `null` si no hay o no se puede leer. */
export function leerTamanoGuardado(): TamanoUi | null {
  try {
    const t = globalThis.localStorage?.getItem(CLAVE_TAMANO);
    return esTamano(t) ? t : null;
  } catch {
    return null;
  }
}

/** Apuntar el tamaño con el que se está pintando, para la próxima vez. */
export function guardarTamano(t: TamanoUi): void {
  try {
    globalThis.localStorage?.setItem(CLAVE_TAMANO, t);
  } catch {
    // Sin almacenamiento, la próxima vez se empieza por el de fábrica.
  }
}

// ---------------------------------------------------------------- aplicar

/**
 * El último zoom puesto, para no volver a pedir el mismo. Ninguno al empezar,
 * para que el primero se ponga siempre aunque sea 1: no se da por supuesto
 * con qué zoom nace el webview.
 */
let zoomAplicado = Number.NaN;
/** El tamaño elegido, que es lo que se vuelve a encajar al cambiar la ventana. */
let tamanoActual: TamanoUi = TAMANO_DE_FABRICA;
/** Los zooms pedidos, uno detrás de otro. */
let cola: Promise<void> = Promise.resolve();

/**
 * Poner la página al tamaño `t`, encajado en la ventana.
 *
 * Fuera de Tauri no hace nada: en el navegador el Ctrl + es del navegador.
 * Nunca falla hacia arriba: un zoom que no se pudo poner deja la app al
 * tamaño que tenía, que sigue sirviendo.
 */
export function aplicarTamano(t: TamanoUi): Promise<void> {
  tamanoActual = t;
  if (!isTauri()) return Promise.resolve();
  // En fila: el del arranque, el de los ajustes y el de un `resize` pueden
  // pedirse a la vez, y el último en llegar tiene que ser el último pedido.
  cola = cola.then(() => encajar(t));
  return cola;
}

async function encajar(t: TamanoUi): Promise<void> {
  try {
    const ventana = await tamanoDeLaVentana();
    // Minimizada, Windows dice que mide 0 × 0: no hay nada que encajar, y al
    // restaurarla llega otro `resize` con su tamaño de verdad.
    if (ventana && (ventana.ancho <= 0 || ventana.alto <= 0)) return;
    const f = factorQueCabe(factorDe(t), ventana?.ancho ?? 0, ventana?.alto ?? 0);
    if (Math.abs(f - zoomAplicado) < 0.005) return;
    await fijarZoom(f);
    zoomAplicado = f;
  } catch (err) {
    registrar("warn", `ui size: could not set the zoom: ${String(err)}`);
  }
}

/**
 * Volver a encajar el tamaño cuando la ventana cambia.
 *
 * Con una espera corta: arrastrar el borde manda un `resize` por fotograma, y
 * cambiar el zoom en cada uno haría bailar el texto mientras se arrastra.
 * Devuelve cómo dejar de hacerlo.
 */
export function encajarAlCambiarLaVentana(): () => void {
  if (!isTauri() || typeof window === "undefined") return () => {};
  let espera: ReturnType<typeof setTimeout> | null = null;
  const alCambiar = () => {
    if (espera) clearTimeout(espera);
    espera = setTimeout(() => void aplicarTamano(tamanoActual), 150);
  };
  window.addEventListener("resize", alCambiar);
  return () => {
    if (espera) clearTimeout(espera);
    window.removeEventListener("resize", alCambiar);
  };
}

/**
 * El tamaño antes del primer dibujo: el del último, o el de fábrica.
 *
 * `main.tsx` lo espera antes de montar React. La página está vacía hasta
 * entonces —solo el fondo—, así que no hay nada que se vea cambiar.
 */
export function aplicarTamanoGuardado(): Promise<void> {
  // Con un límite: si el núcleo tarda en contestar, la app se pinta igual y el
  // zoom llega cuando llegue. Esperarlo sin más sería una ventana en blanco.
  const limite = new Promise<void>((r) => setTimeout(r, 300));
  return Promise.race([aplicarTamano(leerTamanoGuardado() ?? TAMANO_DE_FABRICA), limite]);
}

/** Solo para las pruebas: olvidar lo aplicado. */
export function _reiniciarTamano(): void {
  zoomAplicado = Number.NaN;
  cola = Promise.resolve();
  tamanoActual = TAMANO_DE_FABRICA;
}
