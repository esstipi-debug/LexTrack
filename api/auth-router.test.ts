import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Unit tests for authRouter.
 *
 * auth.me simply returns ctx.user — no DB involved.
 * auth.logout writes a set-cookie header — we inspect resHeaders.
 * Unauthenticated access is enforced by the requireAuth middleware.
 */

// Mock the cookies lib so we don't need Hono at runtime
vi.mock("./lib/cookies", () => ({
  getSessionCookieOptions: (_headers: Headers) => ({
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: false,
  }),
}));

const { authRouter } = await import("./auth-router");

const FAKE_USER = {
  id: "u1",
  email: "u1@test.cl",
  role: "abogado" as const,
  nombre: "Test User",
};

function makeCtx(user?: typeof FAKE_USER) {
  const resHeaders = new Headers();
  return {
    user,
    req: new Request("http://localhost/", {
      headers: { host: "localhost:3000" },
    }),
    resHeaders,
  } as any;
}

describe("auth.me", () => {
  it("returns the authenticated user from context", async () => {
    const ctx = makeCtx(FAKE_USER);
    const caller = authRouter.createCaller(ctx);
    const result = await caller.me();
    expect(result).toEqual(FAKE_USER);
  });

  it("returns exactly the user object (no extra fields stripped)", async () => {
    const ctx = makeCtx(FAKE_USER);
    const caller = authRouter.createCaller(ctx);
    const result = await caller.me();
    expect(result.id).toBe("u1");
    expect(result.email).toBe("u1@test.cl");
    expect(result.role).toBe("abogado");
  });
});

describe("auth.logout", () => {
  it("returns { success: true }", async () => {
    const ctx = makeCtx(FAKE_USER);
    const caller = authRouter.createCaller(ctx);
    const result = await caller.logout();
    expect(result).toEqual({ success: true });
  });

  it("sets a set-cookie header that clears the session cookie", async () => {
    const ctx = makeCtx(FAKE_USER);
    const caller = authRouter.createCaller(ctx);
    await caller.logout();
    const setCookie = ctx.resHeaders.get("set-cookie");
    expect(setCookie).not.toBeNull();
    // Cookie name is "kimi_sid" (from contracts/constants)
    expect(setCookie).toContain("kimi_sid=");
    // maxAge=0 expires the cookie
    expect(setCookie?.toLowerCase()).toContain("max-age=0");
  });
});

describe("unauthenticated access", () => {
  it("auth.me throws UNAUTHORIZED when user is missing from context", async () => {
    const ctx = makeCtx(undefined); // no user
    const caller = authRouter.createCaller(ctx);
    await expect(caller.me()).rejects.toThrow(TRPCError);
    await expect(caller.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("auth.logout throws UNAUTHORIZED when user is missing from context", async () => {
    const ctx = makeCtx(undefined);
    const caller = authRouter.createCaller(ctx);
    await expect(caller.logout()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
