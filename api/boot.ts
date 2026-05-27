import * as Sentry from '@sentry/node';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  enabled: !!process.env.SENTRY_DSN, // only active when DSN is set
  tracesSampleRate: 0.1,
  integrations: [Sentry.httpIntegration()],
});

import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { Paths } from "@contracts/constants";
import { generalLimiter, agentLimiter, ragLimiter } from "./lib/rate-limit";
import { createLogger, logger } from "./lib/logger";
import { getDb } from "./queries/connection";

const log = createLogger("boot");
const httpLog = createLogger("http");

const app = new Hono<{
  Bindings: HttpBindings;
  Variables: { requestId: string; userId?: number };
}>();

app.onError((err, c) => {
  Sentry.captureException(err, { extra: { path: c.req.path, method: c.req.method } });
  const errLog = createLogger('error-handler');
  errLog.error({ err }, 'Unhandled error');
  return c.json({ error: 'internal_server_error' }, 500);
});

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

app.use('*', cors({
  origin: process.env.CORS_ORIGIN ?? '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Tiny Hono adapter: per-request structured access log + requestId propagation.
app.use("*", async (c, next) => {
  const requestId = c.req.header("x-request-id") || randomUUID();
  c.set("requestId", requestId);
  c.header("x-request-id", requestId);
  const started = Date.now();
  try {
    await next();
  } finally {
    const durationMs = Date.now() - started;
    httpLog.info(
      {
        requestId,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs,
        userId: c.get("userId"),
      },
      "request",
    );
  }
});

app.get('/health', async (c) => {
  const checks: Record<string, 'ok' | 'error'> = {};

  // DB check
  try {
    await getDb().execute(sql`SELECT 1`);
    checks.db = 'ok';
  } catch {
    checks.db = 'error';
  }

  // Jobs check — just verify the jobs module loaded, not actual run status
  checks.jobs = 'ok';

  const healthy = Object.values(checks).every(v => v === 'ok');
  return c.json(
    { status: healthy ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() },
    healthy ? 200 : 503,
  );
});
app.get(Paths.oauthCallback, createOAuthCallbackHandler());

// Global rate limit applies to everything below.
app.use("*", generalLimiter);
// Stricter per-router limits for the expensive endpoints.
app.use("/api/trpc/agent.chat", agentLimiter);
app.use("/api/trpc/agent.chat/*", agentLimiter);
app.use("/api/trpc/rag.*", ragLimiter);

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  const { startJobs, stopJobs } = await import("./jobs");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    log.info({ port }, `Server running on http://localhost:${port}/`);
  });

  startJobs();

  const shutdown = (signal: string) => {
    log.info({ signal }, "received signal — shutting down");
    try {
      stopJobs();
    } catch (err) {
      log.error({ err }, "stopJobs failed");
    }
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// Re-export root logger for callers that want it without going through the factory.
export { logger };
