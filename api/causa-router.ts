import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { causas, tareas, alertas, cronologia, notas } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";

export const causaRouter = createRouter({
  listar: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(causas).orderBy(desc(causas.createdAt));
  }),

  crear: publicQuery
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
    .mutation(async ({ input }) => {
      const db = getDb();
      const values: Record<string, unknown> = { ...input };
      if (input.fechaIngreso) values.fechaIngreso = new Date(input.fechaIngreso);
      delete (values as any).datos;
      await db.insert(causas).values(values as any);
      return { ok: true };
    }),

  obtener: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const causa = await db.select().from(causas).where(eq(causas.id, input.id)).limit(1);
      if (causa.length === 0) return null;
      const tareasCausa = await db.select().from(tareas).where(eq(tareas.causaId, input.id));
      const alertasCausa = await db.select().from(alertas).where(eq(alertas.causaId, input.id));
      const cronologiaCausa = await db.select().from(cronologia).where(eq(cronologia.causaId, input.id));
      const notasCausa = await db.select().from(notas).where(eq(notas.causaId, input.id));
      return { ...causa[0], tareas: tareasCausa, alertas: alertasCausa, cronologia: cronologiaCausa, notas: notasCausa };
    }),

  actualizar: publicQuery
    .input(z.object({ id: z.number(), datos: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(causas).set(input.datos).where(eq(causas.id, input.id));
      return { ok: true };
    }),

  buscar: publicQuery
    .input(z.object({ termino: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(causas)
        .where(
          sql`${causas.caratula} LIKE ${"%" + input.termino + "%"} OR ${causas.rit} LIKE ${"%" + input.termino + "%"} OR ${causas.ruc} LIKE ${"%" + input.termino + "%"}`
        )
        .limit(10);
    }),

  crearNota: publicQuery
    .input(z.object({
      causaId: z.number(),
      contenido: z.string(),
      tipo: z.string().default("general"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(notas).values({
        causaId: input.causaId,
        contenido: input.contenido,
        tipo: input.tipo as any,
      });
      return { ok: true };
    }),
});
