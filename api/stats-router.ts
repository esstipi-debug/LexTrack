import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  causas,
  tareas,
  alertas,
  honorarios,
  leykarinDenuncias,
  actividadReciente,
} from "@db/schema";
import { sql, and } from "drizzle-orm";

export const statsRouter = createRouter({
  dashboard: publicQuery.query(async () => {
    const db = getDb();
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split("T")[0];

    // ── Mes actual y anterior ───────────────────────────────────────
    const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      .toISOString()
      .split("T")[0];
    const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
      .toISOString()
      .split("T")[0];

    const en7dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // ── Causas ──────────────────────────────────────────────────────
    const todasCausas = await db.select().from(causas);
    const estadosCausas = ["tramitacion", "notificacion", "prueba", "sentencia", "ejecucion", "concluida", "archivada"] as const;
    const porEstadoCausa: Record<string, number> = {};
    for (const estado of estadosCausas) porEstadoCausa[estado] = 0;
    const materiasCausas: Record<string, number> = {};
    let causasActivas = 0;

    for (const c of todasCausas) {
      porEstadoCausa[c.estado] = (porEstadoCausa[c.estado] ?? 0) + 1;
      materiasCausas[c.materia] = (materiasCausas[c.materia] ?? 0) + 1;
      if (c.estado !== "concluida" && c.estado !== "archivada") causasActivas += 1;
    }

    const causasEsteMes = todasCausas.filter(
      (c) => c.createdAt >= new Date(inicioMesActual)
    ).length;
    const causasMesAnterior = todasCausas.filter(
      (c) =>
        c.createdAt >= new Date(inicioMesAnterior) &&
        c.createdAt <= new Date(finMesAnterior)
    ).length;

    // ── Tareas ──────────────────────────────────────────────────────
    const todasTareas = await db.select().from(tareas);
    let tareasPendientes = 0;
    let tareasVencidas = 0;
    let tareasCompletadasEsteMes = 0;
    let tareasCompletadasMesAnterior = 0;
    let tareasProximas7dias = 0;

    for (const t of todasTareas) {
      if (t.estado === "pendiente") tareasPendientes += 1;
      if (
        (t.estado === "pendiente" || t.estado === "en_progreso") &&
        t.fechaVencimiento &&
        t.fechaVencimiento < new Date(hoyStr)
      ) {
        tareasVencidas += 1;
      }
      if (t.estado === "completada" && t.fechaCompletada) {
        if (t.fechaCompletada >= new Date(inicioMesActual)) {
          tareasCompletadasEsteMes += 1;
        } else if (
          t.fechaCompletada >= new Date(inicioMesAnterior) &&
          t.fechaCompletada <= new Date(finMesAnterior)
        ) {
          tareasCompletadasMesAnterior += 1;
        }
      }
      if (
        (t.estado === "pendiente" || t.estado === "en_progreso") &&
        t.fechaVencimiento &&
        t.fechaVencimiento >= new Date(hoyStr) &&
        t.fechaVencimiento <= new Date(en7dias)
      ) {
        tareasProximas7dias += 1;
      }
    }

    // ── Alertas ──────────────────────────────────────────────────────
    const todasAlertas = await db.select().from(alertas);
    const porTipoAlerta: Record<string, number> = {};
    const porPrioridadAlerta: Record<string, number> = {};
    let alertasPendientes = 0;

    for (const a of todasAlertas) {
      if (a.estado === "pendiente") {
        alertasPendientes += 1;
        porTipoAlerta[a.tipo] = (porTipoAlerta[a.tipo] ?? 0) + 1;
        porPrioridadAlerta[a.prioridad] = (porPrioridadAlerta[a.prioridad] ?? 0) + 1;
      }
    }

    // ── Honorarios ───────────────────────────────────────────────────
    const todosHonorarios = await db.select().from(honorarios);
    let totalFacturado = 0;
    let totalPagado = 0;
    let morosidad = 0;

    for (const h of todosHonorarios) {
      totalFacturado += h.monto;
      totalPagado += h.montoPagado ?? 0;
      if (h.estado === "vencido" || h.estado === "moroso" || h.estado === "cobranza") {
        morosidad += h.monto - (h.montoPagado ?? 0);
      }
    }

    const porCobrar = totalFacturado - totalPagado;

    // ── Ley Karin ────────────────────────────────────────────────────
    const todasDenuncias = await db.select().from(leykarinDenuncias);
    let leyKarinActivas = 0;
    let leyKarinUrgentes = 0;

    for (const d of todasDenuncias) {
      const activa =
        d.estado !== "archivada" && d.estado !== "concluida";
      if (activa) {
        leyKarinActivas += 1;
        if (d.fechaPlazo) {
          const diasRestantes = Math.ceil(
            (new Date(d.fechaPlazo).getTime() - hoy.getTime()) /
              (1000 * 60 * 60 * 24)
          );
          if (diasRestantes < 5) leyKarinUrgentes += 1;
        }
      }
    }

    // ── Actividad reciente ────────────────────────────────────────────
    const ultimaActividad = await db
      .select()
      .from(actividadReciente)
      .orderBy(sql`${actividadReciente.createdAt} DESC`)
      .limit(5);

    return {
      causas: {
        total: todasCausas.length,
        activas: causasActivas,
        porEstado: porEstadoCausa,
        porMateria: materiasCausas,
      },
      tareas: {
        total: todasTareas.length,
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
        total: todasDenuncias.length,
        activas: leyKarinActivas,
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
