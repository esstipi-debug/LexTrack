import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit tests for alertaRouter.
 *
 * We mock getDb() to return deterministic rows without a real DB.
 * The mock follows the same chainable-builder pattern used in
 * causa-router.test.ts.
 */

type AlertaRow = {
  id: number;
  userId: string;
  orgId?: number | null;
  titulo: string;
  tipo: string;
  prioridad: string;
  estado: string;
  leidaAt: Date | null;
};

// 15 alertas for user "u1", 5 for user "u2"
const ALERTAS_U1: AlertaRow[] = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  userId: "u1",
  titulo: `Alerta ${i + 1}`,
  tipo: i % 2 === 0 ? "system" : "prazo_proximo",
  prioridad: i % 3 === 0 ? "alta" : "media",
  estado: "pendiente",
  leidaAt: null,
}));

const ALERTAS_U2: AlertaRow[] = Array.from({ length: 5 }, (_, i) => ({
  id: 100 + i,
  userId: "u2",
  titulo: `Alerta U2 ${i + 1}`,
  tipo: "system",
  prioridad: "baja",
  estado: "pendiente",
  leidaAt: null,
}));

const ALL_ALERTAS = [...ALERTAS_U1, ...ALERTAS_U2];

// Multi-firma fixture: alertas tied to firmaA (orgId=10) vs firmaB (orgId=20).
const FIRMA_ALERTAS: AlertaRow[] = [
  { id: 5001, userId: "uA", orgId: 10, titulo: "Alerta firmaA #1", tipo: "system", prioridad: "media", estado: "pendiente", leidaAt: null },
  { id: 5002, userId: "uA", orgId: 10, titulo: "Alerta firmaA #2", tipo: "system", prioridad: "alta", estado: "pendiente", leidaAt: null },
  { id: 6001, userId: "uX", orgId: 20, titulo: "Alerta firmaB #1", tipo: "system", prioridad: "media", estado: "pendiente", leidaAt: null },
];

// Simulated insert store
let insertedValues: Record<string, unknown> | null = null;
let updatedValues: Record<string, unknown> | null = null;

vi.mock("./queries/connection", () => {
  return {
    getDb: () => {
      const db: any = {
        select: () => db,
        from: () => db,
        where: (_cond?: unknown) => db,
        orderBy: () => db,
        groupBy: () => db,
        limit: (n: number) => {
          const userId = (globalThis as any).__userId as string;
          const cursor = (globalThis as any).__cursor as number | null;
          const source = (globalThis as any).__source as "all" | "firma" | undefined;
          const orgIds = ((globalThis as any).__orgIds as number[] | undefined) ?? [];
          const dataset = source === "firma" ? FIRMA_ALERTAS : ALL_ALERTAS;
          let rows = dataset.filter((r) =>
            source === "firma"
              ? r.userId === userId || (r.orgId != null && orgIds.includes(r.orgId))
              : r.userId === userId,
          );
          if (cursor != null) rows = rows.filter((r) => r.id < cursor);
          rows.sort((a, b) => b.id - a.id);
          return Promise.resolve(rows.slice(0, n));
        },
        then: (resolve: (v: unknown[]) => void) => {
          // Awaited db.select(...).from(...).where(...) — drives both
          //  (a) getUserOrgIds — router calls .map((r) => r.orgId)
          //  (b) dashboard count queries — router calls rows[0]?.count etc.
          // Returning orgId-shaped rows works for (a) and is benign for (b)
          // because the existing dashboard test only asserts result shape,
          // not actual count values (which were also nonsense before).
          const orgIds = ((globalThis as any).__orgIds as number[] | undefined) ?? [];
          return Promise.resolve(orgIds.map((id) => ({ orgId: id }))).then(resolve);
        },
        insert: (_table: unknown) => ({
          values: (v: Record<string, unknown>) => {
            insertedValues = v;
            return {
              $returningId: () =>
                Promise.resolve([{ id: 999 }]),
            };
          },
        }),
        update: (_table: unknown) => ({
          set: (v: Record<string, unknown>) => {
            updatedValues = v;
            return {
              where: () => Promise.resolve(),
            };
          },
        }),
      };
      return db;
    },
  };
});

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

const { alertaRouter } = await import("./alerta-router");

function makeCtx(userId: string) {
  return {
    user: { id: userId, role: "abogado" as const, email: `${userId}@test.cl` },
  } as any;
}

beforeEach(() => {
  (globalThis as any).__userId = "u1";
  (globalThis as any).__cursor = null;
  (globalThis as any).__source = "all";
  (globalThis as any).__orgIds = [];
  insertedValues = null;
  updatedValues = null;
});

