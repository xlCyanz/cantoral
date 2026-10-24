// Las notas de una versión nueva, para leerlas en Configuración.
//
// Llegan tal cual las escribe el CHANGELOG (el workflow de publicación copia
// la sección `## [x.y.z]` a `latest.json`): un párrafo de resumen, títulos
// `###`, viñetas que siguen en la línea de abajo con dos espacios, y negritas
// con `**`. Enseñadas como texto plano, los asteriscos y las almohadillas se
// leían como basura. Esto entiende justo eso y nada más: un Markdown entero
// sería una dependencia para cuatro reglas.

/** Un trozo de texto, en negrita o no. */
export interface Trozo {
  texto: string;
  negrita: boolean;
}

export type Bloque =
  | { tipo: "titulo"; trozos: Trozo[] }
  | { tipo: "parrafo"; trozos: Trozo[] }
  | { tipo: "lista"; items: Trozo[][] };

/** `uno **dos** tres` → tres trozos. Un `**` sin pareja se queda como texto. */
export function trozos(linea: string): Trozo[] {
  const partes = linea.split("**");
  // Con un número par de `**` sobra uno: el último se devuelve a su sitio.
  if (partes.length % 2 === 0) {
    const ultima = partes.pop()!;
    partes[partes.length - 1] += "**" + ultima;
  }
  return partes.map((texto, i) => ({ texto, negrita: i % 2 === 1 })).filter((t) => t.texto);
}

export function bloquesDeNotas(md: string): Bloque[] {
  const bloques: Bloque[] = [];
  // Lo que se va juntando: las líneas de un párrafo o de la viñeta en curso.
  let parrafo: string[] = [];
  let lista: string[][] | null = null;

  const cerrar = () => {
    if (parrafo.length) bloques.push({ tipo: "parrafo", trozos: trozos(parrafo.join(" ")) });
    if (lista) bloques.push({ tipo: "lista", items: lista.map((l) => trozos(l.join(" "))) });
    parrafo = [];
    lista = null;
  };

  for (const cruda of md.split(/\r?\n/)) {
    const linea = cruda.trim();
    if (!linea) {
      cerrar();
    } else if (/^#{1,6}\s/.test(linea)) {
      cerrar();
      bloques.push({ tipo: "titulo", trozos: trozos(linea.replace(/^#+\s+/, "")) });
    } else if (/^[-*]\s/.test(linea)) {
      if (parrafo.length) cerrar();
      lista ??= [];
      lista.push([linea.slice(2).trim()]);
    } else if (lista && /^\s/.test(cruda)) {
      // La viñeta sigue en la línea de abajo.
      lista[lista.length - 1].push(linea);
    } else {
      if (lista) cerrar();
      parrafo.push(linea);
    }
  }
  cerrar();
  return bloques;
}

/**
 * La fecha de publicación que da el actualizador, o `null`.
 *
 * Llega como la escribe el núcleo (`2026-10-20 22:15:03.0 +00:00:00`), que
 * `Date` no entiende; también se acepta RFC 3339 por si un día cambia.
 */
export function fechaDeVersion(cruda: string | null | undefined): Date | null {
  if (!cruda) return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?\s*(Z|[+-]\d{2}:\d{2})?/.exec(cruda.trim());
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}${m[3] ?? "Z"}`);
  return isNaN(d.getTime()) ? null : d;
}
