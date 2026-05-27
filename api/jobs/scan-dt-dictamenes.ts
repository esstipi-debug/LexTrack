// ─── Dirección del Trabajo dictámenes scan job ────────────────────
// Weekly job that scans dt.gob.cl for new dictámenes and fans out an
// alerta per user for any dictamen not yet seen.
// Multi-tenant: every alerta carries a userId.

import { getDb } from "../queries/connection";
import { users, alertas } from "@db/schema";
import { and, eq } from "drizzle-orm";
import { buscarDictamenes } from "../lib/dt";
import { createLogger } from "../lib/logger";

const log = createLogger("jobs/scan-dt-dictamenes");

export interface DtScanResult {
  dictamenesNuevos: number;
  alertasCreadas: number;
  errores: number;
}

/**
 * Background job: fetches recent DT dictámenes, dedupes per user by alerta
 * title, and fans out a "baja"-priority alerta to every user for each new one.
 * Idempotent: re-running inserts nothing if the alerta title already exists
 * for that user.
 */
export async function scanDtDictamenes(): Promise<DtScanResult> {
  const db = getDb();
  const result: DtScanResult = {
    dictamenesNuevos: 0,
    alertasCreadas: 0,
    errores: 0,
  };

  let dictamenes: Awaited<ReturnType<typeof buscarDictamenes>>;
  try {
    dictamenes = await buscarDictamenes("", { limite: 20 });
  } catch (err) {
    log.error({ err }, "DT scraper fetch failed");
    result.errores += 1;
    return result;
  }

  if (dictamenes.length === 0) {
    log.info("No dictamenes returned from DT scraper");
    return result;
  }

  // Load all users once for the fan-out step.
  let allUsers: { id: number }[] = [];
  try {
    allUsers = await db.select({ id: users.id }).from(users);
  } catch (err) {
    log.error({ err }, "failed to load users");
    result.errores += 1;
    return result;
  }

  for (const dictamen of dictamenes) {
    const alertaTitulo = `Nuevo dictamen DT: ${dictamen.ordinario}`;

    for (const u of allUsers) {
      try {
        // Dedupe: skip if this user already has an alerta with the same title.
        const existing = await db
          .select({ id: alertas.id })
          .from(alertas)
          .where(
            and(
              eq(alertas.userId, u.id),
              eq(alertas.titulo, alertaTitulo),
            ),
          );

        if (existing.length > 0) continue;

        await db.insert(alertas).values({
          userId: u.id,
          tipo: "dt_dictamen",
          titulo: alertaTitulo,
          descripcion: `${dictamen.materia} — ${dictamen.sumario?.slice(0, 300) ?? ""}. Ver: ${dictamen.url}`,
          prioridad: "baja",
          estado: "pendiente",
          fechaEvento: new Date(dictamen.fecha),
          metadata: {
            ordinario: dictamen.ordinario,
            url: dictamen.url,
          },
        } as any);

        result.alertasCreadas += 1;
      } catch (err) {
        log.error({ err, userId: u.id, ordinario: dictamen.ordinario }, "alerta insert failed");
        result.errores += 1;
      }
    }

    result.dictamenesNuevos += 1;
  }

  log.info(result, "DT scan complete");
  return result;
}
