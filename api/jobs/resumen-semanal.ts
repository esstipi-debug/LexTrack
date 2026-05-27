// ─── Weekly digest job ────────────────────────────────────────────
// Runs Sundays 08:00; emails each user with-active-or-trialing
// subscription a weekly summary of causas / tareas / alertas.

import { getDb } from "../queries/connection";
import { subscriptions } from "@db/schema-billing";
import {
  users,
  causas,
  tareas,
  alertas,
} from "@db/schema";
import { and, count, eq, gt, or, sql } from "drizzle-orm";
import { createLogger } from "../lib/logger";
import { sendEmail } from "../lib/email/send";
import { resumenSemanal } from "../lib/email/templates";

const log = createLogger("jobs/resumen-semanal");

export interface ResumenSemanalResult {
  destinatarios: number;
  enviados: number;
  errores: number;
}

async function statsForUser(userId: number): Promise<{
  causasActivas: number;
  tareasVencidas: number;
  alertasNoLeidas: number;
}> {
  const db = getDb();
  const hoyStr = new Date().toISOString().split("T")[0];

  try {
    const [causasRow] = await db
      .select({ total: count() })
      .from(causas)
      .where(
        and(
          eq(causas.userId, userId),
          sql`${causas.estado} NOT IN ('concluida', 'archivada')`,
        ),
      );

    const [tareasRow] = await db
      .select({ total: count() })
      .from(tareas)
      .where(
        and(
          eq(tareas.userId, userId),
          sql`${tareas.estado} IN ('pendiente', 'en_progreso')`,
          sql`${tareas.fechaVencimiento} IS NOT NULL`,
          sql`${tareas.fechaVencimiento} < ${hoyStr}`,
        ),
      );

    const [alertasRow] = await db
      .select({ total: count() })
      .from(alertas)
      .where(
        and(eq(alertas.userId, userId), eq(alertas.estado, "pendiente")),
      );

    return {
      causasActivas: causasRow?.total ?? 0,
      tareasVencidas: tareasRow?.total ?? 0,
      alertasNoLeidas: alertasRow?.total ?? 0,
    };
  } catch (err) {
    log.warn({ err, userId }, "stats query failed — defaulting to 0");
    return { causasActivas: 0, tareasVencidas: 0, alertasNoLeidas: 0 };
  }
}

export async function resumenSemanalJob(): Promise<ResumenSemanalResult> {
  const db = getDb();
  const result: ResumenSemanalResult = {
    destinatarios: 0,
    enviados: 0,
    errores: 0,
  };

  const now = new Date();

  let rows: Array<{
    userId: number;
    email: string | null;
    name: string | null;
    status: string;
    trialEndsAt: Date | null;
  }>;

  try {
    rows = await db
      .select({
        userId: subscriptions.userId,
        email: users.email,
        name: users.name,
        status: subscriptions.status,
        trialEndsAt: subscriptions.trialEndsAt,
      })
      .from(subscriptions)
      .innerJoin(users, eq(users.id, subscriptions.userId))
      .where(
        or(
          eq(subscriptions.status, "active"),
          and(
            eq(subscriptions.status, "trialing"),
            gt(subscriptions.trialEndsAt, now),
          ),
        ),
      );
  } catch (err) {
    log.error({ err }, "query failed");
    result.errores += 1;
    return result;
  }

  result.destinatarios = rows.length;
  log.info({ destinatarios: rows.length }, "resumen-semanal scan");

  for (const row of rows) {
    if (!row.email) continue;
    const stats = await statsForUser(row.userId);
    try {
      await sendEmail({
        to: row.email,
        template: resumenSemanal({
          nombre: row.name ?? row.email,
          ...stats,
        }),
      });
      result.enviados += 1;
    } catch (err) {
      log.error({ err, userId: row.userId }, "send failed");
      result.errores += 1;
    }
  }

  return result;
}
