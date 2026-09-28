// Un elemento de React escrito como HTML, sin `react-dom/server`.
//
// La hoja imprimible se dibuja con el mismo componente que el editor y el modo
// culto (`HojaAcordes`), para que los tres no se separen (#137). Pasarlo a
// texto con `renderToStaticMarkup` metía el renderizador de servidor entero en
// el paquete de la app —unos 200 kB, un 40 % más— para una página que se
// imprime de vez en cuando. Esto cubre solo lo que ese componente usa:
// etiquetas, `style` y texto. Las pruebas comprueban que escribe lo mismo que
// `renderToStaticMarkup`, carácter por carácter, así que si el componente
// empieza a usar algo que esto no sabe escribir, se nota ahí.

import type { CSSProperties, ReactElement, ReactNode } from "react";

/** Propiedades de estilo cuyos números van sin unidad, como las trata React. */
const SIN_UNIDAD = new Set([
  "flex",
  "flexGrow",
  "flexShrink",
  "fontWeight",
  "lineHeight",
  "opacity",
  "order",
  "zIndex",
  "zoom",
]);

/** Escapa texto y atributos igual que React. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function estilo(style: CSSProperties): string {
  return Object.entries(style)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => {
      const nombre = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      const valor = typeof v === "number" && v !== 0 && !SIN_UNIDAD.has(k) ? `${v}px` : String(v).trim();
      return `${nombre}:${valor}`;
    })
    .join(";");
}

/** El HTML de un nodo: texto, listas o elementos, con sus componentes resueltos. */
export function aHtml(nodo: ReactNode): string {
  if (nodo === null || nodo === undefined || typeof nodo === "boolean") return "";
  if (typeof nodo === "string" || typeof nodo === "number") return escapar(String(nodo));
  if (Array.isArray(nodo)) return nodo.map(aHtml).join("");
  const el = nodo as ReactElement<{ style?: CSSProperties; children?: ReactNode }>;
  // Un componente de función sin estado se resuelve llamándolo; es lo único
  // que hay dentro de la hoja.
  if (typeof el.type === "function") return aHtml((el.type as (p: unknown) => ReactNode)(el.props));
  if (typeof el.type !== "string") throw new Error("aHtml solo escribe etiquetas y componentes de función");
  const { style, children } = el.props;
  const css = style ? estilo(style) : "";
  const atributos = css ? ` style="${escapar(css)}"` : "";
  return `<${el.type}${atributos}>${aHtml(children)}</${el.type}>`;
}
