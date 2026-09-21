// Tidying a tag the user typed. Mirrors `normalise_tag` in `db.rs`, so what the
// browser shows and what SQLite stores agree on what counts as the same tag.

/** Trim a tag and collapse runs of whitespace inside it. */
export function normalizarEtiqueta(raw: string): string {
  return raw.split(/\s+/).filter(Boolean).join(" ");
}

/**
 * The tag already in use that a newly typed one is really the same as.
 *
 * `tags.name` is case-sensitive, so «Lento» and «lento» are two rows nobody can
 * see are two. Matching case-insensitively here stops the pair forming at all,
 * which is cheaper than finding it afterwards in Configuración.
 */
export function etiquetaEquivalente(nueva: string, existentes: readonly string[]): string | null {
  const buscada = normalizarEtiqueta(nueva).toLowerCase();
  if (!buscada) return null;
  return existentes.find((e) => e.toLowerCase() === buscada) ?? null;
}
