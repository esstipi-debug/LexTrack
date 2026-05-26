/**
 * Verificación de citas contra chunks recuperados (anti-alucinación).
 * @see docs/ARCHITECTURE.md
 */

export type ChunkSource = "CT" | "ley_especial" | "jurisprudencia" | "dictamen_DT";

export interface RetrievedChunk {
  id: string;
  source: ChunkSource;
  articulo?: string | null;
  rol?: string | null;
  tribunal?: string | null;
  contenido: string;
  /** Metadatos opcionales para renderizar respuesta (Postgres RAG / UI). */
  norma?: string | null;
  titulo?: string | null;
  fecha?: string | null;
  caratula?: string | null;
}

export interface CitaSugerida {
  articulo: string;
  norma: string;
  motivo: string;
}

export interface VerificationResult {
  ok: boolean;
  invalidArticles: string[];
  invalidRoles: string[];
  invalidLeyes: string[];
  citasSugeridas: CitaSugerida[];
}

const ART_CITE_RE =
  /\[Art\.?\s*(\d+(?:\s*bis|\s*ter|\s*quater)?)\s*(?:,?\s*(?:CT|del\s+CT|Código\s+del\s+Trabajo|Ley\s+[\d.]+))?\]/gi;

/** Matches Ley references like "Ley 21.643", "Ley 19.728", "DFL 1", "DL 3.500" in the response text. */
const LEY_CITE_RE =
  /(?:Ley|DFL|DL)\s+(\d+(?:\.\d+)?)/gi;

function normalizeArticleNum(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkArticleKeys(chunk: RetrievedChunk): Set<string> {
  const keys = new Set<string>();
  if (chunk.articulo?.trim()) {
    keys.add(normalizeArticleNum(chunk.articulo.replace(/^art\.?\s*/i, "")));
  }
  // Extract all article references from chunk text (not just the first)
  const fromText = chunk.contenido.matchAll(/Art\.?\s*(\d+(?:\s*bis|\s*ter|\s*quater)?)/gi);
  for (const match of fromText) {
    if (match[1]) keys.add(normalizeArticleNum(match[1]));
  }
  return keys;
}

/** Extract Ley/DFL/DL numbers from chunk metadata and content. */
function chunkLeyKeys(chunk: RetrievedChunk): Set<string> {
  const keys = new Set<string>();
  const normaNorm = normalizeLeyNum(chunk.norma ?? "");
  if (normaNorm) keys.add(normaNorm);

  const fromText = chunk.contenido.matchAll(/(?:Ley|DFL|DL)\s+(\d+(?:\.\d+)?)/gi);
  for (const match of fromText) {
    const n = normalizeLeyNum(match[0]);
    if (n) keys.add(n);
  }
  return keys;
}

function normalizeLeyNum(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const ROL_CITE_RE = /\[Rol\s*N[°º]?\s*([A-Za-z0-9\-]+)/gi;

function normalizeRol(r: string): string {
  return r.replace(/\s+/g, "").toUpperCase();
}

export function verifyCitations(response: string, retrievedChunks: RetrievedChunk[]): VerificationResult {
  const invalidArticles: string[] = [];
  const invalidRoles: string[] = [];
  const invalidLeyes: string[] = [];
  const citasSugeridas: CitaSugerida[] = [];

  // ── Article verification ──────────────────────────────────────
  const normChunks = retrievedChunks.filter((c) => c.source === "CT" || c.source === "ley_especial" || c.source === "dictamen_DT");
  const knownArticles = new Set<string>();
  const articleToChunk = new Map<string, RetrievedChunk>();
  for (const c of normChunks) {
    for (const k of chunkArticleKeys(c)) {
      knownArticles.add(k);
      articleToChunk.set(k, c);
    }
  }

  const citedArticles = new Set<string>();
  let m: RegExpExecArray | null;
  const artRe = new RegExp(ART_CITE_RE.source, ART_CITE_RE.flags);
  while ((m = artRe.exec(response)) !== null) {
    const cited = normalizeArticleNum(m[1] ?? "");
    if (!cited) continue;
    citedArticles.add(cited);
    let hit = false;
    for (const k of knownArticles) {
      if (k === cited || k.includes(cited) || cited.includes(k)) {
        hit = true;
        break;
      }
    }
    if (!hit && knownArticles.size > 0) invalidArticles.push(m[1]?.trim() ?? cited);
  }

  // ── Ley reference verification ────────────────────────────────
  const knownLeyes = new Set<string>();
  for (const c of retrievedChunks) {
    for (const k of chunkLeyKeys(c)) knownLeyes.add(k);
  }

  const citedLeyes = new Set<string>();
  const leyRe = new RegExp(LEY_CITE_RE.source, LEY_CITE_RE.flags);
  while ((m = leyRe.exec(response)) !== null) {
    const full = normalizeLeyNum(m[0]);
    citedLeyes.add(full);
    let hit = false;
    for (const kl of knownLeyes) {
      if (kl.includes(full) || full.includes(kl)) {
        hit = true;
        break;
      }
    }
    if (!hit && knownLeyes.size > 0) invalidLeyes.push(m[0].trim());
  }

  // ── Rol/jurisprudencia verification ───────────────────────────
  const juris = retrievedChunks.filter((c) => c.source === "jurisprudencia");
  const knownRoles = new Set<string>();
  for (const c of juris) {
    if (c.rol?.trim()) knownRoles.add(normalizeRol(c.rol));
  }

  const rolRe = new RegExp(ROL_CITE_RE.source, ROL_CITE_RE.flags);
  while ((m = rolRe.exec(response)) !== null) {
    const cited = normalizeRol(m[1] ?? "");
    if (!cited) continue;
    let hit = false;
    for (const kr of knownRoles) {
      if (kr.includes(cited) || cited.includes(kr)) {
        hit = true;
        break;
      }
    }
    if (!hit && knownRoles.size > 0) invalidRoles.push(m[1]?.trim() ?? cited);
  }

  // ── Suggested citations (articles in context but not cited) ───
  for (const [artKey, chunk] of articleToChunk.entries()) {
    let wasCited = false;
    for (const ca of citedArticles) {
      if (ca === artKey || ca.includes(artKey) || artKey.includes(ca)) {
        wasCited = true;
        break;
      }
    }
    if (!wasCited) {
      citasSugeridas.push({
        articulo: `Art. ${artKey}`,
        norma: chunk.norma ?? "Código del Trabajo",
        motivo: "Presente en el contexto recuperado pero no citado en la respuesta",
      });
    }
  }

  return {
    ok: invalidArticles.length === 0 && invalidRoles.length === 0 && invalidLeyes.length === 0,
    invalidArticles: [...new Set(invalidArticles)],
    invalidRoles: [...new Set(invalidRoles)],
    invalidLeyes: [...new Set(invalidLeyes)],
    citasSugeridas,
  };
}
