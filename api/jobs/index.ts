// ─── Background jobs registry + lifecycle ────────────────────────
// Centralizes the cron schedules for the three periodic scrapers/syncs.
// startJobs() is called from boot.ts (production only by default).
// The JOBS registry is also consumed by api/jobs-router.ts so admins
// can trigger any job manually via tRPC.

import cron, { type ScheduledTask } from "node-cron";
import { syncPjudActiveCausas } from "./sync-pjud";
import { syncDiarioOficialDaily } from "./sync-diario-oficial";
import { scanDtDictamenes } from "./scan-dt-dictamenes";
import { createLogger } from "../lib/logger";

const log = createLogger("jobs");

export interface JobDefinition {
  name: string;
  schedule: string;
  handler: () => Promise<unknown>;
}

export const JOBS = {
  syncPjud: {
    name: "syncPjud",
    schedule: "0 */6 * * *", // every 6h
    handler: syncPjudActiveCausas,
  },
  syncDiarioOficial: {
    name: "syncDiarioOficial",
    schedule: "0 9 * * *", // daily 09:00
    handler: syncDiarioOficialDaily,
  },
  scanDtDictamenes: {
    name: "scanDtDictamenes",
    schedule: "0 8 * * 1", // weekly Monday 08:00
    handler: scanDtDictamenes,
  },
} as const satisfies Record<string, JobDefinition>;

export type JobName = keyof typeof JOBS;

const scheduled: ScheduledTask[] = [];

function jobsEnabled(): boolean {
  const flag = process.env.JOBS_ENABLED?.toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  // Default: ON in production, OFF elsewhere.
  return process.env.NODE_ENV === "production";
}

async function runSafe(def: JobDefinition): Promise<void> {
  try {
    const started = Date.now();
    log.info({ jobName: def.name }, "running job");
    const result = await def.handler();
    log.info(
      { jobName: def.name, durationMs: Date.now() - started, result },
      "job done",
    );
  } catch (err) {
    log.error({ err, jobName: def.name }, "job threw");
  }
}

export function startJobs(): void {
  if (!jobsEnabled()) {
    log.info("JOBS_ENABLED is false — not scheduling cron tasks");
    return;
  }
  if (scheduled.length > 0) {
    log.info("already started — skipping");
    return;
  }
  for (const def of Object.values(JOBS)) {
    const task = cron.schedule(def.schedule, () => void runSafe(def), {
      scheduled: true,
    });
    scheduled.push(task);
    log.info({ jobName: def.name, schedule: def.schedule }, "scheduled job");
  }
}

export function stopJobs(): void {
  for (const task of scheduled) {
    try {
      task.stop();
    } catch (err) {
      log.error({ err }, "error stopping task");
    }
  }
  scheduled.length = 0;
  log.info("all scheduled tasks stopped");
}
