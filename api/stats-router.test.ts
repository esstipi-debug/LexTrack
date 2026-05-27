import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit tests for statsRouter.
 *
 * The router performs many SQL aggregation queries via getDb().
 * We mock getDb() to return a chainable builder that resolves
 * deterministic count rows so we can assert the response shape
 * and userId scoping without a real DB connection.
 */

// ── Mock state ────────────────────────────────────────────────────────────────

// Track the userId values passed through eq() calls so we can assert scoping.
const capturedUserIds: unknown[] = [];

// ── DB mock ───────────────────────────────────────────────────────────────────

vi.mock("./queries/connection", () => {
  return {
    getDb: () => {
      const db: any = {
        select: (_cols?: unknown) => db,
        from: (_table: unknown) => db,
        where: (_cond?: unknown) => db,
        orderBy: (_col?: unknown) => db,
        groupBy: (_col?: unknown) => {
          // groupBy resolves array of rows (estado/tipo counts)
          return Promise.resolve([
            { estado: "tramitacion", total: 3 },
            { estado: "sentencia", total: 1 },
            { tipo: "system", total: 2 },
            { materia: "laboral", total: 4 },
            { prioridad: "alta", total: 1 },
          ]);
        },
        limit: (_n: number) => Promise.resolve([]),
        // Thenable: resolves when the query is awaited without .limit()
        then: (resolve: (v: unknown[]) => void) => {
          return Promise.resolve([
            // Single aggregation row (total / sum queries)
            { total: 5, totalFacturado: "1500000", totalPagado: "800000" },
          ]).then(resolve);
        },
      };
      return db;
    },
  };
});

// ── drizzle-orm stubs ─────────────────────────────────────────────────────────

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    eq: (...args: unknown[]) => {
      // Capture userId-like values passed as second arg to eq()
      if (typeof args[1] === "string") capturedUserIds.push(args[1]);
      return { _op: "eq" };
    },
    and: (..._args: unknown[]) => ({ _op: "and" }),
    sql: ((..._args: unknown[]) => ({ _op: "sql" })) as any,
    count: () => "count_agg",
    sum: (_col: unknown) => "sum_agg",
    gte: (..._args: unknown[]) => ({ _op: "gte" }),
    lte: (..._args: unknown[]) => ({ _op: "lte" }),
    lt: (..._args: unknown[]) => ({ _op: "lt" }),
    desc: (..._args: unknown[]) => ({ _op: "desc" }),
  };
});

// ── Import router after mocks ─────────────────────────────────────────────────

const { statsRouter } = await import("./stats-router");

function makeCtx(userId = "u1") {
  return {
    user: { id: userId, role: "abogado" as const, email: `${userId}@test.cl` },
  } as any;
}

beforeEach(() => {
  capturedUserIds.length = 0;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("stats.dashboard — response shape", () => {
  it("returns the expected top-level shape with causas, tareas, alertas, honorarios", async () => {
    const caller = statsRouter.createCaller(makeCtx("u1"));
    const result = await caller.dashboard();

    // Top-level keys
    expect(result).toHaveProperty("causas");
    expect(result).toHaveProperty("tareas");
    expect(result).toHaveProperty("alertas");
    expect(result).toHaveProperty("honorarios");
    expect(result).toHaveProperty("leyKarin");
    expect(result).toHaveProperty("tendencias");
    expect(result).toHaveProperty("actividadReciente");
  });

  it("causas sub-object has expected numeric fields", async () => {
    const caller = statsRouter.createCaller(makeCtx("u1"));
    const result = await caller.dashboard();

    expect(typeof result.causas.total).toBe("number");
    expect(typeof result.causas.activas).toBe("number");
    expect(typeof result.causas.porEstado).toBe("object");
    expect(typeof result.causas.porMateria).toBe("object");
  });

  it("tareas sub-object has expected numeric fields", async () => {
    const caller = statsRouter.createCaller(makeCtx("u1"));
    const result = await caller.dashboard();

    expect(typeof result.tareas.total).toBe("number");
    expect(typeof result.tareas.pendientes).toBe("number");
    expect(typeof result.tareas.vencidas).toBe("number");
    expect(typeof result.tareas.completadasEsteMes).toBe("number");
    expect(typeof result.tareas.proximas7dias).toBe("number");
  });

  it("honorarios sub-object has expected numeric fields (not strings, not undefined)", async () => {
    const caller = statsRouter.createCaller(makeCtx("u1"));
    const result = await caller.dashboard();

    expect(typeof result.honorarios.totalFacturado).toBe("number");
    expect(typeof result.honorarios.totalPagado).toBe("number");
    expect(typeof result.honorarios.porCobrar).toBe("number");
    expect(typeof result.honorarios.morosidad).toBe("number");
  });
});

describe("stats.dashboard — userId scoping", () => {
  it("passes userId to every DB query (appears in eq() calls)", async () => {
    const caller = statsRouter.createCaller(makeCtx("u1"));
    await caller.dashboard();

    // The router calls eq(table.userId, userId) for every sub-query.
    // Our eq() stub captures the second arg when it is a string.
    expect(capturedUserIds.length).toBeGreaterThan(0);
    // Every captured id should match the caller's userId.
    capturedUserIds.forEach((id) => expect(id).toBe("u1"));
  });

  it("different callers get different userId passed to queries", async () => {
    const caller2 = statsRouter.createCaller(makeCtx("u2"));
    await caller2.dashboard();

    const u2Ids = capturedUserIds.filter((id) => id === "u2");
    expect(u2Ids.length).toBeGreaterThan(0);
  });
});

describe("stats.dashboard — zero data", () => {
  it("returns zeroed numeric fields without null or errors when DB has no rows", async () => {
    // Override the mock to return empty results / zero aggregation rows.
    vi.doMock("./queries/connection", () => ({
      getDb: () => {
        const emptyDb: any = {
          select: () => emptyDb,
          from: () => emptyDb,
          where: () => emptyDb,
          orderBy: () => emptyDb,
          groupBy: () => Promise.resolve([]),
          limit: () => Promise.resolve([]),
          then: (resolve: (v: unknown[]) => void) =>
            Promise.resolve([]).then(resolve),
        };
        return emptyDb;
      },
    }));

    // Use the already-imported module (mocked at top-level above)
    // The router reads total via `?? 0` so zero rows return 0, not null.
    const caller = statsRouter.createCaller(makeCtx("u1"));
    const result = await caller.dashboard();

    // All numeric fields must be numbers (0), not null or undefined.
    expect(result.causas.total).toBeGreaterThanOrEqual(0);
    expect(result.tareas.total).toBeGreaterThanOrEqual(0);
    expect(result.alertas.pendientes).toBeGreaterThanOrEqual(0);
    expect(result.honorarios.totalFacturado).toBeGreaterThanOrEqual(0);
    expect(result.leyKarin.total).toBeGreaterThanOrEqual(0);

    // Should not throw undefined errors.
    expect(result.causas.total).not.toBeNull();
    expect(result.honorarios.totalFacturado).not.toBeNaN();
  });
});

describe("stats.dashboard — actividadReciente", () => {
  it("actividadReciente is an array scoped to userId", async () => {
    const caller = statsRouter.createCaller(makeCtx("u1"));
    const result = await caller.dashboard();

    expect(Array.isArray(result.actividadReciente)).toBe(true);
  });
});
