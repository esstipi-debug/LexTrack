import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { alertas } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const alertaRouter = createRouter({
  listar: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(alertas).orderBy(desc(alertas.createdAt));
  }),

  crear: publicQuery
    .input(z.object({
      titulo: z.string(),
      descripcion: z.string().optional(),
      prioridad: z.string().default("media"),
      tipo: z.string().default("system"),
      causaId: z.number().optional(),
      fechaVencimiento: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const values: Record<string, unknown> = {
        titulo: input.titulo,
        descripcion: input.descripcion,
        prioridad: input.prioridad as "baja" | "media" | "alta" | "critica",
        tipo: input.tipo as "cambio_estado" | "nuevo_movimiento" | "prazo_proximo" | "system",
        causaId: input.causaId || null,
      };
      if (input.fechaVencimiento) values.fechaVencimiento = new Date(input.fechaVencimiento);
      await db.insert(alertas).values(values as any);
      return { ok: true };
    }),

  marcarLeida: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(alertas).set({ estado: "leida", leidaAt: new Date() }).where(eq(alertas.id, input.id));
      return { ok: true };
    }),
});
