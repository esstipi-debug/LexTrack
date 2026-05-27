import { describe, expect, it, vi, beforeEach } from "vitest";

let insertedTable: unknown = null;
let insertedValues: Record<string, unknown> | null = null;
let shouldFail = false;

vi.mock("../queries/connection", () => {
  return {
    getDb: () => ({
      insert: (table: unknown) => ({
        values: (v: Record<string, unknown>) => {
          if (shouldFail) {
            return Promise.reject(new Error("simulated DB failure"));
          }
          insertedTable = table;
          insertedValues = v;
          return Promise.resolve();
        },
      }),
    }),
  };
});

// audit.ts imports auditLog from @db/schema only as a Drizzle table reference;
// the mocked db ignores it, so no extra mocks needed.

const { audit, auditFromCtx } = await import("./audit");

beforeEach(() => {
  insertedTable = null;
  insertedValues = null;
  shouldFail = false;
});

describe("audit()", () => {
  it("inserts a row with all fields populated", async () => {
    await audit({
      userId: 42,
      action: "causa.create",
      tableName: "causas",
      recordId: 99,
      before: { x: 1 },
      after: { x: 2 },
      ip: "10.0.0.1",
      userAgent: "test-ua",
    });

    expect(insertedTable).not.toBeNull();
    expect(insertedValues).toMatchObject({
      userId: 42,
      action: "causa.create",
      tableName: "causas",
      recordId: "99",
      before: { x: 1 },
      after: { x: 2 },
      ip: "10.0.0.1",
      userAgent: "test-ua",
    });
  });

  it("stringifies numeric recordId and nulls missing fields", async () => {
    await audit({
      userId: null,
      action: "system.boot",
      tableName: "system",
    });

    expect(insertedValues).toMatchObject({
      userId: null,
      action: "system.boot",
      tableName: "system",
      recordId: null,
      before: null,
      after: null,
      ip: null,
      userAgent: null,
    });
  });

  it("does NOT throw when the DB insert fails (swallows error)", async () => {
    shouldFail = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        audit({
          userId: 1,
          action: "boom.test",
          tableName: "boom",
        })
      ).resolves.toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("auditFromCtx()", () => {
  it("pulls userId / ip / userAgent from ctx", async () => {
    const ctx = {
      user: { id: 7 },
      ip: "1.2.3.4",
      userAgent: "Mozilla/Test",
    };

    await auditFromCtx(ctx, {
      action: "honorario.create",
      tableName: "honorarios",
      recordId: 100,
      after: { cliente: "Acme" },
    });

    expect(insertedValues).toMatchObject({
      userId: 7,
      ip: "1.2.3.4",
      userAgent: "Mozilla/Test",
      action: "honorario.create",
      tableName: "honorarios",
      recordId: "100",
    });
  });

  it("falls back to null userId/ip/userAgent for anonymous ctx", async () => {
    await auditFromCtx({}, {
      action: "anon.action",
      tableName: "things",
    });

    expect(insertedValues).toMatchObject({
      userId: null,
      ip: null,
      userAgent: null,
      action: "anon.action",
      tableName: "things",
    });
  });
});
