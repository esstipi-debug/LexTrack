/**
 * Extrae referencias a artículos desde consultas en español (ej. despido "art 162", "artículo 163 bis").
 * Sirve para boosting determinístico antes de BM25/embeddings.
 */

const ARTICLE_PATTERN =
  /(?:^|[^\d])(?:art(?:ículo)?\.?\s*|art\s+|n[°º]\s*)(\d+(?:\s*bis|\s*ter|\s*quater)?)(?!\d)/gi;

/** Normaliza para comparar con campos tipo "Art. 162" en seed. */
export function normalizeArticuloLabel(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/^art\.?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Devuelve etiquetas normalizadas únicas, ej. ["162", "163 bis"]. */
export function extractArticleRefsFromQuery(query: string): string[] {
  const seen = new Set<string>();
  const q = query.trim();
  if (!q) return [];

  let m: RegExpExecArray | null;
  const re = new RegExp(ARTICLE_PATTERN.source, ARTICLE_PATTERN.flags);
  while ((m = re.exec(q)) !== null) {
    const label = normalizeArticuloLabel(m[1] ?? "");
    if (label.length > 0) seen.add(label);
  }

  return [...seen];
}

export function articuloFieldMatchesRef(
  articuloField: string | null | undefined,
  refNormalized: string
): boolean {
  if (!articuloField?.trim()) return false;
  const field = normalizeArticuloLabel(articuloField);
  const ref = normalizeArticuloLabel(refNormalized);
  if (field === ref) return true;
  // "Art. 162" contiene "162"; ref puede ser "162 bis"
  return field.includes(ref) || ref.includes(field);
}
