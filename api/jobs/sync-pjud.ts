// ─── PJUD active causas sync job ─────────────────────────────────
// Iterates causas with monitoring enabled, calls the PJUD facade
// for each, dedupes against existing cronologia rows, and creates
// alertas for new movements. Multi-tenant: alertas are always
// scoped to the owning userId.

import { getDb } from "../queries/connection";
import { causas, cronologia, alertas } from "@db/schema";
import { and, eq } from "drizzle-orm";
import {
  obtenerMovimientos,
  PjudUnavailableError,
  PjudNotFoundError,
  type PjudMovimiento,
} from "../lib/pjud/index";
import { createLogger } from "../lib/logger";

const log = createLogger("jobs/sync-pjud");

const PJUD_CALL_DELAY_MS = 1000; // max 1 call/sec

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function classifyPrioridad(
  tipo: string,
  descripcion: string,
): "alta" | "media" {
  const blob = `${tipo} ${descripcion}`.toLowerCase();
  if (/sentencia|fallo|resoluci[oó]n/.test(blob)) return "alta";
  return "media";
}

function mapTipoCronologia(
  tipoPjud: string,
):
  | "ingreso"
  | "audiencia"
  | "resolucion"
  | "notificacion"
  | "tramite"
  | "prueba"
  | "sentencia"
  | "apelacion"
  | "cambio_estado"
  | "escrito_presentado"
  | "otro" {
  const t = tipoPjud.toLowerCase();
  if (t.includes("resolucion") || t.includes("resolución")) return "resolucion";
  if (t.includes("audiencia")) return "audiencia";
  if (t.includes("notificacion") || t.includes("notificación"))
    return "notificacion";
  if (t.includes("sentencia") || t.includes("fallo")) return "sentencia";
  if (t.includes("escrito")) return "escrito_presentado";
  if (t.includes("prueba")) return "prueba";
  if (t.includes("apelacion") || t.includes("recurso")) return "apelacion";
  if (t.includes("actuacion") || t.includes("tramite")) return "tramite";
  return "otro";
}

export interface PjudJobResult {
  causasProcesadas: number;
  movimientosNuevos: number;
  alertasCreadas: number;
  errores: number;
}

/**
 * Background job: sync active (monitored) causas with PJUD.
 * - Idempotent: dedupes movements by (fecha, descripcion) before insert.
 * - Resilient: catches PjudUnavailableError / PjudNotFoundError per-causa.
 * - Multi-tenant: every alerta + cronologia row carries the original userId.
 */
export async function syncPjudActiveCausas(): Promise<PjudJobResult> {
  const db = getDb();
  const result: PjudJobResult = {
    causasProcesadas: 0,
    movimientosNuevos: 0,
    alertasCreadas: 0,
    errores: 0,
  };

  // "active" = anything still being monitored and not in a terminal estado.
  const rows = await db.select().from(causas).where(eq(causas.estaMonitoreando, true));

  for (const causa of rows) {
    if (causa.estado === "concluida" || causa.estado === "archivada") continue;
    result.causasProcesadas += 1;

    let movimientos: PjudMovimiento[];
    try {
      movimientos = await obtenerMovimientos(
        causa.rol ?? causa.rit,
        causa.tribunal,
      );
    } catch (err) {
      if (
        err instanceof PjudUnavailableError ||
        err instanceof PjudNotFoundError
      ) {
        log.error(
          { err, causaId: causa.id, rit: causa.rit },
          "skipping causa",
        );
        result.errores += 1;
        await sleep(PJUD_CALL_DELAY_MS);
        continue;
      }
      log.error({ err, causaId: causa.id }, "unexpected error on causa");
      result.errores += 1;
      await sleep(PJUD_CALL_DELAY_MS);
      continue;
    }

    // Dedupe vs existing cronologia for this (userId, causaId).
    const existing = await db
      .select()
      .from(cronologia)
      .where(
        and(
          eq(cronologia.causaId, causa.id),
          eq(cronologia.userId, causa.userId),
        ),
      );

    const seen = new Set(
      existing.map((c) => {
        const fechaStr =
          c.fecha instanceof Date
            ? c.fecha.toISOString().slice(0, 10)
            : String(c.fecha);
        return `${fechaStr}|${c.titulo}`;
      }),
    );

    const nuevos = movimientos.filter(
      (m) => !seen.has(`${m.fecha}|${m.descripcion}`),
    );

    for (const mov of nuevos) {
      try {
        await db.insert(cronologia).values({
          userId: causa.userId,
          causaId: causa.id,
          fecha: new Date(mov.fecha),
          tipo: mapTipoCronologia(mov.tipo),
          titulo: mov.descripcion,
          descripcion: `${mov.tipo}: ${mov.descripcion}${mov.folio ? ` (folio ${mov.folio})` : ""}`,
          fuente: "pjud_job",
        } as any);
        result.movimientosNuevos += 1;

        await db.insert(alertas).values({
          userId: causa.userId,
          causaId: causa.id,
          tipo: "nuevo_movimiento",
          titulo: `Nuevo movimiento en ${causa.rit}: ${mov.tipo}`,
          descripcion: mov.descripcion,
          prioridad: classifyPrioridad(mov.tipo, mov.descripcion),
          estado: "pendiente",
          fechaEvento: new Date(mov.fecha),
        } as any);
        result.alertasCreadas += 1;
      } catch (err) {
        log.error({ err, causaId: causa.id }, "insert failed for causa");
        result.errores += 1;
      }
    }

    await sleep(PJUD_CALL_DELAY_MS);
  }

  return result;
}
