import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit test for cursor pagination on causa.listar.
 *
 * We mock the drizzle query builder used by getDb() so we can drive
 * the returned rows deterministically and assert that the router
 * slices items + computes nextCursor correctly across two pages.
 */

type Row = { id: number; userId: string; caratula: string };

// Build a fake dataset of 25 rows (ids 1..25). The router orders by id desc
// and applies `lt(id, cursor)` for forward pagination — so we simulate that here.
const ALL: Row[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  userId: "u1",
  caratula: `Causa ${i + 1}`,
}));

function buildBuilder(rows: Row[]) {
  // Chainable thenable that yields `rows` when awaited.
  const builder: any = {
    select: () => builder,
    from: () => builder,
    where: (_cond?: unknown) => builder,
    orderBy: () => builder,
    limit: (_n: number) => Promise.resolve(rows),
  };
  return builder;
}

vi.mock("./queries/connection", () => {
  return {
    getDb: () => ({
      // The router calls db.select().from(...).where(...).orderBy(...).limit(...)
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: (n: number) => {
                // Apply userId filter + cursor + desc id + limit
                const cursor = (globalThis as any).__cursor as number | null;
                let filtered = ALL.filter((r) => r.userId === "u1");
                if (cursor != null) filtered = filtered.filter((r) => r.id < cursor);
                filtered.sort((a, b) => b.id - a.id);
                return Promise.resolve(filtered.slice(0, n));
              },
            }),
          }),
        }),
      }),
    }),
  };
});

// Stub drizzle helpers used at module load. They just need to be callable.
vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    eq: (..._args: unknown[]) => ({ _op: "eq" }),
    desc: (..._args: unknown[]) => ({ _op: "desc" }),
    and: (..._args: unknown[]) => ({ _op: "and" }),
    sql: ((..._args: unknown[]) => ({ _op: "sql" })) as any,
    lt: (..._args: unknown[]) => ({ _op: "lt" }),
  };
});

const { causaRouter } = await import("./causa-router");

const ctx = {
  user: { id: "u1", role: "abogado" as const, email: "u@x.cl" },
} as any;

beforeEach(() => {
  (globalThis as any).__cursor = null;
});

describe("causa.listar cursor pagination", () => {
  it("page 1: returns first `limit` items and nextCursor = id of last item", async () => {
    const caller = causaRouter.createCaller(ctx);
    (globalThis as any).__cursor = null;
    const page1 = await caller.listar({ limit: 10 });
    expect(page1.items).toHaveLength(10);
    // desc by id → first item is id=25, last item is id=16
    expect(page1.items[0].id).toBe(25);
    expect(page1.items[9].id).toBe(16);
    expect(page1.nextCursor).toBe(16);
  });

  it("page 2: using nextCursor returns next slice and stops when exhausted", async () => {
    const caller = causaRouter.createCaller(ctx);
    (globalThis as any).__cursor = 16;
    const page2 = await caller.listar({ limit: 10, cursor: 16 });
    // ids 15..6 → 10 items
    expect(page2.items).toHaveLength(10);
    expect(page2.items[0].id).toBe(15);
    expect(page2.items[9].id).toBe(6);
    expect(page2.nextCursor).toBe(6);

    (globalThis as any).__cursor = 6;
    const page3 = await caller.listar({ limit: 10, cursor: 6 });
    // ids 5..1 → only 5 remaining, no nextCursor
    expect(page3.items).toHaveLength(5);
    expect(page3.items[0].id).toBe(5);
    expect(page3.nextCursor).toBeNull();
  });

  it("default limit caps at 20 when no input", async () => {
    const caller = causaRouter.createCaller(ctx);
    (globalThis as any).__cursor = null;
    const page = await caller.listar(undefined);
    expect(page.items).toHaveLength(20);
    expect(page.nextCursor).toBe(ALL[5].id); // 25-20+1 = id 6 → wait, desc: items 25..6 then nextCursor = 6
    expect(page.items[0].id).toBe(25);
    expect(page.items[19].id).toBe(6);
  });
});
