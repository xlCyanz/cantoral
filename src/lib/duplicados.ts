// Wording for the duplicate groups shown in Configuración. Kept apart from
// DuplicateGroups.tsx so that file only exports components, which is what
// Vite's fast refresh needs to swap it in place.

/** Bytes as something a person can compare at a glance. */
export function tamano(bytes: number): string {
  if (bytes <= 0) return "—";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return mb < 100 ? `${mb.toFixed(1).replace(".", ",")} MB` : `${Math.round(mb)} MB`;
}

/** Why a group was put together, in words rather than a field name. */
export function motivoEnPalabras(motivo: string): string {
  return motivo === "archivo" ? "Mismo archivo" : "Mismo título";
}
