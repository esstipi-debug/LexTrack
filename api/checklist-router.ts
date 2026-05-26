import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { checklistTemplates, checklistItems, checklistEjecuciones, checklistCompletados } from "@db/schema";
import { eq, and } from "drizzle-orm";

export const checklistRouter = createRouter({
  templates: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(checklistTemplates);
  }),

  items: authedQuery
    .input(z.object({ templateId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(checklistItems).where(eq(checklistItems.templateId, input.templateId));
    }),

  ejecutar: authedQuery
    .input(z.object({
      templateId: z.number(),
      causaId: z.number().optional(),
      titulo: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(checklistEjecuciones).values({
        templateId: input.templateId,
        causaId: input.causaId || null,
        titulo: input.titulo,
      }).$returningId();
      return result;
    }),

  ejecuciones: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(checklistEjecuciones);
  }),

  progreso: authedQuery
    .input(z.object({ ejecucionId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const completados = await db.select().from(checklistCompletados)
        .where(eq(checklistCompletados.ejecucionId, input.ejecucionId));
      return completados;
    }),

  completarItem: authedQuery
    .input(z.object({
      ejecucionId: z.number(),
      itemId: z.number(),
      completado: z.boolean(),
      notas: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      // Check if there's already a record for this item in this execution
      const existing = await db.select().from(checklistCompletados)
        .where(and(
          eq(checklistCompletados.ejecucionId, input.ejecucionId),
          eq(checklistCompletados.itemId, input.itemId),
        ));
      if (existing.length > 0) {
        await db.update(checklistCompletados)
          .set({
            completado: input.completado,
            notas: input.notas || null,
            completadoAt: input.completado ? new Date() : null,
          })
          .where(and(
            eq(checklistCompletados.ejecucionId, input.ejecucionId),
            eq(checklistCompletados.itemId, input.itemId),
          ));
      } else {
        await db.insert(checklistCompletados).values({
          ejecucionId: input.ejecucionId,
          itemId: input.itemId,
          completado: input.completado,
          notas: input.notas || null,
          completadoAt: input.completado ? new Date() : null,
        });
      }
      return { ok: true };
    }),
});
