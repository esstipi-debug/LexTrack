import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { jurisprudencias } from "@db/schema";
import { desc, sql } from "drizzle-orm";

function scoreDoc(query: string, doc: { caratula?: string | null; contenido: string; extracto?: string | null }): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (queryWords.length === 0) return 0;
  let score = 0;
  for (const word of queryWords) {
    if (doc.caratula?.toLowerCase().includes(word)) score += 10;
    if (doc.extracto?.toLowerCase().includes(word)) score += 8;
    const contentMatches = (doc.contenido.toLowerCase().match(new RegExp(word, "g")) || []).length;
    score += contentMatches * 1.5;
  }
  return score;
}

export const jurisprudenciaRouter = createRouter({
  listar: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(jurisprudencias).orderBy(desc(jurisprudencias.createdAt));
  }),

  buscar: publicQuery
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      const docs = await db.select().from(jurisprudencias)
        .where(sql`${jurisprudencias.estaActiva} = 1`)
        .limit(50);
      const scored = docs.map(d => ({
        ...d,
        score: scoreDoc(input.query, d),
      })).filter(d => d.score > 0.5).sort((a, b) => b.score - a.score).slice(0, 5);
      return scored;
    }),

  estadisticas: publicQuery.query(async () => {
    const db = getDb();
    const total = await db.select().from(jurisprudencias);
    const porTribunal = total.reduce((acc, j) => {
      const key = j.tribunal || "Sin tribunal";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { total: total.length, porTribunal };
  }),
});
