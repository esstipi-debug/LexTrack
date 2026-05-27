import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit test for cursor pagination on causa.listar.
 *
 * We mock the drizzle query builder used by getDb() so we can drive
 * the returned rows deterministically and assert that the router
 * slices items + computes nextCursor correctly across two pages.
 */

type Row = { id: number; userId: string; orgId: number | null; caratula: string };

// Build a fake dataset of 25 rows (ids 1..25). The router orders by id desc
// and applies `lt(id, cursor)` for forward pagination — so we simulate that here.
const ALL: Row[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  userId: "u1",
  orgId: null,
  caratula: `Causa ${i + 1}`,
}));

// Multi-firma fixtures: rows that belong to org 10 (firmaA) or org 20 (firmaB).
// Used by the firma visibility tests; not part of the legacy ALL fixture above.
const FIRMA_ROWS: Row[] = [
  { id: 1001, userId: "uA", orgId: 10, caratula: "Causa firma A · 1" },
  { id: 1002, userId: "uA", orgId: 10, caratula: "Causa firma A · 2" },
  { id: 2001, userId: "uX", orgId: 20, caratula: "Causa firma B · 1" },
];

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
    getDb: () => {
      const builder: any = {
        select: () => builder,
        from: () => builder,
        where: () => builder,
        orderBy: () => builder,
        // limit: drives the causa.listar query
        limit: (n: number) => {
          const source = (globalThis as any).__source as "all" | "firma" | undefined;
          const cursor = (globalThis as any).__cursor as number | null;
          const userId = (globalThis as any).__userId as string | undefined;
          const orgIds = ((globalThis as any).__orgIds as number[] | undefined) ?? [];
          if (source === "firma") {
            // Apply visibility: userId match OR orgId in orgIds
            let filtered = FIRMA_ROWS.filter(
              (r) => r.userId === userId || (r.orgId != null && orgIds.includes(r.orgId)),
            );
            if (cursor != null) filtered = filtered.filter((r) => r.id < cursor);
            filtered.sort((a, b) => b.id - a.id);
            return Promise.resolve(filtered.slice(0, n));
          }
          // Default legacy behaviour: hardcoded user "u1", uses ALL fixture.
          let filtered = ALL.filter((r) => r.userId === "u1");
          if (cursor != null) filtered = filtered.filter((r) => r.id < cursor);
          filtered.sort((a, b) => b.id - a.id);
          return Promise.resolve(filtered.slice(0, n));
        },
        // then: supports awaiting db.select().from(orgMembers).where(...) for getUserOrgIds.
        // Returns rows in { orgId } shape so router's getUserOrgIds can `.map((r) => r.orgId)`.
        then: (resolve: (v: unknown[]) => void) => {
          const orgIds = ((globalThis as any).__orgIds as number[] | undefined) ?? [];
          return Promise.resolve(orgIds.map((id) => ({ orgId: id }))).then(resolve);
        },
      };
      return builder;
    },
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
    or: (..._args: unknown[]) => ({ _op: "or" }),
    inArray: (..._args: unknown[]) => ({ _op: "inArray" }),
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
  (globalThis as any).__source = "all";
  (globalThis as any).__orgIds = [];
  (globalThis as any).__userId = undefined;
});

function makeCtx(userId: string) {
  return {
    user: { id: userId, role: "abogado" as const, email: `${userId}@x.cl` },
  } as any;
}

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

// ─── Multi-firma visibility ────────────────────────────────────────────────
//
// FIRMA_ROWS fixture:
//   id=1001 userId=uA orgId=10  (firmaA — created by uA)
//   id=1002 userId=uA orgId=10  (firmaA)
//   id=2001 userId=uX orgId=20  (firmaB — created by uX)
//
// Visibility predicate the router builds:
//   userId = caller.id OR orgId IN (caller's orgIds)
//
describe("causa.listar — multi-firma visibility", () => {
  it("user A (firmaA) sees firmaA causas they did not personally create", async () => {
    // uB is a member of firmaA (orgId=10) but didn't create the causas. Should see them.
    (globalThis as any).__source = "firma";
    (globalThis as any).__userId = "uB";
    (globalThis as any).__orgIds = [10];
    const caller = causaRouter.createCaller(makeCtx("uB"));
    const result = await caller.listar({ limit: 50 });
    const ids = result.items.map((i) => i.id).sort((a, b) => a - b);
    expect(ids).toEqual([1001, 1002]);
  });

  it("user without an org does NOT see another firm's causas", async () => {
    // uZ has no firm and didn't create any FIRMA_ROWS. Should see nothing.
    (globalThis as any).__source = "firma";
    (globalThis as any).__userId = "uZ";
    (globalThis as any).__orgIds = [];
    const caller = causaRouter.createCaller(makeCtx("uZ"));
    const result = await caller.listar({ limit: 50 });
    expect(result.items).toEqual([]);
  });

  it("user in a different firm only sees their own firm's causas", async () => {
    // uY belongs to firmaB (orgId=20). Should see 2001 but not 1001/1002.
    (globalThis as any).__source = "firma";
    (globalThis as any).__userId = "uY";
    (globalThis as any).__orgIds = [20];
    const caller = causaRouter.createCaller(makeCtx("uY"));
    const result = await caller.listar({ limit: 50 });
    const ids = result.items.map((i) => i.id);
    expect(ids).toEqual([2001]);
  });
});
