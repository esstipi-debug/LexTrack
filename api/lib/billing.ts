// ─── Trial / subscription helpers ───────────────────────────────────
// Centralizes trial initialization on signup.

import { getDb } from "../queries/connection";
import { subscriptions } from "@db/schema-billing";
import { eq } from "drizzle-orm";
import { createLogger } from "./logger";

const log = createLogger("billing");

export const TRIAL_DURATION_DAYS = 14;

/**
 * Idempotently create a 14-day trial subscription for a freshly-created user.
 * If a subscription already exists for this user, this is a no-op.
 * Errors are logged but NOT propagated — signup must not fail because of this.
 */
export async function initializeTrial(userId: number): Promise<void> {
  try {
    const db = getDb();
    const existing = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      return;
    }

    const now = new Date();
    const trialEndsAt = new Date(
      now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000,
    );

    await db.insert(subscriptions).values({
      userId,
      plan: "free",
      provider: "stripe",
      status: "trialing",
      trialEndsAt,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    log.info({ userId, trialEndsAt }, "trial initialized");
  } catch (err) {
    log.error({ err, userId }, "initializeTrial failed — swallowed");
  }
}
