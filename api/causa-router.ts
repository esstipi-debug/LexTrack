import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { causas, tareas, alertas, cronologia, notas, honorarios } from "@db/schema";
import { eq, desc, sql, and } from "drizzle-orm";

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
      const { fechaIngreso, ...rest } = input;
      const values = {
        ...rest,
        ...(fechaIngreso ? { fechaIngreso: new Date(fechaIngreso) } : {}),
      };
      await db.insert(causas).values(values as typeof causas.$inferInsert);
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
      const cronologiaCausa = await db.select().from(cronologia).where(eq(cronologia.causaId, input.id)).orderBy(desc(cronologia.fecha));
      const notasCausa = await db.select().from(notas).where(eq(notas.causaId, input.id)).orderBy(desc(notas.createdAt));
      const honorariosCausa = await db.select().from(honorarios).where(eq(honorarios.causaId, input.id));
      return {
        ...causa[0],
        tareas: tareasCausa,
        alertas: alertasCausa,
        cronologia: cronologiaCausa,
        notas: notasCausa,
        honorarios: honorariosCausa,
      };
    }),

  actualizar: publicQuery
    .input(
      z.object({
        id: z.number(),
        datos: z.object({
          rit: z.string().optional(),
          ruc: z.string().optional(),
          rol: z.string().optional(),
          caratula: z.string().optional(),
          tribunal: z.string().optional(),
          comuna: z.string().optional(),
          region: z.string().optional(),
          materia: z.string().optional(),
          estado: z.string().optional(),
          etapa: z.string().optional(),
          fechaIngreso: z.string().optional(),
          fechaUltimoMovimiento: z.string().optional(),
          litigantes: z.string().optional(),
          abogadoDemandante: z.string().optional(),
          abogadoDemandado: z.string().optional(),
          estaMonitoreando: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { fechaIngreso, fechaUltimoMovimiento, ...rest } = input.datos;
      const updateData: Record<string, unknown> = { ...rest };
      if (fechaIngreso) updateData.fechaIngreso = new Date(fechaIngreso);
      if (fechaUltimoMovimiento) updateData.fechaUltimoMovimiento = new Date(fechaUltimoMovimiento);
      await db.update(causas).set(updateData as Partial<typeof causas.$inferInsert>).where(eq(causas.id, input.id));
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

  analisis: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const causa = await db.select().from(causas).where(eq(causas.id, input.id)).limit(1);
      if (causa.length === 0) {
        return { error: "Causa no encontrada" };
      }
      const c = causa[0];
      const tareasCausa = await db.select().from(tareas).where(eq(tareas.causaId, input.id));
      const alertasCausa = await db.select().from(alertas).where(eq(alertas.causaId, input.id));
      const cronologiaCausa = await db.select().from(cronologia).where(eq(cronologia.causaId, input.id)).orderBy(desc(cronologia.fecha));

      const hoy = new Date();
      const hoyStr = hoy.toISOString().split("T")[0];

      // Risk factors
      const factoresRiesgo: string[] = [];

      // Overdue tasks
      const tareasVencidas = tareasCausa.filter(
        (t) => t.estado !== "completada" && t.estado !== "cancelada" && t.fechaVencimiento && String(t.fechaVencimiento) < hoyStr
      );
      if (tareasVencidas.length > 0) {
        factoresRiesgo.push(`${tareasVencidas.length} tarea(s) vencida(s) sin completar`);
      }

      // Pending alerts
      const alertasPendientes = alertasCausa.filter((a) => a.estado === "pendiente");
      if (alertasPendientes.length > 0) {
        factoresRiesgo.push(`${alertasPendientes.length} alerta(s) pendiente(s) sin revisar`);
      }

      // Critical priority alerts
      const alertasCriticas = alertasCausa.filter((a) => a.estado === "pendiente" && a.prioridad === "critica");
      if (alertasCriticas.length > 0) {
        factoresRiesgo.push(`${alertasCriticas.length} alerta(s) de prioridad critica`);
      }

      // Days without movement
      let diasSinMovimiento = 0;
      if (cronologiaCausa.length > 0) {
        const ultimoMov = new Date(String(cronologiaCausa[0].fecha));
        diasSinMovimiento = Math.floor((hoy.getTime() - ultimoMov.getTime()) / (1000 * 60 * 60 * 24));
        if (diasSinMovimiento > 30) {
          factoresRiesgo.push(`${diasSinMovimiento} dias sin movimiento en la causa`);
        }
      } else if (c.fechaIngreso) {
        const fechaIng = new Date(String(c.fechaIngreso));
        diasSinMovimiento = Math.floor((hoy.getTime() - fechaIng.getTime()) / (1000 * 60 * 60 * 24));
        if (diasSinMovimiento > 14) {
          factoresRiesgo.push(`${diasSinMovimiento} dias desde el ingreso sin movimientos registrados`);
        }
      }

      // Missing follow-up: active tasks without recent progress
      const tareasPendientes = tareasCausa.filter(
        (t) => t.estado === "pendiente" || t.estado === "en_progreso"
      );
      if (tareasPendientes.length === 0 && c.estado !== "concluida" && c.estado !== "archivada") {
        factoresRiesgo.push("No hay tareas activas de seguimiento para esta causa");
      }

      // Calculate risk level
      let nivelRiesgo: "bajo" | "medio" | "alto" | "critico" = "bajo";
      if (factoresRiesgo.length >= 4 || alertasCriticas.length >= 2 || tareasVencidas.length >= 3) {
        nivelRiesgo = "critico";
      } else if (factoresRiesgo.length >= 3 || tareasVencidas.length >= 2 || diasSinMovimiento > 60) {
        nivelRiesgo = "alto";
      } else if (factoresRiesgo.length >= 1 || diasSinMovimiento > 30) {
        nivelRiesgo = "medio";
      }

      // Upcoming deadlines
      const proximosPlazos = tareasCausa
        .filter(
          (t) =>
            t.estado !== "completada" &&
            t.estado !== "cancelada" &&
            t.fechaVencimiento &&
            String(t.fechaVencimiento) >= hoyStr
        )
        .sort((a, b) => String(a.fechaVencimiento).localeCompare(String(b.fechaVencimiento)))
        .slice(0, 5)
        .map((t) => ({
          id: t.id,
          titulo: t.titulo,
          fechaVencimiento: t.fechaVencimiento,
          prioridad: t.prioridad,
          tipo: t.tipo,
        }));

      // Recommendations based on case state and stage
      const recomendaciones: string[] = [];

      if (tareasVencidas.length > 0) {
        recomendaciones.push("Revisar y actualizar las tareas vencidas urgentemente");
      }
      if (alertasPendientes.length > 0) {
        recomendaciones.push("Revisar las alertas pendientes y tomar accion");
      }
      if (diasSinMovimiento > 30) {
        recomendaciones.push("Realizar seguimiento con el tribunal, hay muchos dias sin movimiento");
      }
      if (tareasPendientes.length === 0 && c.estado !== "concluida" && c.estado !== "archivada") {
        recomendaciones.push("Crear tareas de seguimiento para mantener el avance de la causa");
      }

      // Stage-specific recommendations
      switch (c.estado) {
        case "tramitacion":
          recomendaciones.push("Verificar que la demanda fue notificada correctamente");
          recomendaciones.push("Preparar contestacion o replica si corresponde");
          break;
        case "notificacion":
          recomendaciones.push("Confirmar notificacion valida a todas las partes");
          recomendaciones.push("Preparar documentos para la siguiente etapa procesal");
          break;
        case "prueba":
          recomendaciones.push("Verificar que toda la prueba fue ofrecida oportunamente");
          recomendaciones.push("Preparar testigos y prueba documental para audiencia");
          break;
        case "sentencia":
          recomendaciones.push("Evaluar posibles recursos (reposicion, apelacion, nulidad)");
          recomendaciones.push("Notificar al cliente sobre el resultado");
          break;
        case "ejecucion":
          recomendaciones.push("Verificar cumplimiento de la sentencia");
          recomendaciones.push("Iniciar procedimiento de cobro si es necesario");
          break;
      }

      return {
        nivelRiesgo,
        factoresRiesgo,
        proximosPlazos,
        recomendaciones,
        estadisticas: {
          totalTareas: tareasCausa.length,
          tareasPendientes: tareasPendientes.length,
          tareasVencidas: tareasVencidas.length,
          tareasCompletadas: tareasCausa.filter((t) => t.estado === "completada").length,
          totalAlertas: alertasCausa.length,
          alertasPendientes: alertasPendientes.length,
          totalMovimientos: cronologiaCausa.length,
          diasSinMovimiento,
        },
      };
    }),

  timeline: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      // Get cronologia entries
      const cronologiaItems = await db
        .select()
        .from(cronologia)
        .where(eq(cronologia.causaId, input.id))
        .orderBy(desc(cronologia.fecha));

      // Get completed tasks
      const tareasCompletadas = await db
        .select()
        .from(tareas)
        .where(
          and(
            eq(tareas.causaId, input.id),
            eq(tareas.estado, "completada")
          )
        );

      // Get alert events
      const alertasItems = await db
        .select()
        .from(alertas)
        .where(eq(alertas.causaId, input.id));

      // Combine into unified timeline
      type TimelineEvent = {
        id: number;
        fecha: string;
        tipo: string;
        categoria: "cronologia" | "tarea" | "alerta";
        titulo: string;
        descripcion: string | null;
        metadata?: Record<string, unknown>;
      };

      const events: TimelineEvent[] = [];

      for (const item of cronologiaItems) {
        events.push({
          id: item.id,
          fecha: String(item.fecha),
          tipo: item.tipo,
          categoria: "cronologia",
          titulo: item.titulo,
          descripcion: item.descripcion,
          metadata: { actor: item.actor, hora: item.hora },
        });
      }

      for (const t of tareasCompletadas) {
        const fecha = t.fechaCompletada
          ? new Date(t.fechaCompletada).toISOString().split("T")[0]
          : new Date(t.updatedAt).toISOString().split("T")[0];
        events.push({
          id: t.id,
          fecha,
          tipo: t.tipo,
          categoria: "tarea",
          titulo: `Tarea completada: ${t.titulo}`,
          descripcion: t.descripcion,
          metadata: { prioridad: t.prioridad, asignadoA: t.asignadoA },
        });
      }

      for (const a of alertasItems) {
        const fecha = a.fechaEvento
          ? String(a.fechaEvento)
          : new Date(a.createdAt).toISOString().split("T")[0];
        events.push({
          id: a.id,
          fecha,
          tipo: a.tipo,
          categoria: "alerta",
          titulo: a.titulo,
          descripcion: a.descripcion,
          metadata: { prioridad: a.prioridad, estado: a.estado },
        });
      }

      // Sort by date descending
      events.sort((a, b) => b.fecha.localeCompare(a.fecha));

      return events;
    }),
});
