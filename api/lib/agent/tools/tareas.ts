import { getDb } from "../../../queries/connection";
import { tareas } from "@db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { ToolInput, AgentContext } from "../types";

export async function executeListarTareas(input: ToolInput, ctx: AgentContext): Promise<string> {
  const db = getDb();
  const { userId } = ctx;
  const estado = input.estado ? String(input.estado) : "pendiente";
  const limite = Number(input.limite) || 10;
  const results = await db.select().from(tareas)
    .where(and(eq(tareas.estado, estado as any), eq(tareas.userId, userId)))
    .orderBy(tareas.fechaVencimiento)
    .limit(limite);
  return JSON.stringify({
    tareas: results.map((t) => ({
      id: t.id, titulo: t.titulo, estado: t.estado, prioridad: t.prioridad,
      vencimiento: t.fechaVencimiento, tipo: t.tipo, descripcion: t.descripcion?.slice(0, 200),
    })),
    total: results.length,
  });
}

export async function executeCrearTarea(input: ToolInput, ctx: AgentContext): Promise<string> {
  const db = getDb();
  const { userId } = ctx;
  const titulo = String(input.titulo);
  const values: Record<string, unknown> = {
    userId,
    titulo,
    descripcion: input.descripcion ? String(input.descripcion) : null,
    prioridad: (input.prioridad as any) || "media",
    tipo: (input.tipo as any) || "otra",
  };
  if (input.fechaVencimiento) values.fechaVencimiento = new Date(String(input.fechaVencimiento));
  if (input.causaId) values.causaId = Number(input.causaId);
  const [row] = await db.insert(tareas).values(values as any).returning({ id: tareas.id });
  return JSON.stringify({ ok: true, mensaje: `Tarea "${titulo}" creada exitosamente`, id: row.id });
}

export async function executePlazosVencidos(input: ToolInput, ctx: AgentContext): Promise<string> {
  const db = getDb();
  const { userId } = ctx;
  const hoy = new Date().toISOString().split("T")[0];
  const vencidos = await db.select().from(tareas)
    .where(and(
      eq(tareas.userId, userId),
      sql`${tareas.estado} IN ('pendiente', 'en_progreso')`,
      sql`${tareas.fechaVencimiento} < ${hoy}`
    ))
    .limit(20);
  return JSON.stringify({
    vencidos: vencidos.map((t) => ({
      id: t.id, titulo: t.titulo, vencimiento: t.fechaVencimiento, prioridad: t.prioridad,
    })),
    total: vencidos.length,
    fechaHoy: hoy,
  });
}
