import { getDb } from "../../../queries/connection";
import { causas, tareas, alertas, honorarios } from "@db/schema";
import { eq } from "drizzle-orm";
import type { ToolInput, AgentContext } from "../types";

export async function executeEstadisticas(_input: ToolInput, ctx: AgentContext): Promise<string> {
  const db = getDb();
  const { userId } = ctx;
  const [allCausas, allTareas, allAlertas, allHonorarios] = await Promise.all([
    db.select().from(causas).where(eq(causas.userId, userId)),
    db.select().from(tareas).where(eq(tareas.userId, userId)),
    db.select().from(alertas).where(eq(alertas.userId, userId)),
    db.select().from(honorarios).where(eq(honorarios.userId, userId)),
  ]);
  const causasActivas = allCausas.filter((c) => c.estado !== "concluida" && c.estado !== "archivada").length;
  const tareasPendientes = allTareas.filter((t) => t.estado === "pendiente").length;
  const alertasPendientes = allAlertas.filter((a) => a.estado === "pendiente").length;
  const totalFacturado = allHonorarios.reduce((s, h) => s + h.monto, 0);
  const totalPagado = allHonorarios.reduce((s, h) => s + (h.montoPagado || 0), 0);

  return JSON.stringify({
    causas: { total: allCausas.length, activas: causasActivas },
    tareas: { total: allTareas.length, pendientes: tareasPendientes },
    alertas: { total: allAlertas.length, pendientes: alertasPendientes },
    cobranza: { facturado: totalFacturado, pagado: totalPagado, porCobrar: totalFacturado - totalPagado },
  });
}
