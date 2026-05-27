import { getDb } from "../../../queries/connection";
import { alertas } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";
import type { ToolInput, AgentContext } from "../types";

export async function executeListarAlertas(input: ToolInput, ctx: AgentContext): Promise<string> {
  const db = getDb();
  const { userId } = ctx;
  const limite = Number(input.limite) || 10;
  const results = await db.select().from(alertas)
    .where(and(eq(alertas.estado, "pendiente"), eq(alertas.userId, userId)))
    .orderBy(desc(alertas.prioridad))
    .limit(limite);
  return JSON.stringify({
    alertas: results.map((a) => ({
      id: a.id, titulo: a.titulo, tipo: a.tipo, prioridad: a.prioridad,
      fechaVencimiento: a.fechaVencimiento,
    })),
    total: results.length,
  });
}
