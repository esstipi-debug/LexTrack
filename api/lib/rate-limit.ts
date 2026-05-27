import type { Context } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { authenticateRequest } from "../kimi/auth";

/**
 * Resolve a stable per-caller key: prefer the authenticated user id,
 * fall back to the client IP (cf-connecting-ip, x-forwarded-for, then remote).
 */
async function resolveKey(c: Context): Promise<string> {
  try {
    const user = await authenticateRequest(c.req.raw.headers);
    if (user?.id) return `u:${user.id}`;
  } catch {
    // Unauthenticated — fall through to IP
  }
  const fwd =
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for") ||
    c.req.header("c-ip") ||
    "";
  const ip = fwd.split(",")[0]?.trim();
  if (ip) return `ip:${ip}`;
  // @ts-expect-error — env.incoming exists when running under @hono/node-server
  const remote = c.env?.incoming?.socket?.remoteAddress as string | undefined;
  return `ip:${remote ?? "unknown"}`;
}

/**
 * Resolve key by IP only — used for auth routes where the user is not yet
 * authenticated and no userId is available.
 */
async function resolveIpKey(c: Context): Promise<string> {
  const fwd =
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for") ||
    c.req.header("c-ip") ||
    "";
  const ip = fwd.split(",")[0]?.trim();
  if (ip) return `ip:${ip}`;
  // @ts-expect-error — env.incoming exists when running under @hono/node-server
  const remote = c.env?.incoming?.socket?.remoteAddress as string | undefined;
  return `ip:${remote ?? "unknown"}`;
}

function buildLimiter(opts: { windowMs: number; limit: number; ipOnly?: boolean }) {
  return rateLimiter({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: "draft-7",
    keyGenerator: opts.ipOnly ? resolveIpKey : resolveKey,
    handler: (c) => {
      const retryAfter = Math.ceil(opts.windowMs / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json(
        { error: "rate_limit_exceeded", retryAfter },
        429,
      );
    },
  });
}

/** 100 req/min globally per user (or IP). */
export const generalLimiter = buildLimiter({ windowMs: 60_000, limit: 100 });

/** 20 req/min per user — for expensive Anthropic-backed agent calls. */
export const agentLimiter = buildLimiter({ windowMs: 60_000, limit: 20 });

/** 30 req/min per user — for RAG queries. */
export const ragLimiter = buildLimiter({ windowMs: 60_000, limit: 30 });

/** Factory for tests / custom limits. */
export function makeRateLimiter(windowMs: number, limit: number, ipOnly = false) {
  return buildLimiter({ windowMs, limit, ipOnly });
}

/** 10 req/min per IP — for auth/OAuth routes before the user is authenticated. */
export const authLimiter = makeRateLimiter(60_000, 10, true);
