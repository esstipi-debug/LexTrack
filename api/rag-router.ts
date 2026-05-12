import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { documentosLegales, conversacionesRag, jurisprudencias } from "@db/schema";
import { sql } from "drizzle-orm";
import { verifyCitations } from "./lib/rag/citations";
import { formatLegalCitation, rowsToRetrievedChunks } from "./lib/rag/chunks";
import { rankDocumentosLegales, rankJurisprudencia } from "./lib/rag/retrieve-local";

export const ragRouter = createRouter({
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

      const scored = rankDocumentosLegales(query, docs, limite);

      const juris = await db
        .select()
        .from(jurisprudencias)
        .where(sql`${jurisprudencias.estaActiva} = 1`);

      const scoredJuris = rankJurisprudencia(query, juris, 3);

      return {
        documentos: scored,
        jurisprudencia: scoredJuris,
        totalDocumentos: scored.length,
        totalJurisprudencia: scoredJuris.length,
      };
    }),

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

      const docs = await db
        .select()
        .from(documentosLegales)
        .where(sql`${documentosLegales.estaActiva} = 1`);

      const scoredDocs = rankDocumentosLegales(mensaje, docs, 3);

      const juris = await db
        .select()
        .from(jurisprudencias)
        .where(sql`${jurisprudencias.estaActiva} = 1`);

      const scoredJuris = rankJurisprudencia(mensaje, juris, 2);

      let respuesta = "";
      const fuentes: string[] = [];
      const retrievedChunks = rowsToRetrievedChunks(scoredDocs, scoredJuris);

      if (scoredDocs.length === 0 && scoredJuris.length === 0) {
        respuesta = `No encontré normativa específica sobre "${mensaje}" en mi base de datos.\n\nTe sugiero:\n• Reformular tu consulta con términos más generales\n• Consultar directamente en www.leychile.cl\n• Verificar si la norma pertenece a otra legislación (civil, penal, etc.)`;
      } else {
        respuesta = `**Análisis normativo:**\n\n`;

        if (scoredDocs.length > 0) {
          respuesta += `**Normativa aplicable:**\n\n`;
          scoredDocs.forEach((d, i) => {
            const contenido =
              d.contenido.length > 500 ? d.contenido.substring(0, 500) + "..." : d.contenido;
            const cite = formatLegalCitation(d);
            respuesta += `${i + 1}. **${d.articulo || d.titulo}** (${d.norma})\n${contenido}\nCita: ${cite}\n\n`;
            fuentes.push(`${d.norma} — ${d.articulo || d.titulo}`);
          });
        }

        if (scoredJuris.length > 0) {
          respuesta += `**Jurisprudencia relevante:**\n\n`;
          scoredJuris.forEach((j, i) => {
            const extracto = j.extracto || (j.contenido.length > 300 ? j.contenido.substring(0, 300) + "..." : j.contenido);
            const rit = j.rit?.trim();
            const fecha = j.fechaSentencia ? String(j.fechaSentencia) : "s/fecha";
            const tribunal = j.tribunal || "Tribunal";
            respuesta += `${i + 1}. **${j.caratula || j.rit}** — ${tribunal}\n${extracto}\n`;
            if (rit) {
              respuesta += `Cita: [Rol N° ${rit} / ${tribunal} / ${fecha}]\n\n`;
              fuentes.push(`Fallo: ${rit}`);
            } else {
              respuesta += "\n";
              fuentes.push(`Fallo: ${j.caratula || "sentencia"}`);
            }
          });
        }

        respuesta += `---\n*Esta información es orientativa. Verifica siempre las fuentes oficiales en www.leychile.cl*`;
      }

      const verification =
        retrievedChunks.length > 0 ? verifyCitations(respuesta, retrievedChunks) : { ok: true, invalidArticles: [], invalidRoles: [] };

      if (!verification.ok) {
        respuesta += `\n\n⚠️ **Verificación interna:** algunas citas no pudieron validarse contra el contexto recuperado (artículos: ${verification.invalidArticles.join(", ") || "—"}; roles: ${verification.invalidRoles.join(", ") || "—"}). Revisa las fuentes antes de usar esta respuesta en un caso real.`;
      }

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
        verificacionCitas: verification,
      };
    }),

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
