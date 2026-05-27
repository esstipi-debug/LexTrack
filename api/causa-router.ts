import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { causas, tareas, alertas, cronologia, notas } from "@db/schema";
import { eq, desc, sql, and, lt } from "drizzle-orm";

const paginationInput = z.object({
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.number().int().positive().nullish(),
});

export const causaRouter = createRouter({
  listar: authedQuery
    .input(paginationInput.optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const limit = Math.min(input?.limit ?? 20, 100);
      const cursor = input?.cursor ?? null;
      // NOTE: primary sort kept by id desc (which approximates createdAt desc
      // for newest-first cursor pagination). TODO: keep createdAt primary
      // sort with (createdAt, id) compound cursor if needed.
      const rows = await db
        .select()
        .from(causas)
        .where(
          and(
            eq(causas.userId, ctx.user.id),
            cursor ? lt(causas.id, cursor) : undefined
          )
        )
        .orderBy(desc(causas.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1].id : null;
      return { items, nextCursor };
    }),

  crear: authedQuery
    .input(
      z.object({
        rit: z.string(),
        ruc: z.string().optional(),
        caratula: z.string(),
        tribunal: z.string(),
        comuna: z.string().optional(),
        region: z.string().optional(),
        materia: z.string().default("laboral"),
        estado: z.string().default("tramitacion"),
        etapa: z.string().optional(),
        fechaIngreso: z.string().optional(),
        litigantes: z.string().optional(),
        abogadoDemandante: z.string().optional(),
        abogadoDemandado: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const values: Record<string, unknown> = { ...input, userId: ctx.user.id };
      if (input.fechaIngreso) values.fechaIngreso = new Date(input.fechaIngreso);
      delete (values as any).datos;
      await db.insert(causas).values(values as any);
      return { ok: true };
    }),

  obtener: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const causa = await db
        .select()
        .from(causas)
        .where(and(eq(causas.id, input.id), eq(causas.userId, ctx.user.id)))
        .limit(1);
      if (causa.length === 0) return null;
      const tareasCausa = await db
        .select()
        .from(tareas)
        .where(and(eq(tareas.causaId, input.id), eq(tareas.userId, ctx.user.id)));
      const alertasCausa = await db
        .select()
        .from(alertas)
        .where(and(eq(alertas.causaId, input.id), eq(alertas.userId, ctx.user.id)));
      const cronologiaCausa = await db
        .select()
        .from(cronologia)
        .where(
          and(eq(cronologia.causaId, input.id), eq(cronologia.userId, ctx.user.id))
        );
      const notasCausa = await db
        .select()
        .from(notas)
        .where(and(eq(notas.causaId, input.id), eq(notas.userId, ctx.user.id)));
      return { ...causa[0], tareas: tareasCausa, alertas: alertasCausa, cronologia: cronologiaCausa, notas: notasCausa };
    }),

  actualizar: authedQuery
    .input(z.object({ id: z.number(), datos: z.record(z.any()) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const datos = { ...input.datos };
      delete (datos as any).userId;
      await db
        .update(causas)
        .set(datos)
        .where(and(eq(causas.id, input.id), eq(causas.userId, ctx.user.id)));
      return { ok: true };
    }),

  buscar: authedQuery
    .input(z.object({ termino: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      return db
        .select()
        .from(causas)
        .where(
          and(
            eq(causas.userId, ctx.user.id),
            sql`${causas.caratula} ILIKE ${"%" + input.termino + "%"} OR ${causas.rit} ILIKE ${"%" + input.termino + "%"} OR ${causas.ruc} ILIKE ${"%" + input.termino + "%"}`
          )
        )
        .limit(10);
    }),

  crearNota: authedQuery
    .input(z.object({
      causaId: z.number(),
      contenido: z.string(),
      tipo: z.string().default("general"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.insert(notas).values({
        userId: ctx.user.id,
        causaId: input.causaId,
        contenido: input.contenido,
        tipo: input.tipo as any,
      });
      return { ok: true };
    }),
});
