import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { tareas, causas } from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

const tipoEnum = z.enum([
  "revision_documento",
  "preparar_escrito",
  "seguimiento_causa",
  "revisar_resolucion",
  "notificar_cliente",
  "agendar_audiencia",
  "investigar_norma",
  "checklist_despido",
  "checklist_finiquito",
  "revisar_diario_oficial",
  "otra",
]);

const estadoEnum = z.enum(["pendiente", "en_progreso", "completada", "cancelada"]);
const prioridadEnum = z.enum(["baja", "media", "alta", "critica"]);

export const tareaRouter = createRouter({
  listar: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(tareas).orderBy(desc(tareas.createdAt));
  }),

  obtener: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const tarea = await db
        .select()
        .from(tareas)
        .where(eq(tareas.id, input.id))
        .limit(1);
      if (tarea.length === 0) return null;
      let causa = null;
      if (tarea[0].causaId) {
        const causaResult = await db
          .select()
          .from(causas)
          .where(eq(causas.id, tarea[0].causaId))
          .limit(1);
        causa = causaResult[0] ?? null;
      }
      return { ...tarea[0], causa };
    }),

  crear: authedQuery
    .input(
      z.object({
        titulo: z.string(),
        descripcion: z.string().optional(),
        tipo: tipoEnum.default("otra"),
        prioridad: prioridadEnum.default("media"),
        fechaVencimiento: z.string().optional(),
        causaId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db
        .insert(tareas)
        .values({
          titulo: input.titulo,
          descripcion: input.descripcion ?? null,
          tipo: input.tipo,
          prioridad: input.prioridad,
          causaId: input.causaId ?? null,
          fechaVencimiento: input.fechaVencimiento
            ? new Date(input.fechaVencimiento)
            : null,
        })
        .$returningId();
      return result;
    }),

  actualizar: authedQuery
    .input(
      z.object({
        id: z.number(),
        titulo: z.string().optional(),
        descripcion: z.string().optional(),
        estado: estadoEnum.optional(),
        prioridad: prioridadEnum.optional(),
        fechaVencimiento: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...fields } = input;
      const update: Record<string, unknown> = {};
      if (fields.titulo !== undefined) update.titulo = fields.titulo;
      if (fields.descripcion !== undefined)
        update.descripcion = fields.descripcion;
      if (fields.estado !== undefined) update.estado = fields.estado;
      if (fields.prioridad !== undefined) update.prioridad = fields.prioridad;
      if (fields.fechaVencimiento !== undefined) {
        update.fechaVencimiento = fields.fechaVencimiento
          ? new Date(fields.fechaVencimiento)
          : null;
      }
      await db.update(tareas).set(update).where(eq(tareas.id, id));
      return { ok: true };
    }),

  completar: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(tareas)
        .set({
          estado: "completada",
          fechaCompletada: new Date(),
        })
        .where(eq(tareas.id, input.id));
      return { ok: true };
    }),

  eliminar: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(tareas).where(eq(tareas.id, input.id));
      return { ok: true };
    }),

  porCausa: authedQuery
    .input(z.object({ causaId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(tareas)
        .where(eq(tareas.causaId, input.causaId))
        .orderBy(desc(tareas.createdAt));
    }),

  resumenSemanal: authedQuery.query(async () => {
    const db = getDb();
    const hoy = new Date();
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay() + 1);
    inicioSemana.setHours(0, 0, 0, 0);
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);
    finSemana.setHours(23, 59, 59, 999);

    const hoyStr = hoy.toISOString().split("T")[0];
    const inicioStr = inicioSemana.toISOString().split("T")[0];
    const finStr = finSemana.toISOString().split("T")[0];

    const vencenEstaSemana = await db
      .select()
      .from(tareas)
      .where(
        and(
          sql`${tareas.estado} IN ('pendiente', 'en_progreso')`,
          sql`${tareas.fechaVencimiento} >= ${inicioStr}`,
          sql`${tareas.fechaVencimiento} <= ${finStr}`
        )
      )
      .orderBy(tareas.fechaVencimiento);

    const vencidas = await db
      .select()
      .from(tareas)
      .where(
        and(
          sql`${tareas.estado} IN ('pendiente', 'en_progreso')`,
          sql`${tareas.fechaVencimiento} < ${hoyStr}`
        )
      )
      .orderBy(tareas.fechaVencimiento);

    const completadasEstaSemana = await db
      .select()
      .from(tareas)
      .where(
        and(
          eq(tareas.estado, "completada"),
          sql`${tareas.fechaCompletada} >= ${inicioSemana.toISOString()}`,
          sql`${tareas.fechaCompletada} <= ${finSemana.toISOString()}`
        )
      )
      .orderBy(desc(tareas.fechaCompletada));

    return {
      vencenEstaSemana,
      vencidas,
      completadasEstaSemana,
    };
  }),

  actualizarEstado: authedQuery
    .input(z.object({ id: z.number(), estado: estadoEnum }))
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
