import type { DocumentoLegal } from "@db/schema";
import type { Jurisprudencia } from "@db/schema";
import { articuloFieldMatchesRef, extractArticleRefsFromQuery } from "./query-intent";
import { articleExplicitBoost, scoreDoc, scoreJurisprudencia } from "./scoring";

export type Scored<T> = T & { score: number };

function dedupeById<T extends { id: number }>(rows: Scored<T>[]): Scored<T>[] {
  const seen = new Set<number>();
  const out: Scored<T>[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

/** Lexical retrieval + boost por referencia explícita a artículo (camino hasta BM25/pgvector). */
export function rankDocumentosLegales(
  query: string,
  docs: DocumentoLegal[],
  limite: number
): Scored<DocumentoLegal>[] {
  const refs = extractArticleRefsFromQuery(query);
  let pool = docs;

  if (refs.length > 0) {
    const direct = docs.filter((d) => refs.some((r) => articuloFieldMatchesRef(d.articulo, r)));
    if (direct.length > 0) {
      const rest = docs.filter((d) => !direct.some((x) => x.id === d.id));
      pool = [...direct, ...rest];
    }
  }

  const scored = pool
    .map((d) => ({
      ...d,
      score: scoreDoc(query, d) + articleExplicitBoost(query, d),
    }))
    .filter((d) => d.score > 0.5)
    .sort((a, b) => b.score - a.score);

  return dedupeById(scored).slice(0, limite);
}

export function rankJurisprudencia(
  query: string,
  juris: Jurisprudencia[],
  limite: number,
  maxCandidates = 120
): Scored<Jurisprudencia>[] {
  const candidates = juris.slice(0, maxCandidates);
  const scored = candidates
    .map((j) => ({
      ...j,
      score: scoreJurisprudencia(query, j),
    }))
    .filter((j) => j.score > 0.5)
    .sort((a, b) => b.score - a.score);

  return dedupeById(scored).slice(0, limite);
}
