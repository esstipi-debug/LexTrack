import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Unit tests for billingRouter.
 *
 * Mocking strategy:
 * - `./lib/billing/stripe` and `./lib/billing/mercadopago` are mocked so we
 *   don't reach the Stripe/MP SDKs (and don't need env vars).
 * - `./queries/connection` returns a tiny per-table fluent DB driven by
 *   `dbState` — same pattern as `agent-router.test.ts`.
 * - `@db/schema-billing` exports a stub `subscriptions` token (just a marker).
 * - drizzle-orm `eq` is stubbed to a callable that captures its args, so
 *   the in-memory builder doesn't need to interpret real conditions.
 */

// ── Stripe lib mock ───────────────────────────────────────────────
const stripeMock = {
  createCheckoutSession: vi.fn(async (_userId: number, _plan: string, _s: string, _c: string) => ({
    url: "https://checkout.stripe.test/session-xyz",
  })),
  createPortalSession: vi.fn(async (_customerId: string, _returnUrl: string) => ({
    url: "https://billing.stripe.test/portal-xyz",
  })),
  handleWebhook: vi.fn(async (_raw: string, _sig: string) => ({
    type: "checkout.session.completed",
    data: { object: {} },
  })),
  cancelSubscriptionAtPeriodEnd: vi.fn(async (_id: string) => undefined),
};

vi.mock("./lib/billing/stripe", () => stripeMock);

// ── MercadoPago lib mock ─────────────────────────────────────────
const mpMock = {
  createMpPreference: vi.fn(async (_uid: number, _plan: string, _s: string, _c: string, _p: string) => ({
    initPoint: "https://mp.test/pay-abc",
    preferenceId: "pref-abc",
  })),
  handleMpWebhook: vi.fn(async (_body: unknown) => ({
    type: "payment_approved" as const,
    userId: 1,
    plan: "starter" as const,
    paymentId: "mp-pay-1",
  })),
};

vi.mock("./lib/billing/mercadopago", () => mpMock);

// ── audit + logger mocks (avoid pino import) ─────────────────────
vi.mock("./lib/audit", () => ({
  audit: vi.fn(async () => undefined),
  auditFromCtx: vi.fn(async () => undefined),
}));

vi.mock("./lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── drizzle-orm stub ─────────────────────────────────────────────
vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    eq: (..._a: unknown[]) => ({ _op: "eq", _a }),
    desc: (..._a: unknown[]) => ({ _op: "desc", _a }),
    and: (..._a: unknown[]) => ({ _op: "and", _a }),
    sql: ((..._a: unknown[]) => ({ _op: "sql", _a })) as any,
    lt: (..._a: unknown[]) => ({ _op: "lt", _a }),
  };
});

// ── Schema stub ──────────────────────────────────────────────────
vi.mock("@db/schema-billing", () => ({
  subscriptions: { __name: "subscriptions" },
}));

// ── DB mock ──────────────────────────────────────────────────────
type DbState = {
  rows: { subscriptions: any[] };
  lastInsert: { table: string; values: any } | null;
  lastUpdate: { table: string; set: any } | null;
};

const dbState: DbState = {
  rows: { subscriptions: [] },
  lastInsert: null,
  lastUpdate: null,
};

function makeBuilder() {
  const builder: any = {
    where: () => builder,
    orderBy: () => builder,
    limit: (_n: number) => Promise.resolve(dbState.rows.subscriptions),
    then: (resolve: any, reject: any) =>
      Promise.resolve(dbState.rows.subscriptions).then(resolve, reject),
  };
  return builder;
}

vi.mock("./queries/connection", () => ({
  getDb: () => ({
    select: () => ({ from: (_t: any) => makeBuilder() }),
    insert: (_t: any) => ({
      values: (v: any) => {
        dbState.lastInsert = { table: "subscriptions", values: v };
        // Mirror into rows so subsequent selects see it
        dbState.rows.subscriptions.push(v);
        return Promise.resolve();
      },
    }),
    update: (_t: any) => ({
      set: (v: any) => {
        dbState.lastUpdate = { table: "subscriptions", set: v };
        // Apply set to existing rows
        for (const row of dbState.rows.subscriptions) Object.assign(row, v);
        return {
          where: () => Promise.resolve(),
        };
      },
    }),
  }),
}));

// ── Import router after mocks ────────────────────────────────────
const { billingRouter } = await import("./billing-router");

