import { getDb } from "../../../queries/connection";
import { causas, tareas, alertas, cronologia, notas } from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { sincronizarCausa } from "../../pjud/sync";
import type { ToolInput, AgentContext } from "../types";

export async function executeListarCausas(input: ToolInput, ctx: AgentContext): Promise<string> {
  const db = getDb();
  const { userId } = ctx;
  const limite = Number(input.limite) || 10;
  const busqueda = input.busqueda ? String(input.busqueda) : null;
  const estado = input.estado ? String(input.estado) : null;

  const conditions = [eq(causas.userId, userId)];
  if (estado) conditions.push(eq(causas.estado, estado as any));
  if (busqueda) {
    conditions.push(sql`(${causas.rit} ILIKE ${`%${busqueda}%`} OR ${causas.caratula} ILIKE ${`%${busqueda}%`} OR ${causas.tribunal} ILIKE ${`%${busqueda}%`})`);
  }

  const results = await db.select().from(causas).where(and(...conditions)).orderBy(desc(causas.createdAt)).limit(limite);

  return JSON.stringify({
    causas: results.map((c) => ({
      id: c.id, rit: c.rit, caratula: c.caratula, tribunal: c.tribunal,
      estado: c.estado, materia: c.materia, fechaIngreso: c.fechaIngreso,
    })),
    total: results.length,
  });
}

export async function executeAnalizarCausa(input: ToolInput, ctx: AgentContext): Promise<string> {
  const db = getDb();
  const { userId } = ctx;
  const causaId = input.causa_id ? Number(input.causa_id) : null;
  const ritBuscar = input.rit ? String(input.rit) : null;

  let causa: typeof causas.$inferSelect | null = null;

  if (causaId) {
    const r = await db.select().from(causas).where(and(eq(causas.id, causaId), eq(causas.userId, userId))).limit(1);
    causa = r[0] || null;
  } else if (ritBuscar) {
    const r = await db.select().from(causas).where(and(eq(causas.userId, userId), sql`${causas.rit} ILIKE ${`%${ritBuscar}%`}`)).limit(1);
    causa = r[0] || null;
  }

  if (!causa) {
    const recientes = await db.select().from(causas).where(eq(causas.userId, userId)).orderBy(desc(causas.createdAt)).limit(5);
    return JSON.stringify({
      error: "No se encontró la causa especificada",
      sugerencia: "Indica el ID o RIT de la causa",
      causasDisponibles: recientes.map((c) => ({ id: c.id, rit: c.rit, caratula: c.caratula })),
    });
  }

  const [tareasRelacionadas, alertasRelacionadas, historialCrono, notasCausa] = await Promise.all([
    db.select().from(tareas).where(and(eq(tareas.causaId, causa.id), eq(tareas.userId, userId))),
    db.select().from(alertas).where(and(eq(alertas.causaId, causa.id), eq(alertas.userId, userId))),
    db.select().from(cronologia).where(and(eq(cronologia.causaId, causa.id), eq(cronologia.userId, userId))).orderBy(desc(cronologia.fecha)).limit(10),
    db.select().from(notas).where(and(eq(notas.causaId, causa.id), eq(notas.userId, userId))).orderBy(desc(notas.createdAt)).limit(5),
  ]);

  const hoy = new Date();
  const tareasPendientes = tareasRelacionadas.filter((t) => t.estado === "pendiente" || t.estado === "en_progreso");
  const tareasVencidas = tareasPendientes.filter((t) => t.fechaVencimiento && new Date(t.fechaVencimiento) < hoy);
  const alertasPendientes = alertasRelacionadas.filter((a) => a.estado === "pendiente");

  let nivelRiesgo: "bajo" | "medio" | "alto" | "critico" = "bajo";
  const factoresRiesgo: string[] = [];

  if (tareasVencidas.length > 0) {
    nivelRiesgo = "alto";
    factoresRiesgo.push(`${tareasVencidas.length} tarea(s) con plazo vencido`);
  }
  if (alertasPendientes.length > 3) {
    nivelRiesgo = nivelRiesgo === "alto" ? "critico" : "alto";
    factoresRiesgo.push(`${alertasPendientes.length} alertas pendientes sin atender`);
  }
  if (causa.estado === "prueba" || causa.estado === "sentencia") {
    if (nivelRiesgo === "bajo") nivelRiesgo = "medio";
    factoresRiesgo.push(`Causa en etapa ${causa.estado} — requiere atención activa`);
  }
  if (!causa.fechaUltimoMovimiento) {
    factoresRiesgo.push("Sin fecha de último movimiento registrada");
  } else {
    const diasSinMov = Math.ceil((hoy.getTime() - new Date(causa.fechaUltimoMovimiento).getTime()) / (1000 * 60 * 60 * 24));
    if (diasSinMov > 30) {
      if (nivelRiesgo === "bajo") nivelRiesgo = "medio";
      factoresRiesgo.push(`${diasSinMov} días sin movimiento — posible abandono de procedimiento`);
    }
  }
  if (tareasPendientes.length === 0 && causa.estado !== "concluida" && causa.estado !== "archivada") {
    factoresRiesgo.push("No hay tareas pendientes asociadas a una causa activa — posible falta de seguimiento");
  }

  return JSON.stringify({
    causa: {
      id: causa.id,
      rit: causa.rit,
      ruc: causa.ruc,
      caratula: causa.caratula,
      tribunal: causa.tribunal,
      estado: causa.estado,
      etapa: causa.etapa,
      materia: causa.materia,
      fechaIngreso: causa.fechaIngreso,
      fechaUltimoMovimiento: causa.fechaUltimoMovimiento,
    },
    analisis: {
      nivelRiesgo,
      factoresRiesgo,
      tareasPendientes: tareasPendientes.length,
      tareasVencidas: tareasVencidas.length,
      alertasPendientes: alertasPendientes.length,
    },
    tareas: tareasPendientes.map((t) => ({
      id: t.id, titulo: t.titulo, vencimiento: t.fechaVencimiento,
      prioridad: t.prioridad, vencida: t.fechaVencimiento ? new Date(t.fechaVencimiento) < hoy : false,
    })),
    ultimoMovimiento: historialCrono.slice(0, 5).map((c) => ({
      fecha: c.fecha, tipo: c.tipo, titulo: c.titulo, descripcion: c.descripcion?.slice(0, 200),
    })),
    notas: notasCausa.map((n) => ({
      tipo: n.tipo, contenido: n.contenido.slice(0, 300), fecha: n.createdAt,
    })),
  });
}

export async function executeSincronizarCausa(input: ToolInput, ctx: AgentContext): Promise<string> {
  const causaId = Number(input.causa_id);
  const result = await sincronizarCausa(causaId, ctx.userId);
  return JSON.stringify(result);
}
