import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { checklistTemplates, checklistItems, checklistEjecuciones, checklistCompletados } from "@db/schema";
import { eq } from "drizzle-orm";

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

  completarItem: authedQuery
    .input(z.object({
      ejecucionId: z.number(),
      itemId: z.number(),
      completado: z.boolean(),
      notas: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(checklistCompletados).values({
        ejecucionId: input.ejecucionId,
        itemId: input.itemId,
        completado: input.completado,
        notas: input.notas || null,
        completadoAt: input.completado ? new Date() : null,
      });
      return { ok: true };
    }),
});
