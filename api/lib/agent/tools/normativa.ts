import { getDb } from "../../../queries/connection";
import { getRagPool } from "../../../queries/rag-pg";
import { documentosLegales, jurisprudencias } from "@db/schema";
import { sql } from "drizzle-orm";
import { rankDocumentosLegales, rankJurisprudencia } from "../../rag/retrieve-local";
import { hybridRetrieve, pgRowToRetrievedChunk } from "../../rag/pg-hybrid";
import { env } from "../../env";
import type { ToolInput, AgentContext } from "../types";

export async function executeBuscarNormativa(input: ToolInput, _ctx: AgentContext): Promise<string> {
  const db = getDb();
  const consulta = String(input.consulta ?? "");
  const pool = getRagPool();
  const canHybrid = Boolean(pool && env.voyageApiKey?.trim());

  if (canHybrid && pool) {
    try {
      const cnt = await pool.query<{ c: string }>("SELECT COUNT(*)::text AS c FROM rag_chunks");
      const n = parseInt(cnt.rows[0]?.c ?? "0", 10);
      if (n > 0) {
        const rows = await hybridRetrieve(pool, consulta);
        if (rows.length > 0) {
          const chunks = rows.map(pgRowToRetrievedChunk);
          return JSON.stringify({
            pipeline: "pg_hybrid",
            resultados: chunks.map((c) => ({
              fuente: c.source === "jurisprudencia" ? `Fallo: ${c.rol || c.caratula}` : `${c.norma} — ${c.articulo || c.titulo}`,
              contenido: c.contenido.slice(0, 2000),
              norma: c.norma,
              articulo: c.articulo,
            })),
            total: chunks.length,
          });
        }
      }
    } catch { /* fallback a MySQL */ }
  }

  const docs = await db.select().from(documentosLegales).where(sql`${documentosLegales.estaActiva} = true`);
  const scored = rankDocumentosLegales(consulta, docs, 5);
  return JSON.stringify({
    pipeline: "mysql_lexical",
    resultados: scored.map((d) => ({
      fuente: `${d.norma} — ${d.articulo || d.titulo}`,
      contenido: d.contenido.slice(0, 2000),
      norma: d.norma,
      articulo: d.articulo,
      score: d.score,
    })),
    total: scored.length,
  });
}

export async function executeBuscarJurisprudencia(input: ToolInput, _ctx: AgentContext): Promise<string> {
  const db = getDb();
  const consulta = String(input.consulta ?? "");
  const juris = await db.select().from(jurisprudencias).where(sql`${jurisprudencias.estaActiva} = true`);
  const scored = rankJurisprudencia(consulta, juris, 5);
  return JSON.stringify({
    resultados: scored.map((j) => ({
      caratula: j.caratula,
      tribunal: j.tribunal,
      tipo: j.tipo,
      fecha: j.fechaSentencia,
      rit: j.rit,
      extracto: (j.extracto || j.contenido).slice(0, 1500),
      normasAplicadas: j.normasAplicadas,
    })),
    total: scored.length,
  });
}
