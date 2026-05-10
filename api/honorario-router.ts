import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { honorarios } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const honorarioRouter = createRouter({
  listar: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(honorarios).orderBy(desc(honorarios.createdAt));
  }),

  crear: publicQuery
    .input(z.object({
      cliente: z.string(),
      concepto: z.string(),
      tipo: z.string().default("honorario"),
      monto: z.number(),
      estado: z.string().default("pendiente"),
      fechaVencimiento: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(honorarios).values({
        ...input,
        fechaVencimiento: input.fechaVencimiento || null,
      }).$returningId();
      return result;
    }),

  registrarPago: publicQuery
    .input(z.object({ id: z.number(), monto: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const h = await db.select().from(honorarios).where(eq(honorarios.id, input.id)).limit(1);
      if (h.length === 0) return { ok: false };
      const nuevoPagado = (h[0].montoPagado || 0) + input.monto;
      const nuevoEstado = nuevoPagado >= h[0].monto ? "pagado" : "pagado_parcial";
      await db.update(honorarios).set({ montoPagado: nuevoPagado, estado: nuevoEstado }).where(eq(honorarios.id, input.id));
      return { ok: true };
    }),

  estadisticas: publicQuery.query(async () => {
    const db = getDb();
    const todos = await db.select().from(honorarios);
    const totalFacturado = todos.reduce((a, h) => a + h.monto, 0);
    const totalPagado = todos.reduce((a, h) => a + (h.montoPagado || 0), 0);
    const pendientes = todos.filter(h => h.estado === "pendiente" || h.estado === "pagado_parcial");
    return {
      totalFacturado,
      totalPagado,
      porCobrar: totalFacturado - totalPagado,
      totalDocumentos: todos.length,
      pendientes: pendientes.length,
    };
  }),
});
