import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { honorarios } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";

export const honorarioRouter = createRouter({
  listar: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(honorarios).orderBy(desc(honorarios.createdAt));
  }),

  obtener: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const results = await db
        .select()
        .from(honorarios)
        .where(eq(honorarios.id, input.id))
        .limit(1);
      return results[0] ?? null;
    }),

  crear: authedQuery
    .input(
      z.object({
        cliente: z.string(),
        concepto: z.string(),
        tipo: z.string().default("honorario"),
        monto: z.number(),
        estado: z.string().default("pendiente"),
        fechaVencimiento: z.string().optional(),
        causaId: z.number().optional(),
        expedienteId: z.number().optional(),
        observaciones: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { fechaVencimiento, ...rest } = input;
      const values: any = {
        ...rest,
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
      };
      const [result] = await db.insert(honorarios).values(values).$returningId();
      return result;
    }),

  actualizar: authedQuery
    .input(
      z.object({
        id: z.number(),
        monto: z.number().optional(),
        montoPagado: z.number().optional(),
        estado: z.string().optional(),
        fechaPago: z.string().optional(),
        fechaVencimiento: z.string().optional(),
        observaciones: z.string().optional(),
        concepto: z.string().optional(),
        cliente: z.string().optional(),
        tipo: z.string().optional(),
        formaPago: z
          .enum([
            "efectivo",
            "transferencia",
            "cheque",
            "debito",
            "credito",
            "cuota",
          ])
          .optional(),
        facturado: z.boolean().optional(),
        numeroFactura: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, fechaPago, fechaVencimiento, ...fields } = input;
      const updateData: Record<string, unknown> = { ...fields };
      if (fechaPago !== undefined) {
        updateData.fechaPago = fechaPago ? new Date(fechaPago) : null;
      }
      if (fechaVencimiento !== undefined) {
        updateData.fechaVencimiento = fechaVencimiento
          ? new Date(fechaVencimiento)
          : null;
      }
      await db.update(honorarios).set(updateData).where(eq(honorarios.id, id));
      return { ok: true };
    }),

  registrarPago: authedQuery
    .input(z.object({ id: z.number(), monto: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const h = await db
        .select()
        .from(honorarios)
        .where(eq(honorarios.id, input.id))
        .limit(1);
      if (h.length === 0) return { ok: false };
      const nuevoPagado = (h[0].montoPagado || 0) + input.monto;
      const nuevoEstado =
        nuevoPagado >= h[0].monto ? "pagado" : "pagado_parcial";
      const fechaPago =
        nuevoPagado >= h[0].monto ? new Date() : undefined;
      const updateData: Record<string, unknown> = {
        montoPagado: nuevoPagado,
        estado: nuevoEstado,
      };
      if (fechaPago) {
        updateData.fechaPago = fechaPago;
      }
      await db
        .update(honorarios)
        .set(updateData)
        .where(eq(honorarios.id, input.id));
      return { ok: true, nuevoPagado, nuevoEstado };
    }),

  dashboard: authedQuery.query(async () => {
    const db = getDb();
    const todos = await db.select().from(honorarios);

    const totalFacturado = todos.reduce((a, h) => a + h.monto, 0);
    const totalPagado = todos.reduce((a, h) => a + (h.montoPagado || 0), 0);
    const totalPendiente = todos
      .filter(
        (h) => h.estado === "pendiente" || h.estado === "pagado_parcial"
      )
      .reduce((a, h) => a + (h.monto - (h.montoPagado || 0)), 0);
    const totalMoroso = todos
      .filter((h) => h.estado === "moroso" || h.estado === "vencido")
      .reduce((a, h) => a + (h.monto - (h.montoPagado || 0)), 0);

    // cobradoEsteMes / cobradoMesPasado based on fechaPago
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    let cobradoEsteMes = 0;
    let cobradoMesPasado = 0;

    for (const h of todos) {
      if (h.fechaPago) {
        const fp = new Date(h.fechaPago);
        if (fp >= thisMonthStart && fp <= now) {
          cobradoEsteMes += h.montoPagado || 0;
        } else if (fp >= lastMonthStart && fp <= lastMonthEnd) {
          cobradoMesPasado += h.montoPagado || 0;
        }
      }
    }

    // porCliente: group by cliente, sum monto and montoPagado
    const porClienteMap: Record<
      string,
      { cliente: string; monto: number; montoPagado: number }
    > = {};
    for (const h of todos) {
      if (!porClienteMap[h.cliente]) {
        porClienteMap[h.cliente] = {
          cliente: h.cliente,
          monto: 0,
          montoPagado: 0,
        };
      }
      porClienteMap[h.cliente].monto += h.monto;
      porClienteMap[h.cliente].montoPagado += h.montoPagado || 0;
    }
    const porCliente = Object.values(porClienteMap);

    // porEstado: count by estado
    const porEstadoMap: Record<string, number> = {};
    for (const h of todos) {
      porEstadoMap[h.estado] = (porEstadoMap[h.estado] || 0) + 1;
    }
    const porEstado = Object.entries(porEstadoMap).map(([estado, count]) => ({
      estado,
      count,
    }));

    // morosos: clients with overdue unpaid fees
    const hoy = new Date();
    const morososMap: Record<
      string,
      { cliente: string; montoAdeudado: number; items: number }
    > = {};
    for (const h of todos) {
      const isOverdue =
        h.estado !== "pagado" &&
        h.fechaVencimiento &&
        new Date(h.fechaVencimiento) < hoy;
      if (isOverdue) {
        if (!morososMap[h.cliente]) {
          morososMap[h.cliente] = {
            cliente: h.cliente,
            montoAdeudado: 0,
            items: 0,
          };
        }
        morososMap[h.cliente].montoAdeudado +=
          h.monto - (h.montoPagado || 0);
        morososMap[h.cliente].items += 1;
      }
    }
    const morosos = Object.values(morososMap);

    return {
      totalFacturado,
      totalPagado,
      totalPendiente,
      totalMoroso,
      cobradoEsteMes,
      cobradoMesPasado,
      porCliente,
      porEstado,
      morosos,
    };
  }),

  porCausa: authedQuery
    .input(z.object({ causaId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(honorarios)
        .where(eq(honorarios.causaId, input.causaId))
        .orderBy(desc(honorarios.createdAt));
    }),

  porCliente: authedQuery
    .input(z.object({ cliente: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(honorarios)
        .where(eq(honorarios.cliente, input.cliente))
        .orderBy(desc(honorarios.createdAt));
    }),

  estadisticas: authedQuery.query(async () => {
    const db = getDb();
    const todos = await db.select().from(honorarios);
    const totalFacturado = todos.reduce((a, h) => a + h.monto, 0);
    const totalPagado = todos.reduce(
      (a, h) => a + (h.montoPagado || 0),
      0
    );
    const pendientes = todos.filter(
      (h) => h.estado === "pendiente" || h.estado === "pagado_parcial"
    );
    const morosos = todos.filter(
      (h) => h.estado === "moroso" || h.estado === "vencido"
    );
    return {
      totalFacturado,
      totalPagado,
      porCobrar: totalFacturado - totalPagado,
      totalDocumentos: todos.length,
      pendientes: pendientes.length,
      morosos: morosos.length,
    };
  }),
});
