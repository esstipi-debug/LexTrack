import type { Pool } from "pg";
import type { ChunkSource, RetrievedChunk } from "./citations";
import { embedTexts } from "../voyage";
import { rerankDocuments } from "../cohere";
import { env } from "../env";

export type PgChunkRow = {
  id: string;
  source: string;
  titulo: string | null;
  norma: string | null;
  articulo: string | null;
  rol: string | null;
  tribunal: string | null;
  fecha: string | null;
  contenido: string;
  bm25?: number;
  vec_sim?: number;
};

function assertChunkSource(s: string): ChunkSource {
  if (s === "CT" || s === "ley_especial" || s === "jurisprudencia" || s === "dictamen_DT") return s;
  return "ley_especial";
}

export function pgRowToRetrievedChunk(row: PgChunkRow): RetrievedChunk {
  const isJuris = assertChunkSource(row.source) === "jurisprudencia";
  return {
    id: row.id,
    source: assertChunkSource(row.source),
    articulo: row.articulo,
    rol: row.rol,
    tribunal: row.tribunal,
    contenido: row.contenido,
    norma: row.norma,
    titulo: row.titulo,
    fecha: row.fecha ?? undefined,
    caratula: isJuris ? row.titulo : undefined,
  };
}

async function fetchBm25(pool: Pool, query: string): Promise<PgChunkRow[]> {
  const attempts = [
    `SELECT id, source, titulo, norma, articulo, rol, tribunal, fecha, contenido,
      ts_rank_cd(to_tsvector('spanish', contenido), plainto_tsquery('spanish', $1)) AS bm25
     FROM rag_chunks
     WHERE to_tsvector('spanish', contenido) @@ plainto_tsquery('spanish', $1)
     ORDER BY bm25 DESC NULLS LAST
     LIMIT 20`,
    `SELECT id, source, titulo, norma, articulo, rol, tribunal, fecha, contenido,
      ts_rank_cd(to_tsvector('spanish', contenido), websearch_to_tsquery('spanish', $1)) AS bm25
     FROM rag_chunks
     WHERE to_tsvector('spanish', contenido) @@ websearch_to_tsquery('spanish', $1)
     ORDER BY bm25 DESC NULLS LAST
     LIMIT 20`,
  ];
  for (const sql of attempts) {
    try {
      const r = await pool.query<PgChunkRow>(sql, [query]);
      if (r.rows.length > 0) return r.rows;
    } catch {
      /* siguiente estrategia */
    }
  }
  return [];
}

async function fetchVector(pool: Pool, vecStr: string): Promise<PgChunkRow[]> {
  const r = await pool.query<PgChunkRow>(
    `SELECT id, source, titulo, norma, articulo, rol, tribunal, fecha, contenido,
       1 - (embedding <=> $1::vector) AS vec_sim
     FROM rag_chunks
     ORDER BY embedding <=> $1::vector
     LIMIT 20`,
    [vecStr]
  );
  return r.rows;
}

type Scored = PgChunkRow & { fusion: number };

/** BM25 (español) + similitud coseno pgvector + fusión; opcional Cohere rerank. */
export async function hybridRetrieve(pool: Pool, query: string): Promise<PgChunkRow[]> {
  const [qEmb] = await embedTexts([query], "query");
  const vecStr = `[${qEmb.join(",")}]`;

  const [bmRows, vecRows] = await Promise.all([fetchBm25(pool, query), fetchVector(pool, vecStr)]);

  const bmMax = Math.max(...bmRows.map((r) => Number(r.bm25 ?? 0)), 1e-9);
  const merged = new Map<string, Scored>();

  for (const row of bmRows) {
    const normBm = Number(row.bm25 ?? 0) / bmMax;
    merged.set(row.id, { ...row, bm25: Number(row.bm25 ?? 0), fusion: normBm * 0.45 });
  }

  for (const row of vecRows) {
    const vs = Number(row.vec_sim ?? 0);
    const prev = merged.get(row.id);
    if (prev) {
      prev.vec_sim = vs;
      prev.fusion += vs * 0.55;
    } else {
      merged.set(row.id, { ...row, vec_sim: vs, fusion: vs * 0.55 });
    }
  }

  let ordered = [...merged.values()].sort((a, b) => b.fusion - a.fusion);
  if (ordered.length === 0) return [];

  ordered = ordered.slice(0, Math.min(ordered.length, 28));

  if (env.cohereApiKey && ordered.length > 1) {
    const docs = ordered.map((r) => r.contenido.slice(0, 1200));
    try {
      const indices = await rerankDocuments({
        query,
        documents: docs,
        topN: Math.min(8, docs.length),
      });
      ordered = indices.map((i) => ordered[i]).filter(Boolean) as Scored[];
    } catch {
      ordered = ordered.slice(0, 8);
    }
  } else {
    ordered = ordered.slice(0, 8);
  }

  return ordered.slice(0, 6).map(({ fusion: _f, ...row }) => row);
}
