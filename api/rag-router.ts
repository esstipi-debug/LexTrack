import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { createLogger } from "./lib/logger";

const log = createLogger("rag-router");
import { getDb } from "./queries/connection";
import { getRagPool } from "./queries/rag-pg";
import { documentosLegales, conversacionesRag, jurisprudencias } from "@db/schema";
import { sql, and, eq, gt, like } from "drizzle-orm";

const paginationInput = z.object({
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.number().int().positive().nullish(),
});
import { verifyCitations } from "./lib/rag/citations";
import { rowsToRetrievedChunks } from "./lib/rag/chunks";
import { rankDocumentosLegales, rankJurisprudencia } from "./lib/rag/retrieve-local";
import { hybridRetrieve, pgRowToRetrievedChunk } from "./lib/rag/pg-hybrid";
import { renderChatMarkdownFromChunks } from "./lib/rag/chat-markdown";
import { answerWithClaude } from "./lib/rag/llm-answer";
import { env } from "./lib/env";

function emptyRagMessage(mensaje: string): string {
  return `No encontré normativa específica sobre "${mensaje}" en mi base de datos.\n\nTe sugiero:\n• Reformular tu consulta con términos más generales\n• Consultar directamente en www.leychile.cl\n• Verificar si la norma pertenece a otra legislación (civil, penal, etc.)`;
}

