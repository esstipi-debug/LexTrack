import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { honorarios } from "@db/schema";
import { eq, desc, and, lt } from "drizzle-orm";

const paginationInput = z.object({
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.number().int().positive().nullish(),
});
import { calcularInteresMora } from "./lib/cobranza/intereses";
import {
  generarEstadoCuenta,
  generarReporteCobranza,
  generarCartaCobranza,
} from "./lib/cobranza/reportes";

export const honorarioRouter = createRouter({
  listar: authedQuery
    .input(paginationInput.optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const limit = Math.min(input?.limit ?? 20, 100);
      const cursor = input?.cursor ?? null;
      const rows = await db
        .select()
        .from(honorarios)
        .where(
          and(
            eq(honorarios.userId, ctx.user.id),
            cursor ? lt(honorarios.id, cursor) : undefined
          )
        )
        .orderBy(desc(honorarios.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1].id : null;
      return { items, nextCursor };
    }),

  crear: authedQuery
    .input(z.object({
      cliente: z.string(),
      concepto: z.string(),
      tipo: z.string().default("honorario"),
      monto: z.number(),
      estado: z.string().default("pendiente"),
      fechaVencimiento: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const { fechaVencimiento, ...rest } = input;
      const values: any = {
        ...rest,
        userId: ctx.user.id,
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
      };
      const [result] = await db.insert(honorarios).values(values).$returningId();
      return result;
    }),

  registrarPago: authedQuery
    .input(z.object({ id: z.number(), monto: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const h = await db
        .select()
        .from(honorarios)
        .where(
          and(eq(honorarios.id, input.id), eq(honorarios.userId, ctx.user.id))
        )
        .limit(1);
      if (h.length === 0) return { ok: false };
      const nuevoPagado = (h[0].montoPagado || 0) + input.monto;
      const nuevoEstado = nuevoPagado >= h[0].monto ? "pagado" : "pagado_parcial";
      await db
        .update(honorarios)
        .set({ montoPagado: nuevoPagado, estado: nuevoEstado })
        .where(
          and(eq(honorarios.id, input.id), eq(honorarios.userId, ctx.user.id))
        );
      return { ok: true };
    }),

  estadisticas: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const todos = await db
      .select()
      .from(honorarios)
      .where(eq(honorarios.userId, ctx.user.id));
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

  // ─── Cobranza: Calcular intereses ────────────────────────────────
  calcularIntereses: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(honorarios)
        .where(
          and(eq(honorarios.id, input.id), eq(honorarios.userId, ctx.user.id))
        )
        .limit(1);
      if (rows.length === 0) return null;
      const h = rows[0];
      if (!h.fechaVencimiento) {
        return {
          honorarioId: h.id,
          cliente: h.cliente,
          concepto: h.concepto,
          interes: null,
          mensaje: "Sin fecha de vencimiento definida",
        };
      }
      const interes = calcularInteresMora({
        monto: h.monto,
        montoPagado: h.montoPagado || 0,
        fechaVencimiento: h.fechaVencimiento,
      });
      return {
        honorarioId: h.id,
        cliente: h.cliente,
        concepto: h.concepto,
        interes,
      };
    }),

  // ─── Cobranza: Estado de cuenta por cliente ─────────────────────
  estadoCuenta: authedQuery
    .input(z.object({ cliente: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(honorarios)
        .where(
          and(
            eq(honorarios.cliente, input.cliente),
            eq(honorarios.userId, ctx.user.id)
          )
        )
        .orderBy(desc(honorarios.createdAt));
      const markdown = generarEstadoCuenta(input.cliente, rows);
      return { cliente: input.cliente, total: rows.length, markdown };
    }),

  // ─── Cobranza: Reporte general ──────────────────────────────────
  reporteCobranza: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const todos = await db
      .select()
      .from(honorarios)
      .where(eq(honorarios.userId, ctx.user.id));
    return generarReporteCobranza(todos);
  }),

  // ─── Cobranza: Carta de cobranza ────────────────────────────────
  generarCartaCobranza: authedQuery
    .input(z.object({ id: z.number(), numero: z.number().min(1).max(3) }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(honorarios)
        .where(
          and(eq(honorarios.id, input.id), eq(honorarios.userId, ctx.user.id))
        )
        .limit(1);
      if (rows.length === 0) return null;
      const markdown = generarCartaCobranza(rows[0], input.numero);
      return {
        honorarioId: input.id,
        numeroCarta: input.numero,
        markdown,
      };
    }),

  // ─── Cobranza: Resumen mensual ──────────────────────────────────
  resumenMensual: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const todos = await db
      .select()
      .from(honorarios)
      .where(eq(honorarios.userId, ctx.user.id));

    const now = new Date();
    const mesActual = now.getMonth();
    const anioActual = now.getFullYear();

    const mesAnterior = mesActual === 0 ? 11 : mesActual - 1;
    const anioMesAnterior = mesActual === 0 ? anioActual - 1 : anioActual;

    function esDelMes(
      h: (typeof todos)[number],
      mes: number,
      anio: number,
    ): boolean {
      const d = new Date(h.createdAt);
      return d.getMonth() === mes && d.getFullYear() === anio;
    }

    const actual = todos.filter((h) => esDelMes(h, mesActual, anioActual));
    const anterior = todos.filter((h) =>
      esDelMes(h, mesAnterior, anioMesAnterior),
    );

    const sumarizar = (arr: typeof todos) => ({
      total: arr.length,
      facturado: arr.reduce((a, h) => a + h.monto, 0),
      cobrado: arr.reduce((a, h) => a + (h.montoPagado || 0), 0),
      pendiente: arr.reduce(
        (a, h) => a + (h.monto - (h.montoPagado || 0)),
        0,
      ),
    });

    const resActual = sumarizar(actual);
    const resAnterior = sumarizar(anterior);

    return {
      mesActual: {
        label: `${anioActual}-${String(mesActual + 1).padStart(2, "0")}`,
        ...resActual,
      },
      mesAnterior: {
        label: `${anioMesAnterior}-${String(mesAnterior + 1).padStart(2, "0")}`,
        ...resAnterior,
      },
      variacion: {
        facturado: resActual.facturado - resAnterior.facturado,
        cobrado: resActual.cobrado - resAnterior.cobrado,
        pendiente: resActual.pendiente - resAnterior.pendiente,
      },
    };
  }),

  // ─── Cobranza: Aging report ─────────────────────────────────────
  aging: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const todos = await db
      .select()
      .from(honorarios)
      .where(eq(honorarios.userId, ctx.user.id));

    const pendientes = todos.filter(
      (h) => h.estado !== "pagado" && h.monto - (h.montoPagado || 0) > 0,
    );

    const buckets = [
      { label: "0-30 dias", min: 0, max: 30, count: 0, monto: 0 },
      { label: "31-60 dias", min: 31, max: 60, count: 0, monto: 0 },
      { label: "61-90 dias", min: 61, max: 90, count: 0, monto: 0 },
      { label: "90+ dias", min: 91, max: Infinity, count: 0, monto: 0 },
    ];

    for (const h of pendientes) {
      let dias = 0;
      if (h.fechaVencimiento) {
        const diff =
          new Date().getTime() - new Date(h.fechaVencimiento).getTime();
        dias = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
      }
      for (const b of buckets) {
        if (dias >= b.min && dias <= b.max) {
          b.count++;
          b.monto += h.monto - (h.montoPagado || 0);
          break;
        }
      }
    }

    return { buckets, totalPendientes: pendientes.length };
  }),
});
