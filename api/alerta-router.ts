import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { alertas } from "@db/schema";
import { eq, desc, and, sql, lt } from "drizzle-orm";

const paginationInput = z.object({
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.number().int().positive().nullish(),
});

const PRIORIDAD = ["baja", "media", "alta", "critica"] as const;
const TIPO = [
  "cambio_estado",
  "nuevo_movimiento",
  "nueva_resolucion",
  "prazo_proximo",
  "audiencia_programada",
  "notificacion_pendiente",
  "cambio_normativo",
  "diario_oficial",
  "dt_dictamen",
  "system",
] as const;
const ESTADO = ["pendiente", "leida", "archivada"] as const;

export const alertaRouter = createRouter({
  listar: authedQuery
    .input(paginationInput.optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const limit = Math.min(input?.limit ?? 20, 100);
      const cursor = input?.cursor ?? null;
      // TODO: existing endpoint sorted by prioridad CASE then createdAt desc.
      // For cursor pagination we paginate by id desc only — primary prioridad
      // sort is dropped here. Re-add compound cursor if UX needs it.
      const rows = await db
        .select()
        .from(alertas)
        .where(
          and(
            eq(alertas.userId, ctx.user.id),
            cursor ? lt(alertas.id, cursor) : undefined
          )
        )
        .orderBy(desc(alertas.id))
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
      const rows = await db
        .select()
        .from(alertas)
        .where(and(eq(alertas.id, input.id), eq(alertas.userId, ctx.user.id)))
        .limit(1);
      return rows[0] ?? null;
    }),

  crear: authedQuery
    .input(
      z.object({
        titulo: z.string().min(1, "El título es requerido"),
        descripcion: z.string().optional(),
        prioridad: z.enum(PRIORIDAD).default("media"),
        tipo: z.enum(TIPO).default("system"),
        causaId: z.number().int().positive().optional(),
        expedienteId: z.number().int().positive().optional(),
        fechaEvento: z.string().optional(),
        fechaVencimiento: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const values: Record<string, unknown> = {
        userId: ctx.user.id,
        titulo: input.titulo,
        descripcion: input.descripcion ?? null,
        prioridad: input.prioridad,
        tipo: input.tipo,
        estado: "pendiente" as const,
        causaId: input.causaId ?? null,
        expedienteId: input.expedienteId ?? null,
      };
      if (input.fechaEvento) values.fechaEvento = new Date(input.fechaEvento);
      if (input.fechaVencimiento)
        values.fechaVencimiento = new Date(input.fechaVencimiento);

      const [result] = await db
        .insert(alertas)
        .values(values as Parameters<typeof db.insert>[0] extends infer T ? any : any)
        .$returningId();
      return result;
    }),

  marcarLeida: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db
        .update(alertas)
        .set({ estado: "leida", leidaAt: new Date() })
        .where(
          and(
            eq(alertas.id, input.id),
            eq(alertas.userId, ctx.user.id),
            eq(alertas.estado, "pendiente")
          )
        );
      return { ok: true };
    }),

  marcarTodasLeidas: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    await db
      .update(alertas)
      .set({ estado: "leida", leidaAt: new Date() })
      .where(and(eq(alertas.userId, ctx.user.id), eq(alertas.estado, "pendiente")));
    return { ok: true };
  }),

  archivar: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db
        .update(alertas)
        .set({ estado: "archivada" })
        .where(and(eq(alertas.id, input.id), eq(alertas.userId, ctx.user.id)));
      return { ok: true };
    }),

  dashboard: authedQuery.query(async ({ ctx }) => {
    const db = getDb();

    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    const hoyFin = new Date();
    hoyFin.setHours(23, 59, 59, 999);

    const userScope = eq(alertas.userId, ctx.user.id);

    const [totalPendientes, totalLeidasHoy, porTipo, porPrioridad, totalArchivadas] =
      await Promise.all([
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(alertas)
          .where(and(userScope, eq(alertas.estado, "pendiente"))),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(alertas)
          .where(
            and(
              userScope,
              eq(alertas.estado, "leida"),
              sql`${alertas.leidaAt} >= ${hoyInicio} AND ${alertas.leidaAt} <= ${hoyFin}`
            )
          ),
        db
          .select({ tipo: alertas.tipo, count: sql<number>`COUNT(*)` })
          .from(alertas)
          .where(userScope)
          .groupBy(alertas.tipo),
        db
          .select({ prioridad: alertas.prioridad, count: sql<number>`COUNT(*)` })
          .from(alertas)
          .where(userScope)
          .groupBy(alertas.prioridad),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(alertas)
          .where(and(userScope, eq(alertas.estado, "archivada"))),
      ]);

    return {
      totalPendientes: Number(totalPendientes[0]?.count ?? 0),
      totalLeidasHoy: Number(totalLeidasHoy[0]?.count ?? 0),
      totalArchivadas: Number(totalArchivadas[0]?.count ?? 0),
      porTipo: porTipo.map((r) => ({ tipo: r.tipo, count: Number(r.count) })),
      porPrioridad: porPrioridad.map((r) => ({
        prioridad: r.prioridad,
        count: Number(r.count),
      })),
    };
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
      // TODO: primary prioridad CASE sort dropped for cursor pagination.
      const rows = await db
        .select()
        .from(alertas)
        .where(
          and(
            eq(alertas.causaId, input.causaId),
            eq(alertas.userId, ctx.user.id),
            cursor ? lt(alertas.id, cursor) : undefined
          )
        )
        .orderBy(desc(alertas.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1].id : null;
      return { items, nextCursor };
    }),
});
