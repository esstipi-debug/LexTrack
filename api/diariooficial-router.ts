import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { diarioOficialNormas } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const diarioOficialRouter = createRouter({
  listar: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(diarioOficialNormas).orderBy(desc(diarioOficialNormas.fechaPublicacion));
  }),

  crear: publicQuery
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

  marcarAlerta: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(diarioOficialNormas).set({ alertaGenerada: true }).where(eq(diarioOficialNormas.id, input.id));
      return { ok: true };
    }),

  estadisticas: publicQuery.query(async () => {
    const db = getDb();
    const todas = await db.select().from(diarioOficialNormas);
    const porMateria = todas.reduce((acc, n) => {
      acc[n.materia] = (acc[n.materia] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { total: todas.length, porMateria };
  }),
});
