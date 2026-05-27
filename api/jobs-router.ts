// ─── Jobs router ─────────────────────────────────────────────────
// Admin-only manual trigger for background jobs (sync-pjud,
// sync-diario-oficial, scan-dt-dictamenes). Useful for ops/debug
// without waiting for the cron tick.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery } from "./middleware";
import { JOBS, type JobName } from "./jobs";
import { createLogger } from "./lib/logger";

const log = createLogger("jobs-router");

const jobNames = Object.keys(JOBS) as [JobName, ...JobName[]];

export const jobsRouter = createRouter({
  runJob: adminQuery
    .input(z.object({ jobName: z.enum(jobNames) }))
    .mutation(async ({ input }) => {
      const def = JOBS[input.jobName as JobName];
      if (!def) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown job: ${input.jobName}`,
        });
      }
      try {
        const result = await def.handler();
        return { ok: true as const, jobName: def.name, result };
      } catch (err) {
        log.error({ err, jobName: def.name }, "job failed");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Job ${def.name} failed`,
        });
      }
    }),

  list: adminQuery.query(() => {
    return Object.values(JOBS).map((j) => ({
      name: j.name,
      schedule: j.schedule,
    }));
  }),
});
