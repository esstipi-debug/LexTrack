import { articuloFieldMatchesRef, extractArticleRefsFromQuery } from "./query-intent";

export type LegalDocRow = {
  titulo: string;
  contenido: string;
  etiquetas?: string | null;
  articulo?: string | null;
};

export type JurisRow = {
  caratula?: string | null;
  contenido: string;
  extracto?: string | null;
  normasAplicadas?: string | null;
  rit?: string | null;
};

export function scoreDoc(query: string, doc: LegalDocRow): number {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (queryWords.length === 0) return 0;
  const text = `${doc.titulo} ${doc.contenido} ${doc.etiquetas || ""} ${doc.articulo || ""}`.toLowerCase();
  let score = 0;
  for (const word of queryWords) {
    if (doc.titulo?.toLowerCase().includes(word)) score += 15;
    if (doc.articulo?.toLowerCase().includes(word)) score += 12;
    const contentMatches = (doc.contenido.toLowerCase().match(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    score += contentMatches * 2;
    if (doc.etiquetas?.toLowerCase().includes(word)) score += 8;
  }
  return score / Math.sqrt(text.length / 100);
}

export function scoreJurisprudencia(query: string, doc: JurisRow): number {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (queryWords.length === 0) return 0;
  const text = `${doc.caratula || ""} ${doc.contenido} ${doc.extracto || ""} ${doc.normasAplicadas || ""}`.toLowerCase();
  let score = 0;
  for (const word of queryWords) {
    if (doc.caratula?.toLowerCase().includes(word)) score += 10;
    if (doc.extracto?.toLowerCase().includes(word)) score += 8;
    const contentMatches = (doc.contenido.toLowerCase().match(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    score += contentMatches * 1.5;
    if (doc.normasAplicadas?.toLowerCase().includes(word)) score += 6;
  }
  return score / Math.sqrt(text.length / 100);
}

const ARTICLE_BOOST = 120;

/** Suma peso extra si la consulta menciona explícitamente un artículo que coincide con el documento. */
export function articleExplicitBoost(query: string, doc: LegalDocRow): number {
  const refs = extractArticleRefsFromQuery(query);
  if (refs.length === 0) return 0;
  for (const r of refs) {
    if (articuloFieldMatchesRef(doc.articulo, r)) return ARTICLE_BOOST;
  }
  return 0;
}
