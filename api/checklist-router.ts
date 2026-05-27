import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { checklistTemplates, checklistItems, checklistEjecuciones, checklistCompletados } from "@db/schema";
import { eq, and, desc, lt } from "drizzle-orm";

const paginationInput = z.object({
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.number().int().positive().nullish(),
});

export const checklistRouter = createRouter({
  templates: authedQuery
    .input(paginationInput.optional())
    .query(async ({ input }) => {
      const db = getDb();
      const limit = Math.min(input?.limit ?? 20, 100);
      const cursor = input?.cursor ?? null;
      const rows = await db
        .select()
        .from(checklistTemplates)
        .where(cursor ? lt(checklistTemplates.id, cursor) : undefined)
        .orderBy(desc(checklistTemplates.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1].id : null;
      return { items, nextCursor };
    }),

  items: authedQuery
    .input(
      z.object({
        templateId: z.number(),
        limit: z.number().int().positive().max(100).optional(),
        cursor: z.number().int().positive().nullish(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = Math.min(input.limit ?? 20, 100);
      const cursor = input.cursor ?? null;
      const rows = await db
        .select()
        .from(checklistItems)
        .where(
          and(
            eq(checklistItems.templateId, input.templateId),
            cursor ? lt(checklistItems.id, cursor) : undefined
          )
        )
        .orderBy(desc(checklistItems.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1].id : null;
      return { items, nextCursor };
    }),

  ejecutar: authedQuery
    .input(z.object({
      templateId: z.number(),
      causaId: z.number().optional(),
      titulo: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [result] = await db.insert(checklistEjecuciones).values({
        userId: ctx.user.id,
        templateId: input.templateId,
        causaId: input.causaId || null,
        titulo: input.titulo,
      }).$returningId();
      return result;
    }),

  ejecuciones: authedQuery
    .input(paginationInput.optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const limit = Math.min(input?.limit ?? 20, 100);
      const cursor = input?.cursor ?? null;
      const rows = await db
        .select()
        .from(checklistEjecuciones)
        .where(
          and(
            eq(checklistEjecuciones.userId, ctx.user.id),
            cursor ? lt(checklistEjecuciones.id, cursor) : undefined
          )
        )
        .orderBy(desc(checklistEjecuciones.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1].id : null;
      return { items, nextCursor };
    }),

  progreso: authedQuery
    .input(z.object({ ejecucionId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const completados = await db
        .select()
        .from(checklistCompletados)
        .where(
          and(
            eq(checklistCompletados.ejecucionId, input.ejecucionId),
            eq(checklistCompletados.userId, ctx.user.id)
          )
        );
      return completados;
    }),

  completarItem: authedQuery
    .input(z.object({
      ejecucionId: z.number(),
      itemId: z.number(),
      completado: z.boolean(),
      notas: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      // Check if there's already a record for this item in this execution
      const existing = await db.select().from(checklistCompletados)
        .where(and(
          eq(checklistCompletados.ejecucionId, input.ejecucionId),
          eq(checklistCompletados.itemId, input.itemId),
          eq(checklistCompletados.userId, ctx.user.id),
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
            eq(checklistCompletados.userId, ctx.user.id),
          ));
      } else {
        await db.insert(checklistCompletados).values({
          userId: ctx.user.id,
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
