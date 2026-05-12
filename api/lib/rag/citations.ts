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

export interface VerificationResult {
  ok: boolean;
  invalidArticles: string[];
  invalidRoles: string[];
}

const ART_CITE_RE =
  /\[Art\.?\s*(\d+(?:\s*bis|\s*ter|\s*quater)?)\s*(?:CT|del\s+CT|Código\s+del\s+Trabajo)?\]/gi;

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
  const fromText = chunk.contenido.match(/Art\.?\s*(\d+(?:\s*bis|\s*ter|\s*quater)?)/i);
  if (fromText?.[1]) keys.add(normalizeArticleNum(fromText[1]));
  return keys;
}

const ROL_CITE_RE = /\[Rol\s*N[°º]?\s*([A-Za-z0-9\-]+)/gi;

function normalizeRol(r: string): string {
  return r.replace(/\s+/g, "").toUpperCase();
}

export function verifyCitations(response: string, retrievedChunks: RetrievedChunk[]): VerificationResult {
  const invalidArticles: string[] = [];
  const invalidRoles: string[] = [];

  const normChunks = retrievedChunks.filter((c) => c.source === "CT" || c.source === "ley_especial");
  const knownArticles = new Set<string>();
  for (const c of normChunks) {
    for (const k of chunkArticleKeys(c)) knownArticles.add(k);
  }

  let m: RegExpExecArray | null;
  const artRe = new RegExp(ART_CITE_RE.source, ART_CITE_RE.flags);
  while ((m = artRe.exec(response)) !== null) {
    const cited = normalizeArticleNum(m[1] ?? "");
    if (!cited) continue;
    let hit = false;
    for (const k of knownArticles) {
      if (k === cited || k.includes(cited) || cited.includes(k)) {
        hit = true;
        break;
      }
    }
    if (!hit && knownArticles.size > 0) invalidArticles.push(m[1]?.trim() ?? cited);
  }

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

  return {
    ok: invalidArticles.length === 0 && invalidRoles.length === 0,
    invalidArticles: [...new Set(invalidArticles)],
    invalidRoles: [...new Set(invalidRoles)],
  };
}
