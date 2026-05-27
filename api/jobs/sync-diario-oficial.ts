// ─── Diario Oficial daily sync job ───────────────────────────────
// Fetches today's edition via the facade in api/lib/diariooficial,
// upserts normas (deduped by numeroNorma + tipo), and fans out an
// alerta per user for any NEW labor-matter norma.
// Multi-tenant: every alerta carries a userId.

import { getDb } from "../queries/connection";
import {
  diarioOficialNormas,
  users,
  alertas,
  type DiarioOficialNorma as DiarioOficialNormaRow,
} from "@db/schema";
import { and, eq } from "drizzle-orm";
import {
  obtenerEdicionDelDia,
  DiarioOficialUnavailableError,
  type DiarioOficialNorma,
} from "../lib/diariooficial";
import { createLogger } from "../lib/logger";

const log = createLogger("jobs/sync-diario-oficial");

const LABOR_REGEX = /laboral|trabajo|previsional|cotizaci[oó]n|sindical|fuero/i;

export interface DiarioOficialJobResult {
  normasFetched: number;
  normasInsertadas: number;
  alertasCreadas: number;
  errores: number;
}

function mapTipo(
  tipoNorma: string,
):
  | "ley"
  | "decreto"
  | "resolucion"
  | "circular"
  | "instruccion"
  | "acuerdo"
  | "convenio" {
  const t = tipoNorma.toLowerCase();
  if (t.includes("ley")) return "ley";
  if (t.includes("decreto")) return "decreto";
  if (t.includes("resoluc")) return "resolucion";
  if (t.includes("circular")) return "circular";
  if (t.includes("instruc")) return "instruccion";
  if (t.includes("acuerdo")) return "acuerdo";
  if (t.includes("convenio")) return "convenio";
  return "resolucion";
}

function mapMateria(
  materia: string,
):
  | "laboral"
  | "civil"
  | "penal"
  | "tributaria"
  | "administrativa"
  | "ambiental"
  | "otra" {
  const m = materia.toLowerCase();
  if (/laboral|trabajo|previsional|cotizaci[oó]n|sindical|fuero/.test(m))
    return "laboral";
  if (m.includes("civil")) return "civil";
  if (m.includes("penal")) return "penal";
  if (m.includes("tribut")) return "tributaria";
  if (m.includes("ambient")) return "ambiental";
  if (m.includes("administ")) return "administrativa";
  return "otra";
}

/**
 * Background job: pulls today's Diario Oficial edition, dedupes against
 * existing rows by (numeroNorma, tipo), and creates an alerta per user
 * for every NEW labor-related norma.
 * - Idempotent: re-running on the same day inserts nothing new.
 * - Resilient: scraper failures are logged and swallowed.
 */
export async function syncDiarioOficialDaily(): Promise<DiarioOficialJobResult> {
  const db = getDb();
  const result: DiarioOficialJobResult = {
    normasFetched: 0,
    normasInsertadas: 0,
    alertasCreadas: 0,
    errores: 0,
  };

  let edicion: DiarioOficialNorma[];
  try {
    edicion = await obtenerEdicionDelDia();
  } catch (err) {
    if (err instanceof DiarioOficialUnavailableError) {
      log.error({ err }, "scraper unavailable");
    } else {
      log.error({ err }, "unexpected fetch error");
    }
    result.errores += 1;
    return result;
  }

  result.normasFetched = edicion.length;

  // Load all users once for the fan-out step.
  let allUsers: { id: number }[] = [];
  try {
    allUsers = await db.select({ id: users.id }).from(users);
  } catch (err) {
    log.error({ err }, "failed to load users");
    result.errores += 1;
    return result;
  }

  for (const norma of edicion) {
    const tipoDb = mapTipo(norma.tipoNorma);
    const materiaDb = mapMateria(norma.materia);

    // Dedupe on (numeroNorma, tipo).
    let existing: DiarioOficialNormaRow[] = [];
    try {
      existing = await db
        .select()
        .from(diarioOficialNormas)
        .where(
          and(
            eq(diarioOficialNormas.numeroNorma, norma.numero),
            eq(diarioOficialNormas.tipo, tipoDb),
          ),
        );
    } catch (err) {
      log.error({ err, numero: norma.numero }, "dedupe lookup failed");
      result.errores += 1;
      continue;
    }

    if (existing.length > 0) continue;

    let inserted: { id: number }[];
    try {
      inserted = await db
        .insert(diarioOficialNormas)
        .values({
          numeroNorma: norma.numero,
          numeroDO: norma.numero,
          tipo: tipoDb,
          titulo: norma.titulo,
          organismo: norma.organismo,
          materia: materiaDb,
          fechaPublicacion: new Date(norma.fechaPublicacion),
          urlOriginal: norma.url,
          extracto: norma.texto?.slice(0, 1000),
        } as any)
        .returning({ id: diarioOficialNormas.id });
      result.normasInsertadas += 1;
    } catch (err) {
      log.error({ err, numero: norma.numero }, "insert failed");
      result.errores += 1;
      continue;
    }

    // Fan-out alertas only for labor matters.
    if (!LABOR_REGEX.test(norma.materia)) continue;

    for (const u of allUsers) {
      try {
        await db.insert(alertas).values({
          userId: u.id,
          tipo: "diario_oficial",
          titulo: `Nueva norma laboral: ${norma.titulo}`,
          descripcion: `${norma.tipoNorma} ${norma.numero} — ${norma.organismo}`,
          prioridad: "baja",
          estado: "pendiente",
          fechaEvento: new Date(norma.fechaPublicacion),
          metadata: {
            normaId: inserted[0]?.id,
            url: norma.url,
          },
        } as any);
        result.alertasCreadas += 1;
      } catch (err) {
        log.error({ err, userId: u.id }, "alerta insert failed");
        result.errores += 1;
      }
    }
  }

  return result;
}
