// ─── Trial expiration reminder job ───────────────────────────────
// Runs daily; emails users whose trial ends in ~3 days.

import { getDb } from "../queries/connection";
import { subscriptions } from "@db/schema-billing";
import { users } from "@db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { createLogger } from "../lib/logger";
import { sendEmail } from "../lib/email/send";
import { trialExpirando } from "../lib/email/templates";

const log = createLogger("jobs/notify-trial-expiring");

export interface NotifyTrialExpiringResult {
  candidatos: number;
  enviados: number;
  errores: number;
}

/**
 * Emails users whose trial ends in ~3 days (window: now+2.5d .. now+3.5d).
 * Not idempotent across runs — relies on cron running once per day.
 */
export async function notifyTrialExpiring(): Promise<NotifyTrialExpiringResult> {
  const db = getDb();
  const result: NotifyTrialExpiringResult = {
    candidatos: 0,
    enviados: 0,
    errores: 0,
  };

  const now = Date.now();
  const windowStart = new Date(now + 2.5 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now + 3.5 * 24 * 60 * 60 * 1000);

  let rows: Array<{
    userId: number;
    trialEndsAt: Date | null;
    email: string | null;
    name: string | null;
  }>;

  try {
    rows = await db
      .select({
        userId: subscriptions.userId,
        trialEndsAt: subscriptions.trialEndsAt,
        email: users.email,
        name: users.name,
      })
      .from(subscriptions)
      .innerJoin(users, eq(users.id, subscriptions.userId))
      .where(
        and(
          eq(subscriptions.status, "trialing"),
          gte(subscriptions.trialEndsAt, windowStart),
          lte(subscriptions.trialEndsAt, windowEnd),
        ),
      );
  } catch (err) {
    log.error({ err }, "query failed");
    result.errores += 1;
    return result;
  }

  result.candidatos = rows.length;
  log.info({ candidatos: rows.length }, "trial-expiring scan");

  for (const row of rows) {
    if (!row.email || !row.trialEndsAt) continue;
    const diasRestantes = Math.max(
      1,
      Math.ceil((row.trialEndsAt.getTime() - now) / (24 * 60 * 60 * 1000)),
    );
    try {
      await sendEmail({
        to: row.email,
        template: trialExpirando({
          nombre: row.name ?? row.email,
          diasRestantes,
          trialEndsAt: row.trialEndsAt,
        }),
      });
      result.enviados += 1;
      log.info(
        { userId: row.userId, diasRestantes },
        "trial-expiring email sent",
      );
    } catch (err) {
      log.error({ err, userId: row.userId }, "send failed");
      result.errores += 1;
    }
  }

  return result;
}
