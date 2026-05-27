import { getDb } from "../../../queries/connection";
import { diarioOficialNormas } from "@db/schema";
import { desc } from "drizzle-orm";
import { buscarDictamenes } from "../../dt";
import { buscarNormas } from "../../bcn";
import { buscarFallos as buscarFallosSuprema } from "../../suprema";
import type { ToolInput, AgentContext } from "../types";

export async function executeDiarioOficial(input: ToolInput, _ctx: AgentContext): Promise<string> {
  const db = getDb();
  const limite = Number(input.limite) || 5;
  const normas = await db.select().from(diarioOficialNormas)
    .orderBy(desc(diarioOficialNormas.fechaPublicacion))
    .limit(limite);
  return JSON.stringify({
    normas: normas.map((n) => ({
      titulo: n.titulo, tipo: n.tipo, organismo: n.organismo,
      fecha: n.fechaPublicacion, materia: n.materia, numero: n.numeroNorma,
    })),
    total: normas.length,
  });
}

export async function executeBuscarDictamenDt(input: ToolInput, _ctx: AgentContext): Promise<string> {
  const query = String(input.query ?? "");
  const dictamenes = await buscarDictamenes(query, { limite: 5 });
  return JSON.stringify({
    query,
    resultados: dictamenes.slice(0, 5).map((d) => ({
      ordinario: d.ordinario,
      fecha: d.fecha,
      materia: d.materia,
      sumario: d.sumario,
      url: d.url,
    })),
    total: dictamenes.length,
  });
}

export async function executeBuscarLeyBcn(input: ToolInput, _ctx: AgentContext): Promise<string> {
  const query = String(input.query ?? "");
  const normas = await buscarNormas(query, { limite: 5 });
  return JSON.stringify({
    query,
    resultados: normas.slice(0, 5).map((n) => ({
      numero: n.numero,
      titulo: n.titulo,
      tipo: n.tipo,
      fechaPublicacion: n.fechaPublicacion,
      url: n.url,
    })),
    total: normas.length,
  });
}

export async function executeBuscarFalloSuprema(input: ToolInput, _ctx: AgentContext): Promise<string> {
  const query = String(input.query ?? "");
  const materia = input.materia ? String(input.materia) : undefined;
  try {
    const fallos = await buscarFallosSuprema(query, { materia, limit: 5 });
    return JSON.stringify({
      fallos: fallos.slice(0, 5).map((f) => ({
        rol: f.rol,
        fecha: f.fechaSentencia,
        sala: f.sala,
        materia: f.materia,
        caratula: f.caratula,
        ministroRedactor: f.ministroRedactor,
        resumen: f.resumen,
        url: f.url,
      })),
      total: fallos.length,
    });
  } catch (e: any) {
    return JSON.stringify({ error: `Error buscando fallos Corte Suprema: ${e.message ?? "desconocido"}` });
  }
}