export const ragRouter = createRouter({
  buscar: authedQuery
    .input(z.object({ query: z.string().min(1), limite: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const query = input.query;
      const limite = input.limite || 5;

      const likePattern = `%${query}%`;

      const docs = await db
        .select()
        .from(documentosLegales)
        .where(
          and(
            sql`${documentosLegales.estaActiva} = true`,
            like(documentosLegales.contenido, likePattern),
          )
        )
        .limit(50);

      const scored = rankDocumentosLegales(query, docs, limite);

      const juris = await db
        .select()
        .from(jurisprudencias)
        .where(
          and(
            sql`${jurisprudencias.estaActiva} = true`,
            like(jurisprudencias.contenido, likePattern),
          )
        )
        .limit(50);

      const scoredJuris = rankJurisprudencia(query, juris, 3);

      return {
        documentos: scored,
        jurisprudencia: scoredJuris,
        totalDocumentos: scored.length,
        totalJurisprudencia: scoredJuris.length,
      };
    }),

  chat: authedQuery
    .input(
      z.object({
        mensaje: z.string().min(1),
        sessionId: z.string().optional(),
        historial: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const { mensaje, sessionId, historial } = input;

      let pipeline: "mysql_lexical" | "pg_hybrid" | "pg_hybrid_llm" = "mysql_lexical";
      let respuesta = "";
      let fuentes: string[] = [];
      let retrievedChunks = rowsToRetrievedChunks([], []);

      const pool = getRagPool();
      const canHybrid = Boolean(pool && env.voyageApiKey?.trim());

      if (canHybrid && pool) {
        try {
          const cnt = await pool.query<{ c: string }>("SELECT COUNT(*)::text AS c FROM rag_chunks");
          const n = parseInt(cnt.rows[0]?.c ?? "0", 10);
          if (n > 0) {
            const hybridRows = await hybridRetrieve(pool, mensaje);
            if (hybridRows.length > 0) {
              retrievedChunks = hybridRows.map(pgRowToRetrievedChunk);
              const useLlm = Boolean(env.anthropicApiKey?.trim());
              pipeline = useLlm ? "pg_hybrid_llm" : "pg_hybrid";
              if (useLlm) {
                respuesta = await answerWithClaude(mensaje, retrievedChunks, historial);
                fuentes = retrievedChunks.map((c) =>
                  c.source === "jurisprudencia"
                    ? `Fallo: ${c.rol || c.caratula || c.id}`
                    : `${c.norma || "—"} — ${c.articulo || c.titulo || ""}`
                );
              } else {
                const out = renderChatMarkdownFromChunks(retrievedChunks);
                respuesta = out.markdown;
                fuentes = out.fuentes;
              }
            }
          }
        } catch (e) {
          log.error({ err: e }, "hybrid pipeline failed");
        }
      }

      if (!respuesta) {
        pipeline = "mysql_lexical";
        const docs = await db
          .select()
          .from(documentosLegales)
          .where(sql`${documentosLegales.estaActiva} = true`);

        const scoredDocs = rankDocumentosLegales(mensaje, docs, 3);

        const juris = await db
          .select()
          .from(jurisprudencias)
          .where(sql`${jurisprudencias.estaActiva} = true`);

        const scoredJuris = rankJurisprudencia(mensaje, juris, 2);

        retrievedChunks = rowsToRetrievedChunks(scoredDocs, scoredJuris);

        if (scoredDocs.length === 0 && scoredJuris.length === 0) {
          respuesta = emptyRagMessage(mensaje);
        } else {
          const out = renderChatMarkdownFromChunks(retrievedChunks);
          respuesta = out.markdown;
          fuentes = out.fuentes;
        }
      }

      const verification =
        retrievedChunks.length > 0
          ? verifyCitations(respuesta, retrievedChunks)
          : { ok: true, invalidArticles: [], invalidRoles: [], invalidLeyes: [], citasSugeridas: [] };

      if (!verification.ok) {
        const parts: string[] = [];
        if (verification.invalidArticles.length > 0) parts.push(`artículos: ${verification.invalidArticles.join(", ")}`);
        if (verification.invalidRoles.length > 0) parts.push(`roles: ${verification.invalidRoles.join(", ")}`);
        if (verification.invalidLeyes.length > 0) parts.push(`leyes: ${verification.invalidLeyes.join(", ")}`);
        respuesta += `\n\n⚠️ **Verificación interna:** algunas citas no pudieron validarse contra el contexto recuperado (${parts.join("; ") || "—"}). Revisa las fuentes antes de usar esta respuesta en un caso real.`;
      }

      if (sessionId) {
        await db.insert(conversacionesRag).values({
          userId: ctx.user.id,
          sessionId,
          role: "user",
          content: mensaje,
        });
        await db.insert(conversacionesRag).values({
          userId: ctx.user.id,
          sessionId,
          role: "assistant",
          content: respuesta,
          contexto: JSON.stringify(retrievedChunks.map((c) => c.id)),
          fuentes: fuentes.join("; "),
        });
      }

      const docCount = retrievedChunks.filter((c) => c.source === "CT" || c.source === "ley_especial").length;
      const jurisCount = retrievedChunks.filter((c) => c.source === "jurisprudencia").length;

      return {
        respuesta,
        fuentes,
        documentosEncontrados: docCount,
        jurisprudenciaEncontrada: jurisCount,
        verificacionCitas: verification,
        pipeline,
      };
    }),

  conversaciones: authedQuery
    .input(
      z.object({
        sessionId: z.string(),
        limit: z.number().int().positive().max(100).optional(),
        cursor: z.number().int().positive().nullish(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const limit = Math.min(input.limit ?? 20, 100);
      const cursor = input.cursor ?? null;
      // Chronological order (ASC by id) — cursor advances forward in time.
      const rows = await db
        .select()
        .from(conversacionesRag)
        .where(
          and(
            eq(conversacionesRag.sessionId, input.sessionId),
            eq(conversacionesRag.userId, ctx.user.id),
            cursor ? gt(conversacionesRag.id, cursor) : undefined
          )
        )
        .orderBy(conversacionesRag.id)
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1].id : null;
      return { items, nextCursor };
    }),

  estadisticas: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const totalDocs = await db
      .select()
      .from(documentosLegales)
      .where(sql`${documentosLegales.estaActiva} = true`);
    const totalJuris = await db
      .select()
      .from(jurisprudencias)
      .where(sql`${jurisprudencias.estaActiva} = true`);
    const totalConversaciones = await db
      .select()
      .from(conversacionesRag)
      .where(sql`${conversacionesRag.userId} = ${ctx.user.id}`);

    const porNorma = totalDocs.reduce(
      (acc, d) => {
        acc[d.norma || "Otras"] = (acc[d.norma || "Otras"] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    let ragPostgresChunks: number | null = null;
    const pool = getRagPool();
    if (pool) {
      try {
        const r = await pool.query<{ c: string }>("SELECT COUNT(*)::text AS c FROM rag_chunks");
        ragPostgresChunks = parseInt(r.rows[0]?.c ?? "0", 10);
      } catch {
        ragPostgresChunks = null;
      }
    }

    return {
      totalDocumentos: totalDocs.length,
      totalJurisprudencia: totalJuris.length,
      totalConversaciones: totalConversaciones.length,
      porNorma,
      ragPostgresChunks,
    };
  }),
});
