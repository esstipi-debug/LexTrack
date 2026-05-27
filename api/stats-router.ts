import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  causas,
  tareas,
  alertas,
  honorarios,
  leykarinDenuncias,
  actividadReciente,
} from "@db/schema";
import { eq, sql, count, sum, and, gte, lte, lt } from "drizzle-orm";
import { getUserOrgIds, visibleToUserCondition } from "./lib/org-scope";

export const statsRouter = createRouter({
  dashboard: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split("T")[0];

    // ── Org scope ────────────────────────────────────────────────────
    const orgIds = await getUserOrgIds(userId);

    // ── Mes actual y anterior ───────────────────────────────────────
    const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    const en7dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);

    // ── Causas: SQL aggregations ─────────────────────────────────────
    const [causasTotalRow] = await db
      .select({ total: count() })
      .from(causas)
      .where(visibleToUserCondition(causas.userId, causas.orgId, userId, orgIds));

    const causasPorEstado = await db
      .select({ estado: causas.estado, total: count() })
      .from(causas)
      .where(visibleToUserCondition(causas.userId, causas.orgId, userId, orgIds))
      .groupBy(causas.estado);

    const causasPorMateria = await db
      .select({ materia: causas.materia, total: count() })
      .from(causas)
      .where(visibleToUserCondition(causas.userId, causas.orgId, userId, orgIds))
      .groupBy(causas.materia);

    const estadosCausas = ["tramitacion", "notificacion", "prueba", "sentencia", "ejecucion", "concluida", "archivada"] as const;
    const porEstadoCausa: Record<string, number> = {};
    for (const estado of estadosCausas) porEstadoCausa[estado] = 0;
    let causasActivas = 0;
    for (const row of causasPorEstado) {
      porEstadoCausa[row.estado] = row.total;
      if (row.estado !== "concluida" && row.estado !== "archivada") causasActivas += row.total;
    }

    const materiasCausas: Record<string, number> = {};
    for (const row of causasPorMateria) {
      materiasCausas[row.materia] = row.total;
    }

    const [causasEsteMesRow] = await db
      .select({ total: count() })
      .from(causas)
      .where(and(visibleToUserCondition(causas.userId, causas.orgId, userId, orgIds), gte(causas.createdAt, inicioMesActual)));

    const [causasMesAnteriorRow] = await db
      .select({ total: count() })
      .from(causas)
      .where(
        and(
          visibleToUserCondition(causas.userId, causas.orgId, userId, orgIds),
          gte(causas.createdAt, inicioMesAnterior),
          lte(causas.createdAt, finMesAnterior),
        )
      );

    const causasEsteMes = causasEsteMesRow?.total ?? 0;
    const causasMesAnterior = causasMesAnteriorRow?.total ?? 0;

    // ── Tareas: SQL aggregations ─────────────────────────────────────
    const [tareasTotalRow] = await db
      .select({ total: count() })
      .from(tareas)
      .where(visibleToUserCondition(tareas.userId, tareas.orgId, userId, orgIds));

    const [tareasPendientesRow] = await db
      .select({ total: count() })
      .from(tareas)
      .where(and(visibleToUserCondition(tareas.userId, tareas.orgId, userId, orgIds), eq(tareas.estado, "pendiente")));

    const [tareasVencidasRow] = await db
      .select({ total: count() })
      .from(tareas)
      .where(
        and(
          visibleToUserCondition(tareas.userId, tareas.orgId, userId, orgIds),
          sql`${tareas.estado} IN ('pendiente', 'en_progreso')`,
          sql`${tareas.fechaVencimiento} IS NOT NULL`,
          lt(tareas.fechaVencimiento, new Date(hoyStr)),
        )
      );

    const [tareasCompletadasEsteMesRow] = await db
      .select({ total: count() })
      .from(tareas)
      .where(
        and(
          visibleToUserCondition(tareas.userId, tareas.orgId, userId, orgIds),
          eq(tareas.estado, "completada"),
          sql`${tareas.fechaCompletada} IS NOT NULL`,
          gte(tareas.fechaCompletada, inicioMesActual),
        )
      );

    const [tareasCompletadasMesAnteriorRow] = await db
      .select({ total: count() })
      .from(tareas)
      .where(
        and(
          visibleToUserCondition(tareas.userId, tareas.orgId, userId, orgIds),
          eq(tareas.estado, "completada"),
          sql`${tareas.fechaCompletada} IS NOT NULL`,
          gte(tareas.fechaCompletada, inicioMesAnterior),
          lte(tareas.fechaCompletada, finMesAnterior),
        )
      );

    const [tareasProximas7diasRow] = await db
      .select({ total: count() })
      .from(tareas)
      .where(
        and(
          visibleToUserCondition(tareas.userId, tareas.orgId, userId, orgIds),
          sql`${tareas.estado} IN ('pendiente', 'en_progreso')`,
          sql`${tareas.fechaVencimiento} IS NOT NULL`,
          gte(tareas.fechaVencimiento, new Date(hoyStr)),
          lte(tareas.fechaVencimiento, en7dias),
        )
      );

    const tareasPendientes = tareasPendientesRow?.total ?? 0;
    const tareasVencidas = tareasVencidasRow?.total ?? 0;
    const tareasCompletadasEsteMes = tareasCompletadasEsteMesRow?.total ?? 0;
    const tareasCompletadasMesAnterior = tareasCompletadasMesAnteriorRow?.total ?? 0;
    const tareasProximas7dias = tareasProximas7diasRow?.total ?? 0;

    // ── Alertas: SQL aggregations ────────────────────────────────────
    const [alertasPendientesRow] = await db
      .select({ total: count() })
      .from(alertas)
      .where(and(visibleToUserCondition(alertas.userId, alertas.orgId, userId, orgIds), eq(alertas.estado, "pendiente")));

    const alertasPorTipo = await db
      .select({ tipo: alertas.tipo, total: count() })
      .from(alertas)
      .where(and(visibleToUserCondition(alertas.userId, alertas.orgId, userId, orgIds), eq(alertas.estado, "pendiente")))
      .groupBy(alertas.tipo);

    const alertasPorPrioridad = await db
      .select({ prioridad: alertas.prioridad, total: count() })
      .from(alertas)
      .where(and(visibleToUserCondition(alertas.userId, alertas.orgId, userId, orgIds), eq(alertas.estado, "pendiente")))
      .groupBy(alertas.prioridad);

    const alertasPendientes = alertasPendientesRow?.total ?? 0;
    const porTipoAlerta: Record<string, number> = {};
    for (const row of alertasPorTipo) porTipoAlerta[row.tipo] = row.total;
    const porPrioridadAlerta: Record<string, number> = {};
    for (const row of alertasPorPrioridad) porPrioridadAlerta[row.prioridad] = row.total;

    // ── Honorarios: SQL aggregations ─────────────────────────────────
    const [honorariosSumsRow] = await db
      .select({
        totalFacturado: sum(honorarios.monto),
        totalPagado: sum(honorarios.montoPagado),
      })
      .from(honorarios)
      .where(visibleToUserCondition(honorarios.userId, honorarios.orgId, userId, orgIds));

    const morosidadRows = await db
      .select({ monto: honorarios.monto, montoPagado: honorarios.montoPagado })
      .from(honorarios)
      .where(
        and(
          visibleToUserCondition(honorarios.userId, honorarios.orgId, userId, orgIds),
          sql`${honorarios.estado} IN ('vencido', 'moroso', 'cobranza')`,
        )
      );

    const totalFacturado = Number(honorariosSumsRow?.totalFacturado ?? 0);
    const totalPagado = Number(honorariosSumsRow?.totalPagado ?? 0);
    const porCobrar = totalFacturado - totalPagado;
    let morosidad = 0;
    for (const h of morosidadRows) {
      morosidad += h.monto - (h.montoPagado ?? 0);
    }

    // ── Ley Karin ─────────────────────────────────────────────────────
    // Urgentes requires per-row date arithmetic — load only active denuncias
    const [leyKarinTotalRow] = await db
      .select({ total: count() })
      .from(leykarinDenuncias)
      .where(visibleToUserCondition(leykarinDenuncias.userId, leykarinDenuncias.orgId, userId, orgIds));

    const activasDenuncias = await db
      .select({ fechaPlazo: leykarinDenuncias.fechaPlazo })
      .from(leykarinDenuncias)
      .where(
        and(
          visibleToUserCondition(leykarinDenuncias.userId, leykarinDenuncias.orgId, userId, orgIds),
          sql`${leykarinDenuncias.estado} NOT IN ('archivada', 'concluida')`,
        )
      );

    let leyKarinUrgentes = 0;
    for (const d of activasDenuncias) {
      if (d.fechaPlazo) {
        const diasRestantes = Math.ceil(
          (new Date(d.fechaPlazo).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diasRestantes < 5) leyKarinUrgentes += 1;
      }
    }

    // ── Actividad reciente ────────────────────────────────────────────
    const ultimaActividad = await db
      .select()
      .from(actividadReciente)
      .where(eq(actividadReciente.userId, userId))
      .orderBy(sql`${actividadReciente.createdAt} DESC`)
      .limit(5);

    return {
      causas: {
        total: causasTotalRow?.total ?? 0,
        activas: causasActivas,
        porEstado: porEstadoCausa,
        porMateria: materiasCausas,
      },
      tareas: {
        total: tareasTotalRow?.total ?? 0,
        pendientes: tareasPendientes,
        vencidas: tareasVencidas,
        completadasEsteMes: tareasCompletadasEsteMes,
        proximas7dias: tareasProximas7dias,
      },
      alertas: {
        pendientes: alertasPendientes,
        porTipo: porTipoAlerta,
        porPrioridad: porPrioridadAlerta,
      },
      honorarios: {
        totalFacturado,
        totalPagado,
        porCobrar,
        morosidad,
      },
      leyKarin: {
        total: leyKarinTotalRow?.total ?? 0,
        activas: activasDenuncias.length,
        urgentes: leyKarinUrgentes,
      },
      tendencias: {
        causasEsteMes,
        causasMesAnterior,
        tareasCompletadasEsteMes,
        tareasCompletadasMesAnterior,
      },
      actividadReciente: ultimaActividad,
    };
  }),
});