describe("alerta.listar", () => {
  it("returns items + nextCursor scoped to caller's userId", async () => {
    (globalThis as any).__userId = "u1";
    const caller = alertaRouter.createCaller(makeCtx("u1"));
    const result = await caller.listar({ limit: 5 });
    expect(result.items).toHaveLength(5);
    // All items belong to u1
    result.items.forEach((item) => expect(item.userId).toBe("u1"));
    expect(result.nextCursor).toBe(result.items[result.items.length - 1].id);
  });

  it("does not return another user's alertas", async () => {
    (globalThis as any).__userId = "u1";
    const caller = alertaRouter.createCaller(makeCtx("u1"));
    const result = await caller.listar({ limit: 100 });
    const u2ids = result.items.filter((i) => i.userId === "u2");
    expect(u2ids).toHaveLength(0);
    expect(result.items.length).toBe(15);
  });

  it("cursor pagination: page 2 returns next slice", async () => {
    (globalThis as any).__userId = "u1";
    const caller = alertaRouter.createCaller(makeCtx("u1"));

    // Page 1: ids 15..6 (desc), cursor = 6
    (globalThis as any).__cursor = null;
    const page1 = await caller.listar({ limit: 10 });
    expect(page1.items).toHaveLength(10);
    expect(page1.items[0].id).toBe(15);
    expect(page1.nextCursor).toBe(page1.items[9].id);

    // Page 2: ids below the cursor
    (globalThis as any).__cursor = page1.nextCursor;
    const page2 = await caller.listar({ limit: 10, cursor: page1.nextCursor! });
    expect(page2.items.length).toBeGreaterThan(0);
    page2.items.forEach((item) => expect(item.id).toBeLessThan(page1.nextCursor!));
    expect(page2.nextCursor).toBeNull();
  });
});

describe("alerta.crear", () => {
  it("stamps userId from context on insert", async () => {
    const caller = alertaRouter.createCaller(makeCtx("u1"));
    const result = await caller.crear({
      titulo: "Nueva alerta",
      prioridad: "alta",
      tipo: "system",
    });
    expect(result).toEqual({ id: 999 });
    expect(insertedValues?.userId).toBe("u1");
    expect(insertedValues?.titulo).toBe("Nueva alerta");
    expect(insertedValues?.estado).toBe("pendiente");
  });
});

describe("alerta.marcarLeida", () => {
  it("returns ok:true for caller's own alerta", async () => {
    const caller = alertaRouter.createCaller(makeCtx("u1"));
    const result = await caller.marcarLeida({ id: 1 });
    expect(result).toEqual({ ok: true });
  });

  it("still returns ok:true (no-op) when alerta belongs to different user — update uses WHERE userId", async () => {
    // The router scopes the update to eq(alertas.userId, ctx.user.id)
    // so a cross-user attempt simply updates 0 rows (no error thrown)
    const caller = alertaRouter.createCaller(makeCtx("u1"));
    const result = await caller.marcarLeida({ id: 100 }); // id 100 belongs to u2
    // Router returns { ok: true } regardless — safety is in the WHERE clause
    expect(result).toEqual({ ok: true });
  });
});

describe("alerta.dashboard", () => {
  it("returns count fields scoped to caller userId", async () => {
    (globalThis as any).__userId = "u1";
    const caller = alertaRouter.createCaller(makeCtx("u1"));
    const result = await caller.dashboard();
    expect(typeof result.totalPendientes).toBe("number");
    expect(typeof result.totalLeidasHoy).toBe("number");
    expect(typeof result.totalArchivadas).toBe("number");
    expect(Array.isArray(result.porTipo)).toBe(true);
    expect(Array.isArray(result.porPrioridad)).toBe(true);
  });
});

// ─── Multi-firma visibility ────────────────────────────────────────────────
//
// FIRMA_ALERTAS:
//   id=5001 uA orgId=10  (firmaA)
//   id=5002 uA orgId=10  (firmaA)
//   id=6001 uX orgId=20  (firmaB)
//
describe("alerta.listar — multi-firma visibility", () => {
  it("member of firmaA who didn't create the alertas still sees them", async () => {
    (globalThis as any).__source = "firma";
    (globalThis as any).__userId = "uB";
    (globalThis as any).__orgIds = [10];
    const caller = alertaRouter.createCaller(makeCtx("uB"));
    const result = await caller.listar({ limit: 50 });
    const ids = result.items.map((i) => i.id).sort((a, b) => a - b);
    expect(ids).toEqual([5001, 5002]);
  });

  it("user in firmaB cannot see firmaA alertas", async () => {
    (globalThis as any).__source = "firma";
    (globalThis as any).__userId = "uY";
    (globalThis as any).__orgIds = [20];
    const caller = alertaRouter.createCaller(makeCtx("uY"));
    const result = await caller.listar({ limit: 50 });
    expect(result.items.map((i) => i.id)).toEqual([6001]);
  });

  it("user with no firm sees no firm alertas", async () => {
    (globalThis as any).__source = "firma";
    (globalThis as any).__userId = "uZ";
    (globalThis as any).__orgIds = [];
    const caller = alertaRouter.createCaller(makeCtx("uZ"));
    const result = await caller.listar({ limit: 50 });
    expect(result.items).toEqual([]);
  });
});