function ctxFor(userId = 1) {
  return {
    user: { id: userId, role: "user", email: "u@test.cl" },
  } as any;
}

beforeEach(() => {
  dbState.rows.subscriptions = [];
  dbState.lastInsert = null;
  dbState.lastUpdate = null;
  vi.clearAllMocks();
});

describe("billing.plans (public)", () => {
  it("returns the PLANS catalog", async () => {
    const caller = billingRouter.createCaller({} as any);
    const plans = await caller.plans();
    expect(plans).toHaveProperty("free");
    expect(plans).toHaveProperty("starter");
    expect(plans).toHaveProperty("pro");
  });
});

describe("billing.currentPlan", () => {
  it("returns plan='free' and subscription=null when no row exists", async () => {
    dbState.rows.subscriptions = [];
    const caller = billingRouter.createCaller(ctxFor(7));
    const res = await caller.currentPlan();
    expect(res.plan).toBe("free");
    expect(res.subscription).toBeNull();
  });

  it("returns plan='starter' for an active subscription", async () => {
    dbState.rows.subscriptions = [
      {
        id: 1,
        userId: 7,
        plan: "starter",
        provider: "stripe",
        status: "active",
        externalId: "sub_abc",
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        cancelAtPeriodEnd: false,
      },
    ];
    const caller = billingRouter.createCaller(ctxFor(7));
    const res = await caller.currentPlan();
    expect(res.plan).toBe("starter");
    expect(res.subscription).not.toBeNull();
    expect(res.subscription!.status).toBe("active");
  });

  it("returns the trialing subscription as-is (caller decides expiry)", async () => {
    dbState.rows.subscriptions = [
      {
        id: 2,
        userId: 7,
        plan: "free",
        provider: "stripe",
        status: "trialing",
        trialEndsAt: new Date(Date.now() + 7 * 86400000),
      },
    ];
    const caller = billingRouter.createCaller(ctxFor(7));
    const res = await caller.currentPlan();
    expect(res.plan).toBe("free");
    expect(res.subscription!.status).toBe("trialing");
  });

  it("returns canceled subscription transparently", async () => {
    dbState.rows.subscriptions = [
      {
        id: 3,
        userId: 7,
        plan: "pro",
        provider: "stripe",
        status: "canceled",
        externalId: "sub_canceled",
      },
    ];
    const caller = billingRouter.createCaller(ctxFor(7));
    const res = await caller.currentPlan();
    expect(res.plan).toBe("pro");
    expect(res.subscription!.status).toBe("canceled");
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const caller = billingRouter.createCaller({} as any);
    await expect(caller.currentPlan()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("billing.createCheckout", () => {
  it("Stripe happy path: calls createCheckoutSession and returns URL", async () => {
    const caller = billingRouter.createCaller(ctxFor(42));
    const res = await caller.createCheckout({ plan: "starter", provider: "stripe" });
    expect(res.url).toBe("https://checkout.stripe.test/session-xyz");
    expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(1);
    const [uid, plan] = stripeMock.createCheckoutSession.mock.calls[0];
    expect(uid).toBe(42);
    expect(plan).toBe("starter");
  });

  it("MercadoPago happy path: calls createMpPreference and returns initPoint", async () => {
    const caller = billingRouter.createCaller(ctxFor(42));
    const res = await caller.createCheckout({ plan: "pro", provider: "mercadopago" });
    expect(res.url).toBe("https://mp.test/pay-abc");
    expect(mpMock.createMpPreference).toHaveBeenCalledTimes(1);
    const [uid, plan] = mpMock.createMpPreference.mock.calls[0];
    expect(uid).toBe(42);
    expect(plan).toBe("pro");
    expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects invalid plan via zod input validation", async () => {
    const caller = billingRouter.createCaller(ctxFor());
    await expect(
      caller.createCheckout({ plan: "free" as any, provider: "stripe" }),
    ).rejects.toBeTruthy();
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const caller = billingRouter.createCaller({} as any);
    await expect(
      caller.createCheckout({ plan: "starter", provider: "stripe" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("billing.webhook (Stripe)", () => {
  it("checkout.session.completed → inserts a new subscription when none exists", async () => {
    dbState.rows.subscriptions = [];
    stripeMock.handleWebhook.mockResolvedValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "5", plan: "starter" },
          subscription: "sub_new123",
          customer: "cus_x",
        },
      },
    } as any);

    const caller = billingRouter.createCaller({} as any);
    const res = await caller.webhook({ rawBody: "{}", signature: "sig" });

    expect(res.received).toBe(true);
    expect(dbState.lastInsert).not.toBeNull();
    expect(dbState.lastInsert!.values.userId).toBe(5);
    expect(dbState.lastInsert!.values.plan).toBe("starter");
    expect(dbState.lastInsert!.values.provider).toBe("stripe");
    expect(dbState.lastInsert!.values.externalId).toBe("sub_new123");
    expect(dbState.lastInsert!.values.status).toBe("active");
  });

  it("checkout.session.completed → updates existing subscription", async () => {
    dbState.rows.subscriptions = [
      {
        id: 1,
        userId: 5,
        plan: "free",
        provider: "stripe",
        status: "trialing",
        externalId: "sub_old",
      },
    ];
    stripeMock.handleWebhook.mockResolvedValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "5", plan: "pro" },
          subscription: "sub_new",
          customer: "cus_y",
        },
      },
    } as any);

    const caller = billingRouter.createCaller({} as any);
    await caller.webhook({ rawBody: "{}", signature: "sig" });

    expect(dbState.lastUpdate).not.toBeNull();
    expect(dbState.lastUpdate!.set.plan).toBe("pro");
    expect(dbState.lastUpdate!.set.externalId).toBe("sub_new");
    expect(dbState.lastUpdate!.set.status).toBe("active");
    expect(dbState.lastInsert).toBeNull();
  });

  it("customer.subscription.updated → updates status and period end", async () => {
    dbState.rows.subscriptions = [
      {
        id: 1,
        userId: 5,
        plan: "starter",
        provider: "stripe",
        status: "active",
        externalId: "sub_xyz",
      },
    ];
    stripeMock.handleWebhook.mockResolvedValueOnce({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_xyz",
          status: "past_due",
          cancel_at_period_end: false,
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
        },
      },
    } as any);

    const caller = billingRouter.createCaller({} as any);
    await caller.webhook({ rawBody: "{}", signature: "sig" });

    expect(dbState.lastUpdate!.set.status).toBe("past_due");
    expect(dbState.lastUpdate!.set.cancelAtPeriodEnd).toBe(false);
  });

  it("customer.subscription.deleted → forces status='canceled'", async () => {
    dbState.rows.subscriptions = [
      {
        id: 1,
        userId: 5,
        plan: "starter",
        provider: "stripe",
        status: "active",
        externalId: "sub_xyz",
      },
    ];
    stripeMock.handleWebhook.mockResolvedValueOnce({
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_xyz",
          status: "active", // ignored
          cancel_at_period_end: true,
          current_period_end: Math.floor(Date.now() / 1000),
        },
      },
    } as any);

    const caller = billingRouter.createCaller({} as any);
    await caller.webhook({ rawBody: "{}", signature: "sig" });

    expect(dbState.lastUpdate!.set.status).toBe("canceled");
  });

  it("throws BAD_REQUEST when handleWebhook fails signature check", async () => {
    stripeMock.handleWebhook.mockRejectedValueOnce(new Error("bad sig"));
    const caller = billingRouter.createCaller({} as any);
    await expect(
      caller.webhook({ rawBody: "{}", signature: "wrong" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("ignores events with missing metadata (no insert/update)", async () => {
    stripeMock.handleWebhook.mockResolvedValueOnce({
      type: "checkout.session.completed",
      data: { object: {} },
    } as any);
    const caller = billingRouter.createCaller({} as any);
    const res = await caller.webhook({ rawBody: "{}", signature: "sig" });
    expect(res.received).toBe(true);
    expect(dbState.lastInsert).toBeNull();
    expect(dbState.lastUpdate).toBeNull();
  });
});

describe("billing.mpWebhook (MercadoPago)", () => {
  it("payment_approved → inserts subscription when none exists", async () => {
    dbState.rows.subscriptions = [];
    mpMock.handleMpWebhook.mockResolvedValueOnce({
      type: "payment_approved",
      userId: 9,
      plan: "starter",
      paymentId: "mp-1",
    } as any);

    const caller = billingRouter.createCaller({} as any);
    const res = await caller.mpWebhook({ body: { id: 1 } });
    expect(res.received).toBe(true);
    expect(dbState.lastInsert!.values.provider).toBe("mercadopago");
    expect(dbState.lastInsert!.values.plan).toBe("starter");
    expect(dbState.lastInsert!.values.userId).toBe(9);
    expect(dbState.lastInsert!.values.externalId).toBe("mp-1");
  });

  it("payment_approved (idempotent): same paymentId already stored → no update", async () => {
    dbState.rows.subscriptions = [
      {
        id: 1,
        userId: 9,
        plan: "starter",
        provider: "mercadopago",
        status: "active",
        externalId: "mp-1",
      },
    ];
    mpMock.handleMpWebhook.mockResolvedValueOnce({
      type: "payment_approved",
      userId: 9,
      plan: "starter",
      paymentId: "mp-1",
    } as any);

    const caller = billingRouter.createCaller({} as any);
    await caller.mpWebhook({ body: {} });

    expect(dbState.lastUpdate).toBeNull();
    expect(dbState.lastInsert).toBeNull();
  });

  it("payment_approved with different paymentId → updates row", async () => {
    dbState.rows.subscriptions = [
      {
        id: 1,
        userId: 9,
        plan: "starter",
        provider: "mercadopago",
        status: "active",
        externalId: "mp-old",
      },
    ];
    mpMock.handleMpWebhook.mockResolvedValueOnce({
      type: "payment_approved",
      userId: 9,
      plan: "pro",
      paymentId: "mp-new",
    } as any);

    const caller = billingRouter.createCaller({} as any);
    await caller.mpWebhook({ body: {} });

    expect(dbState.lastUpdate!.set.externalId).toBe("mp-new");
    expect(dbState.lastUpdate!.set.plan).toBe("pro");
  });

  it("returns received:true (no DB write) when result.type is not payment_approved", async () => {
    mpMock.handleMpWebhook.mockResolvedValueOnce({ type: "ignored" } as any);
    const caller = billingRouter.createCaller({} as any);
    const res = await caller.mpWebhook({ body: {} });
    expect(res.received).toBe(true);
    expect(dbState.lastInsert).toBeNull();
    expect(dbState.lastUpdate).toBeNull();
  });

  it("throws BAD_REQUEST when handleMpWebhook throws", async () => {
    mpMock.handleMpWebhook.mockRejectedValueOnce(new Error("bad mp payload"));
    const caller = billingRouter.createCaller({} as any);
    await expect(caller.mpWebhook({ body: {} })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("no-ops gracefully when payment_approved is missing userId/plan", async () => {
    mpMock.handleMpWebhook.mockResolvedValueOnce({
      type: "payment_approved",
      userId: null,
      plan: null,
      paymentId: "mp-x",
    } as any);
    const caller = billingRouter.createCaller({} as any);
    const res = await caller.mpWebhook({ body: {} });
    expect(res.received).toBe(true);
    expect(dbState.lastInsert).toBeNull();
  });
});

describe("billing.cancelSubscription", () => {
  it("throws NOT_FOUND when user has no subscription", async () => {
    dbState.rows.subscriptions = [];
    const caller = billingRouter.createCaller(ctxFor(7));
    await expect(caller.cancelSubscription()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("throws BAD_REQUEST when subscription is not Stripe", async () => {
    dbState.rows.subscriptions = [
      { id: 1, userId: 7, plan: "starter", provider: "mercadopago", externalId: "mp-1", status: "active" },
    ];
    const caller = billingRouter.createCaller(ctxFor(7));
    await expect(caller.cancelSubscription()).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(stripeMock.cancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled();
  });

  it("Stripe happy path: calls SDK and flips cancelAtPeriodEnd", async () => {
    dbState.rows.subscriptions = [
      { id: 1, userId: 7, plan: "pro", provider: "stripe", externalId: "sub_z", status: "active", cancelAtPeriodEnd: false },
    ];
    const caller = billingRouter.createCaller(ctxFor(7));
    const res = await caller.cancelSubscription();
    expect(res.ok).toBe(true);
    expect(stripeMock.cancelSubscriptionAtPeriodEnd).toHaveBeenCalledWith("sub_z");
    expect(dbState.lastUpdate!.set.cancelAtPeriodEnd).toBe(true);
  });

  it("throws UNAUTHORIZED with no user", async () => {
    const caller = billingRouter.createCaller({} as any);
    await expect(caller.cancelSubscription()).rejects.toBeInstanceOf(TRPCError);
  });
});
