// La hoja de acordes se dibuja en un solo sitio: la vista previa del editor,
// el modo culto y la hoja impresa usan el mismo componente. Estas pruebas
// fijan lo que las tres comparten —acorde sobre su sílaba, sección como
// encabezado, hueco para la línea en blanco— y los tamaños de cada una.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HojaAcordes from "../HojaAcordes";

type Props = Parameters<typeof HojaAcordes>[0];
const pintar = (props: Props) => renderToStaticMarkup(createElement(HojaAcordes, props));

describe("HojaAcordes", () => {
  it("pone cada acorde encima de la sílaba donde cae", () => {
    const html = pintar({ acordes: "Que [Do]dulce", tamano: "editor" });

    // Un tramo sin acorde lleva el hueco vacío, para que las palabras queden
    // a la misma altura que las que sí lo tienen.
    expect(html).toMatch(/<span style="[^"]*"><\/span><span style="display:block">Que <\/span>/);
    expect(html).toMatch(/<span style="[^"]*font-weight:700[^"]*">Do<\/span><span style="display:block">dulce<\/span>/);
  });

  it("el acorde vacío ocupa exactamente una línea", () => {
    expect(pintar({ acordes: "[Sol]Santo", tamano: "editor" })).toContain("min-height:1.35em");
    expect(pintar({ acordes: "[Sol]Santo", tamano: "atril" })).toContain("min-height:1.3em");
    expect(pintar({ acordes: "[Sol]Santo", tamano: "impresion" })).toContain("min-height:1.25em");
  });

  it("las secciones son encabezados", () => {
    expect(pintar({ acordes: "{Coro}", tamano: "editor" })).toMatch(
      /<h3 style="[^"]*text-transform:uppercase[^"]*">Coro<\/h3>/,
    );
  });

  it("la línea en blanco deja un hueco fijo", () => {
    expect(pintar({ acordes: "Uno\n\nDos", tamano: "editor" })).toContain('<div style="height:14px"></div>');
    expect(pintar({ acordes: "Uno\n\nDos", tamano: "impresion" })).toContain('<div style="height:12px"></div>');
  });

  it("la escala del modo culto agranda todo", () => {
    const normal = pintar({ acordes: "{Coro}\n[Sol]Santo\n", tamano: "atril" });
    const grande = pintar({ acordes: "{Coro}\n[Sol]Santo\n", tamano: "atril", escala: 1.5 });

    expect(normal).toContain("font-size:19px");
    expect(grande).toContain("font-size:28.5px");
    expect(normal).toContain("height:20px");
    expect(grande).toContain("height:30px");
    expect(grande).toContain("font-size:21px"); // la sección, 14 × 1,5
  });

  it("en pantalla usa los colores del tema; en papel, uno fijo", () => {
    // La hoja impresa se abre fuera de la app, donde no hay variables de tema.
    expect(pintar({ acordes: "[Sol]Santo", tamano: "atril" })).toContain("var(--primary)");
    const papel = pintar({ acordes: "[Sol]Santo", tamano: "impresion" });
    expect(papel).toContain("#3a4d8f");
    expect(papel).not.toContain("var(--");
  });

  it("escapa lo que se escribe a mano", () => {
    const html = pintar({ acordes: "{<b>Coro</b>}\n[Sol]<i>x</i> & más", tamano: "impresion" });

    expect(html).not.toMatch(/<b>|<i>/);
    expect(html).toContain("&lt;b&gt;Coro&lt;/b&gt;");
    expect(html).toContain("&lt;i&gt;x&lt;/i&gt; &amp; más");
  });
});

describe("la hoja impresa, sin el renderizador de servidor", () => {
  // `aHtml` sustituye a `renderToStaticMarkup` para no cargar este en la app.
  // Si el componente empieza a usar algo que `aHtml` no escribe igual, se nota
  // aquí, en todos los tamaños.
  const hojas = [
    "{Estrofa}\nQue [Do]dulce es [Sol7/Si]tu nombre\n\n[N.C.]Santo\n{Coro}\n[Re]Aleluya",
    'Te <b>adoro</b> & "canto" [La]\'amén\'',
    "",
    "Sin acordes en toda la línea",
  ];
  const casos = hojas.flatMap((acordes) =>
    (["editor", "atril", "impresion"] as const).flatMap((tamano) => [
      { acordes, tamano },
      { acordes, tamano, escala: 1.6 },
    ]),
  );

  it.each(casos)("escribe lo mismo que React (%o)", async (props) => {
    const { aHtml } = await import("../../lib/aHtml");
    const el = createElement(HojaAcordes, props);
    expect(aHtml(el)).toBe(renderToStaticMarkup(el));
  });
});
