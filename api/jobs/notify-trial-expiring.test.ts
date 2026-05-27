import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit test for notifyTrialExpiring.
 * - Mocks db (subscriptions+users innerJoin result) and sendEmail.
 * - Asserts users with trialEndsAt ~3 days away receive the email.
 */

const subscriptionsTable = { __t: "subscriptions" } as any;
const usersTable = { __t: "users" } as any;

vi.mock("../lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@db/schema-billing", () => ({
  subscriptions: subscriptionsTable,
}));

vi.mock("@db/schema", () => ({
  users: usersTable,
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>(
    "drizzle-orm",
  );
  return {
    ...actual,
    eq: (..._args: unknown[]) => ({ _op: "eq" }),
    and: (..._args: unknown[]) => ({ _op: "and" }),
    or: (..._args: unknown[]) => ({ _op: "or" }),
    gt: (..._args: unknown[]) => ({ _op: "gt" }),
    gte: (..._args: unknown[]) => ({ _op: "gte" }),
    lt: (..._args: unknown[]) => ({ _op: "lt" }),
    lte: (..._args: unknown[]) => ({ _op: "lte" }),
  };
});

const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

const joinedRows = [
  {
    userId: 7,
    trialEndsAt,
    email: "ana@example.com",
    name: "Ana",
  },
];

vi.mock("../queries/connection", () => {
  return {
    getDb: () => ({
      select: (_cols?: any) => ({
        from: (_table: any) => ({
          innerJoin: (_t: any, _on: any) => ({
            where: (_cond: any) => Promise.resolve(joinedRows),
          }),
        }),
      }),
    }),
  };
});

const sentEmails: any[] = [];
vi.mock("../lib/email/send", () => ({
  sendEmail: vi.fn(async (args: any) => {
    sentEmails.push(args);
  }),
}));

beforeEach(() => {
  sentEmails.length = 0;
});

describe("notifyTrialExpiring", () => {
  it("sends a trial-expiring email to each candidate", async () => {
    const { notifyTrialExpiring } = await import("./notify-trial-expiring");
    const result = await notifyTrialExpiring();

    expect(result.candidatos).toBe(1);
    expect(result.enviados).toBe(1);
    expect(result.errores).toBe(0);

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe("ana@example.com");
    expect(sentEmails[0].template.subject).toContain("prueba gratis termina");
  });
});
