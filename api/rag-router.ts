import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { documentosLegales, conversacionesRag, jurisprudencias } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";

// ─── TF-IDF SCORING ENGINE ───────────────────────────────────────
function scoreDoc(
  query: string,
  doc: { titulo: string; contenido: string; etiquetas?: string | null; articulo?: string | null }
): number {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (queryWords.length === 0) return 0;
  const text = `${doc.titulo} ${doc.contenido} ${doc.etiquetas || ""} ${doc.articulo || ""}`.toLowerCase();
  let score = 0;
  for (const word of queryWords) {
    // Title match is highest weight
    if (doc.titulo?.toLowerCase().includes(word)) score += 15;
    // Article number match
    if (doc.articulo?.toLowerCase().includes(word)) score += 12;
    // Content matches
    const contentMatches = (doc.contenido.toLowerCase().match(new RegExp(word, "g")) || []).length;
    score += contentMatches * 2;
    // Tag matches
    if (doc.etiquetas?.toLowerCase().includes(word)) score += 8;
  }
  // Normalize by document length
  return score / Math.sqrt(text.length / 100);
}

function scoreJurisprudencia(
  query: string,
  doc: { caratula?: string | null; contenido: string; extracto?: string | null; normasAplicadas?: string | null }
): number {
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
    const contentMatches = (doc.contenido.toLowerCase().match(new RegExp(word, "g")) || []).length;
    score += contentMatches * 1.5;
    if (doc.normasAplicadas?.toLowerCase().includes(word)) score += 6;
  }
  return score / Math.sqrt(text.length / 100);
}

// ─── RAG ROUTER ──────────────────────────────────────────────────
export const ragRouter = createRouter({
  // Buscar documentos legales (TF-IDF)
  buscar: publicQuery
    .input(z.object({ query: z.string().min(1), limite: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const query = input.query;
      const limite = input.limite || 5;

      const docs = await db
        .select()
        .from(documentosLegales)
        .where(sql`${documentosLegales.estaActiva} = 1`);

      const scored = docs
        .map((d) => ({
          ...d,
          score: scoreDoc(query, d),
        }))
        .filter((d) => d.score > 0.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, limite);

      // Buscar jurisprudencia relacionada
      const juris = await db
        .select()
        .from(jurisprudencias)
        .where(sql`${jurisprudencias.estaActiva} = 1`)
        .limit(50);

      const scoredJuris = juris
        .map((j) => ({
          ...j,
          score: scoreJurisprudencia(query, j),
        }))
        .filter((j) => j.score > 0.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      return {
        documentos: scored,
        jurisprudencia: scoredJuris,
        totalDocumentos: scored.length,
        totalJurisprudencia: scoredJuris.length,
      };
    }),

  // Chat RAG: recuperar documentos y generar respuesta
  chat: publicQuery
    .input(
      z.object({
        mensaje: z.string().min(1),
        sessionId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { mensaje, sessionId } = input;

      // 1. Buscar documentos relevantes
      const docs = await db
        .select()
        .from(documentosLegales)
        .where(sql`${documentosLegales.estaActiva} = 1`);

      const scoredDocs = docs
        .map((d) => ({
          ...d,
          score: scoreDoc(mensaje, d),
        }))
        .filter((d) => d.score > 0.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      // 2. Buscar jurisprudencia relevante
      const juris = await db
        .select()
        .from(jurisprudencias)
        .where(sql`${jurisprudencias.estaActiva} = 1`)
        .limit(50);

      const scoredJuris = juris
        .map((j) => ({
          ...j,
          score: scoreJurisprudencia(mensaje, j),
        }))
        .filter((j) => j.score > 0.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

      // 3. Generar respuesta
      let respuesta = "";
      const fuentes: string[] = [];

      if (scoredDocs.length === 0 && scoredJuris.length === 0) {
        respuesta = `No encontré normativa específica sobre "${mensaje}" en mi base de datos.\n\nTe sugiero:\n• Reformular tu consulta con términos más generales\n• Consultar directamente en www.leychile.cl\n• Verificar si la norma pertenece a otra legislación (civil, penal, etc.)`;
      } else {
        respuesta = `**Análisis normativo:**\n\n`;

        if (scoredDocs.length > 0) {
          respuesta += `**Normativa aplicable:**\n\n`;
          scoredDocs.forEach((d, i) => {
            const contenido =
              d.contenido.length > 500 ? d.contenido.substring(0, 500) + "..." : d.contenido;
            respuesta += `${i + 1}. **${d.articulo || d.titulo}** (${d.norma})\n${contenido}\n\n`;
            fuentes.push(`${d.norma} — ${d.articulo || d.titulo}`);
          });
        }

        if (scoredJuris.length > 0) {
          respuesta += `**Jurisprudencia relevante:**\n\n`;
          scoredJuris.forEach((j, i) => {
            const extracto = j.extracto || (j.contenido.length > 300 ? j.contenido.substring(0, 300) + "..." : j.contenido);
            respuesta += `${i + 1}. **${j.caratula || j.rit}** — ${j.tribunal}\n${extracto}\n\n`;
            fuentes.push(`Fallo: ${j.rit}`);
          });
        }

        respuesta += `---\n*Esta información es orientativa. Verifica siempre las fuentes oficiales en www.leychile.cl*`;
      }

      // 4. Guardar conversación
      if (sessionId) {
        await db.insert(conversacionesRag).values({
          sessionId,
          role: "user",
          content: mensaje,
        });
        await db.insert(conversacionesRag).values({
          sessionId,
          role: "assistant",
          content: respuesta,
          contexto: JSON.stringify(scoredDocs.map((d) => d.id)),
          fuentes: fuentes.join("; "),
        });
      }

      return {
        respuesta,
        fuentes,
        documentosEncontrados: scoredDocs.length,
        jurisprudenciaEncontrada: scoredJuris.length,
      };
    }),

  // Listar todas las conversaciones de una sesión
  conversaciones: publicQuery
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(conversacionesRag)
        .where(sql`${conversacionesRag.sessionId} = ${input.sessionId}`)
        .orderBy(conversacionesRag.createdAt);
    }),

  // Estadísticas del RAG
  estadisticas: publicQuery.query(async () => {
    const db = getDb();
    const totalDocs = await db
      .select()
      .from(documentosLegales)
      .where(sql`${documentosLegales.estaActiva} = 1`);
    const totalJuris = await db
      .select()
      .from(jurisprudencias)
      .where(sql`${jurisprudencias.estaActiva} = 1`);
    const totalConversaciones = await db.select().from(conversacionesRag);

    // Contar por norma
    const porNorma = totalDocs.reduce(
      (acc, d) => {
        acc[d.norma || "Otras"] = (acc[d.norma || "Otras"] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalDocumentos: totalDocs.length,
      totalJurisprudencia: totalJuris.length,
      totalConversaciones: totalConversaciones.length,
      porNorma,
    };
  }),
});
