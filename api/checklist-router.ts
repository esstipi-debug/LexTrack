import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { checklistTemplates, checklistItems, checklistEjecuciones, checklistCompletados } from "@db/schema";
import { eq, and, desc, lt } from "drizzle-orm";
import { getUserOrgIds, getPrimaryOrgId, visibleToUserCondition } from "./lib/org-scope";

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
      const orgId = await getPrimaryOrgId(ctx.user.id);
      const [result] = await db.insert(checklistEjecuciones).values({
        userId: ctx.user.id,
        orgId, // auto-share within firm
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
      const orgIds = await getUserOrgIds(ctx.user.id);
      const visibility = visibleToUserCondition(
        checklistEjecuciones.userId,
        checklistEjecuciones.orgId,
        ctx.user.id,
        orgIds,
      );
      const rows = await db
        .select()
        .from(checklistEjecuciones)
        .where(
          and(
            visibility,
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
      // First check that the ejecucion is visible to the caller (own or same firm)
      const orgIds = await getUserOrgIds(ctx.user.id);
      const ejecVis = visibleToUserCondition(
        checklistEjecuciones.userId,
        checklistEjecuciones.orgId,
        ctx.user.id,
        orgIds,
      );
      const [ejec] = await db
        .select({ id: checklistEjecuciones.id })
        .from(checklistEjecuciones)
        .where(and(eq(checklistEjecuciones.id, input.ejecucionId), ejecVis))
        .limit(1);
      if (!ejec) {
        // Return empty list rather than error — preserves prior cross-tenant
        // semantics (no leak about presence/absence of foreign ejecucion).
        return [];
      }
      // checklistCompletados does not (yet) carry orgId — surface all rows
      // for the visible ejecucion so firm members can see each other's progress.
      const completados = await db
        .select()
        .from(checklistCompletados)
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
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      // Verify ejecucion is visible (own or firm) before allowing changes
      const orgIds = await getUserOrgIds(ctx.user.id);
      const ejecVis = visibleToUserCondition(
        checklistEjecuciones.userId,
        checklistEjecuciones.orgId,
        ctx.user.id,
        orgIds,
      );
      const [ejec] = await db
        .select({ id: checklistEjecuciones.id })
        .from(checklistEjecuciones)
        .where(and(eq(checklistEjecuciones.id, input.ejecucionId), ejecVis))
        .limit(1);
      if (!ejec) {
        // Silently no-op for non-visible ejecucion (preserves prior semantics).
        return { ok: true };
      }
      // Check if there's already a record for this item in this execution.
      // Match by (ejecucionId, itemId) — the row tracks the firm's progress
      // for the item, so any visible member can mark/unmark.
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
