import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { tareas } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const tareaRouter = createRouter({
  listar: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(tareas).orderBy(desc(tareas.createdAt));
  }),

  crear: publicQuery
    .input(z.object({
      titulo: z.string(),
      descripcion: z.string().optional(),
      tipo: z.string().default("otra"),
      prioridad: z.string().default("media"),
      fechaVencimiento: z.string().optional(),
      causaId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { fechaVencimiento, ...rest } = input;
      const [result] = await db.insert(tareas).values({
        ...rest,
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
      } as any).$returningId();
      return result;
    }),

  actualizarEstado: publicQuery
    .input(z.object({ id: z.number(), estado: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const update: Record<string, unknown> = { estado: input.estado };
      if (input.estado === "completada") {
        update.fechaCompletada = new Date();
      }
      await db.update(tareas).set(update).where(eq(tareas.id, input.id));
      return { ok: true };
    }),
});
