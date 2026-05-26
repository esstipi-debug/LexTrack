import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { alertas } from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

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
  listar: publicQuery.query(async () => {
    const db = getDb();
    return db
      .select()
      .from(alertas)
      .orderBy(
        sql`FIELD(${alertas.prioridad}, 'critica', 'alta', 'media', 'baja')`,
        desc(alertas.createdAt)
      );
  }),

  obtener: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(alertas)
        .where(eq(alertas.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),

  crear: publicQuery
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
    .mutation(async ({ input }) => {
      const db = getDb();
      const values: Record<string, unknown> = {
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

  marcarLeida: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(alertas)
        .set({ estado: "leida", leidaAt: new Date() })
        .where(and(eq(alertas.id, input.id), eq(alertas.estado, "pendiente")));
      return { ok: true };
    }),

  marcarTodasLeidas: publicQuery.mutation(async () => {
    const db = getDb();
    await db
      .update(alertas)
      .set({ estado: "leida", leidaAt: new Date() })
      .where(eq(alertas.estado, "pendiente"));
    return { ok: true };
  }),

  archivar: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(alertas)
        .set({ estado: "archivada" })
        .where(eq(alertas.id, input.id));
      return { ok: true };
    }),

  dashboard: publicQuery.query(async () => {
    const db = getDb();

    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    const hoyFin = new Date();
    hoyFin.setHours(23, 59, 59, 999);

    const [totalPendientes, totalLeidasHoy, porTipo, porPrioridad, totalArchivadas] =
      await Promise.all([
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(alertas)
          .where(eq(alertas.estado, "pendiente")),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(alertas)
          .where(
            and(
              eq(alertas.estado, "leida"),
              sql`${alertas.leidaAt} >= ${hoyInicio} AND ${alertas.leidaAt} <= ${hoyFin}`
            )
          ),
        db
          .select({ tipo: alertas.tipo, count: sql<number>`COUNT(*)` })
          .from(alertas)
          .groupBy(alertas.tipo),
        db
          .select({ prioridad: alertas.prioridad, count: sql<number>`COUNT(*)` })
          .from(alertas)
          .groupBy(alertas.prioridad),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(alertas)
          .where(eq(alertas.estado, "archivada")),
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

  porCausa: publicQuery
    .input(z.object({ causaId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(alertas)
        .where(eq(alertas.causaId, input.causaId))
        .orderBy(
          sql`FIELD(${alertas.prioridad}, 'critica', 'alta', 'media', 'baja')`,
          desc(alertas.createdAt)
        );
    }),
});
