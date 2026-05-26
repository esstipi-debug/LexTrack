import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { diarioOficialNormas } from "@db/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

export const diarioOficialRouter = createRouter({
  listar: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(diarioOficialNormas).orderBy(desc(diarioOficialNormas.fechaPublicacion));
  }),

  obtener: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(diarioOficialNormas)
        .where(eq(diarioOficialNormas.id, input.id))
        .limit(1);
      return result[0] ?? null;
    }),

  buscar: authedQuery
    .input(
      z.object({
        termino: z.string().optional(),
        tipo: z.string().optional(),
        materia: z.string().optional(),
        anoDesde: z.number().optional(),
        anoHasta: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions: ReturnType<typeof sql>[] = [];

      if (input.termino && input.termino.trim() !== "") {
        const like = `%${input.termino.trim()}%`;
        conditions.push(
          sql`(${diarioOficialNormas.titulo} LIKE ${like} OR ${diarioOficialNormas.extracto} LIKE ${like})`
        );
      }

      if (input.tipo) {
        conditions.push(sql`${diarioOficialNormas.tipo} = ${input.tipo}`);
      }

      if (input.materia) {
        conditions.push(sql`${diarioOficialNormas.materia} = ${input.materia}`);
      }

      if (input.anoDesde !== undefined) {
        conditions.push(gte(diarioOficialNormas.anoNorma, input.anoDesde));
      }

      if (input.anoHasta !== undefined) {
        conditions.push(lte(diarioOficialNormas.anoNorma, input.anoHasta));
      }

      const query = db
        .select()
        .from(diarioOficialNormas)
        .orderBy(desc(diarioOficialNormas.fechaPublicacion));

      if (conditions.length === 0) {
        return query;
      }

      return query.where(and(...conditions));
    }),

  porMateria: authedQuery.query(async () => {
    const db = getDb();
    const todas = await db.select().from(diarioOficialNormas);
    const grupos: Record<string, { materia: string; count: number; normas: typeof todas }> = {};

    for (const n of todas) {
      if (!grupos[n.materia]) {
        grupos[n.materia] = { materia: n.materia, count: 0, normas: [] };
      }
      grupos[n.materia].count += 1;
      grupos[n.materia].normas.push(n);
    }

    return Object.values(grupos).sort((a, b) => b.count - a.count);
  }),

  recientes: authedQuery.query(async () => {
    const db = getDb();
    // Fetch last 30 to allow prioritization of "laboral", then return top 10
    const todas = await db
      .select()
      .from(diarioOficialNormas)
      .orderBy(desc(diarioOficialNormas.fechaPublicacion))
      .limit(30);

    const laborales = todas.filter((n) => n.materia === "laboral");
    const otras = todas.filter((n) => n.materia !== "laboral");
    const combined = [...laborales, ...otras];
    return combined.slice(0, 10);
  }),

  dashboard: authedQuery.query(async () => {
    const db = getDb();
    const todas = await db.select().from(diarioOficialNormas);

    const porTipo: Record<string, number> = {};
    const porMateria: Record<string, number> = {};
    const porAno: Record<number, number> = {};

    let ultimaPublicacion: Date | string | null = null;

    for (const n of todas) {
      // por tipo
      porTipo[n.tipo] = (porTipo[n.tipo] || 0) + 1;

      // por materia
      porMateria[n.materia] = (porMateria[n.materia] || 0) + 1;

      // por año
      if (n.anoNorma !== null && n.anoNorma !== undefined) {
        porAno[n.anoNorma] = (porAno[n.anoNorma] || 0) + 1;
      }

      // última publicación
      const fecha = n.fechaPublicacion;
      if (fecha !== null && fecha !== undefined) {
        const fechaDate = fecha instanceof Date ? fecha : new Date(fecha);
        if (ultimaPublicacion === null) {
          ultimaPublicacion = fecha;
        } else {
          const ultimaDate =
            ultimaPublicacion instanceof Date
              ? ultimaPublicacion
              : new Date(ultimaPublicacion);
          if (fechaDate > ultimaDate) {
            ultimaPublicacion = fecha;
          }
        }
      }
    }

    const laboralesTotal = porMateria["laboral"] || 0;

    return {
      total: todas.length,
      laboralesTotal,
      porTipo,
      porMateria,
      porAno,
      ultimaPublicacion,
    };
  }),

  crear: authedQuery
    .input(z.object({
      titulo: z.string(),
      organismo: z.string(),
      tipo: z.string().default("ley"),
      materia: z.string().default("laboral"),
      fechaPublicacion: z.string(),
      extracto: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const values: Record<string, unknown> = {
        titulo: input.titulo,
        organismo: input.organismo,
        tipo: input.tipo as "ley" | "decreto" | "resolucion" | "circular" | "instruccion" | "acuerdo" | "convenio",
        materia: input.materia as "laboral" | "civil" | "penal" | "tributaria" | "administrativa" | "ambiental" | "otra",
        fechaPublicacion: new Date(input.fechaPublicacion),
        extracto: input.extracto,
      };
      await db.insert(diarioOficialNormas).values(values as any);
      return { ok: true };
    }),

  marcarAlerta: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(diarioOficialNormas).set({ alertaGenerada: true }).where(eq(diarioOficialNormas.id, input.id));
      return { ok: true };
    }),

  estadisticas: authedQuery.query(async () => {
    const db = getDb();
    const todas = await db.select().from(diarioOficialNormas);
    const porMateria = todas.reduce((acc, n) => {
      acc[n.materia] = (acc[n.materia] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { total: todas.length, porMateria };
  }),
});
