import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { tareas, causas } from "@db/schema";
import { eq, desc, and, sql, lt } from "drizzle-orm";
import { getUserOrgIds, getPrimaryOrgId, visibleToUserCondition } from "./lib/org-scope";

const paginationInput = z.object({
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.number().int().positive().nullish(),
});

const tipoEnum = z.enum([
  "revision_documento",
  "preparar_escrito",
  "seguimiento_causa",
  "revisar_resolucion",
  "notificar_cliente",
  "agendar_audiencia",
  "investigar_norma",
  "checklist_despido",
  "checklist_finiquito",
  "revisar_diario_oficial",
  "otra",
]);

const estadoEnum = z.enum(["pendiente", "en_progreso", "completada", "cancelada"]);
const prioridadEnum = z.enum(["baja", "media", "alta", "critica"]);

export const tareaRouter = createRouter({
  listar: authedQuery
    .input(paginationInput.optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const limit = Math.min(input?.limit ?? 20, 100);
      const cursor = input?.cursor ?? null;
      const orgIds = await getUserOrgIds(ctx.user.id);
      const visibility = visibleToUserCondition(
        tareas.userId,
        tareas.orgId,
        ctx.user.id,
        orgIds,
      );
      const rows = await db
        .select()
        .from(tareas)
        .where(
          and(
            visibility,
            cursor ? lt(tareas.id, cursor) : undefined
          )
        )
        .orderBy(desc(tareas.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1].id : null;
      return { items, nextCursor };
    }),

  obtener: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const orgIds = await getUserOrgIds(ctx.user.id);
      const tareaVis = visibleToUserCondition(
        tareas.userId,
        tareas.orgId,
        ctx.user.id,
        orgIds,
      );
      const causaVis = visibleToUserCondition(
        causas.userId,
        causas.orgId,
        ctx.user.id,
        orgIds,
      );
      const tarea = await db
        .select()
        .from(tareas)
        .where(and(eq(tareas.id, input.id), tareaVis))
        .limit(1);
      if (tarea.length === 0) return null;
      let causa = null;
      if (tarea[0].causaId) {
        const causaResult = await db
          .select()
          .from(causas)
          .where(and(eq(causas.id, tarea[0].causaId), causaVis))
          .limit(1);
        causa = causaResult[0] ?? null;
      }
      return { ...tarea[0], causa };
    }),

  crear: authedQuery
    .input(
      z.object({
        titulo: z.string(),
        descripcion: z.string().optional(),
        tipo: tipoEnum.default("otra"),
        prioridad: prioridadEnum.default("media"),
        fechaVencimiento: z.string().optional(),
        causaId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const orgId = await getPrimaryOrgId(ctx.user.id);
      const [result] = await db
        .insert(tareas)
        .values({
          userId: ctx.user.id,
          orgId, // auto-share within firm when applicable
          titulo: input.titulo,
          descripcion: input.descripcion ?? null,
          tipo: input.tipo,
          prioridad: input.prioridad,
          causaId: input.causaId ?? null,
          fechaVencimiento: input.fechaVencimiento
            ? new Date(input.fechaVencimiento)
            : null,
        })
        .$returningId();
      return result;
    }),

  actualizar: authedQuery
    .input(
      z.object({
        id: z.number(),
        titulo: z.string().optional(),
        descripcion: z.string().optional(),
        estado: estadoEnum.optional(),
        prioridad: prioridadEnum.optional(),
        fechaVencimiento: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const { id, ...fields } = input;
      const update: Record<string, unknown> = {};
      if (fields.titulo !== undefined) update.titulo = fields.titulo;
      if (fields.descripcion !== undefined)
        update.descripcion = fields.descripcion;
      if (fields.estado !== undefined) update.estado = fields.estado;
      if (fields.prioridad !== undefined) update.prioridad = fields.prioridad;
      if (fields.fechaVencimiento !== undefined) {
        update.fechaVencimiento = fields.fechaVencimiento
          ? new Date(fields.fechaVencimiento)
          : null;
      }
      const orgIds = await getUserOrgIds(ctx.user.id);
      const visibility = visibleToUserCondition(
        tareas.userId,
        tareas.orgId,
        ctx.user.id,
        orgIds,
      );
      await db
        .update(tareas)
        .set(update)
        .where(and(eq(tareas.id, id), visibility));
      return { ok: true };
    }),

  completar: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const orgIds = await getUserOrgIds(ctx.user.id);
      const visibility = visibleToUserCondition(
        tareas.userId,
        tareas.orgId,
        ctx.user.id,
        orgIds,
      );
      await db
        .update(tareas)
        .set({
          estado: "completada",
          fechaCompletada: new Date(),
        })
        .where(and(eq(tareas.id, input.id), visibility));
      return { ok: true };
    }),

  eliminar: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      // Delete policy: keep strict — owner can only delete their own tareas.
      // (Firm-wide delete by admins would need extra role check; out of scope.)
      await db
        .delete(tareas)
        .where(and(eq(tareas.id, input.id), eq(tareas.userId, ctx.user.id)));
      return { ok: true };
    }),

  porCausa: authedQuery
    .input(
      z.object({
        causaId: z.number(),
        limit: z.number().int().positive().max(100).optional(),
        cursor: z.number().int().positive().nullish(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const limit = Math.min(input.limit ?? 20, 100);
      const cursor = input.cursor ?? null;
      const orgIds = await getUserOrgIds(ctx.user.id);
      const visibility = visibleToUserCondition(
        tareas.userId,
        tareas.orgId,
        ctx.user.id,
        orgIds,
      );
      const rows = await db
        .select()
        .from(tareas)
        .where(
          and(
            eq(tareas.causaId, input.causaId),
            visibility,
            cursor ? lt(tareas.id, cursor) : undefined
          )
        )
        .orderBy(desc(tareas.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1].id : null;
      return { items, nextCursor };
    }),

  resumenSemanal: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const hoy = new Date();
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay() + 1);
    inicioSemana.setHours(0, 0, 0, 0);
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);
    finSemana.setHours(23, 59, 59, 999);

    const hoyStr = hoy.toISOString().split("T")[0];
    const inicioStr = inicioSemana.toISOString().split("T")[0];
    const finStr = finSemana.toISOString().split("T")[0];

    const orgIds = await getUserOrgIds(ctx.user.id);
    const userScope = visibleToUserCondition(
      tareas.userId,
      tareas.orgId,
      ctx.user.id,
      orgIds,
    );

    const vencenEstaSemana = await db
      .select()
      .from(tareas)
      .where(
        and(
          userScope,
          sql`${tareas.estado} IN ('pendiente', 'en_progreso')`,
          sql`${tareas.fechaVencimiento} >= ${inicioStr}`,
          sql`${tareas.fechaVencimiento} <= ${finStr}`
        )
      )
      .orderBy(tareas.fechaVencimiento);

    const vencidas = await db
      .select()
      .from(tareas)
      .where(
        and(
          userScope,
          sql`${tareas.estado} IN ('pendiente', 'en_progreso')`,
          sql`${tareas.fechaVencimiento} < ${hoyStr}`
        )
      )
      .orderBy(tareas.fechaVencimiento);

    const completadasEstaSemana = await db
      .select()
      .from(tareas)
      .where(
        and(
          userScope,
          eq(tareas.estado, "completada"),
          sql`${tareas.fechaCompletada} >= ${inicioSemana.toISOString()}`,
          sql`${tareas.fechaCompletada} <= ${finSemana.toISOString()}`
        )
      )
      .orderBy(desc(tareas.fechaCompletada));

    return {
      vencenEstaSemana,
      vencidas,
      completadasEstaSemana,
    };
  }),

  actualizarEstado: authedQuery
    .input(z.object({ id: z.number(), estado: estadoEnum }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const update: Record<string, unknown> = { estado: input.estado };
      if (input.estado === "completada") {
        update.fechaCompletada = new Date();
      }
      const orgIds = await getUserOrgIds(ctx.user.id);
      const visibility = visibleToUserCondition(
        tareas.userId,
        tareas.orgId,
        ctx.user.id,
        orgIds,
      );
      await db
        .update(tareas)
        .set(update)
        .where(and(eq(tareas.id, input.id), visibility));
      return { ok: true };
    }),
});
