import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { makeRateLimiter } from "./rate-limit";

describe("rate-limit middleware", () => {
  it("returns 429 with rate_limit_exceeded payload after exceeding the limit", async () => {
    const app = new Hono();
    // Tight window: 3 req per 60s — keeps the test fast & deterministic.
    app.use("*", makeRateLimiter(60_000, 3));
    app.get("/ping", (c) => c.json({ ok: true }));

    const headers = { "x-forwarded-for": "10.0.0.1" };

    for (let i = 0; i < 3; i++) {
      const res = await app.request("/ping", { headers });
      expect(res.status).toBe(200);
    }

    const blocked = await app.request("/ping", { headers });
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as {
      error: string;
      retryAfter: number;
    };
    expect(body.error).toBe("rate_limit_exceeded");
    expect(typeof body.retryAfter).toBe("number");
    expect(body.retryAfter).toBeGreaterThan(0);
  });

  it("tracks separate buckets per caller key (IP)", async () => {
    const app = new Hono();
    app.use("*", makeRateLimiter(60_000, 1));
    app.get("/ping", (c) => c.json({ ok: true }));

    const a = await app.request("/ping", {
      headers: { "x-forwarded-for": "10.0.0.2" },
    });
    const b = await app.request("/ping", {
      headers: { "x-forwarded-for": "10.0.0.3" },
    });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const aBlocked = await app.request("/ping", {
      headers: { "x-forwarded-for": "10.0.0.2" },
    });
    expect(aBlocked.status).toBe(429);
  });
});
