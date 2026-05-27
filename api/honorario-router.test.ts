import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit tests for honorarioRouter.
 *
 * Mock strategy mirrors causa-router.test.ts: vi.mock("./queries/connection")
 * returns a chainable fluent builder that drives row results via globalThis flags.
 */

type HonorarioRow = {
  id: number;
  userId: string;
  cliente: string;
  concepto: string;
  tipo: string;
  monto: number;
  montoPagado: number | null;
  estado: string;
  fechaVencimiento: Date | null;
  createdAt: Date;
};

const BASE_DATE = new Date("2025-01-15T00:00:00.000Z");

const HONORARIOS_U1: HonorarioRow[] = [
  { id: 1, userId: "u1", cliente: "Cliente A", concepto: "Def. laboral", tipo: "honorario", monto: 500000, montoPagado: 500000, estado: "pagado", fechaVencimiento: null, createdAt: BASE_DATE },
  { id: 2, userId: "u1", cliente: "Cliente B", concepto: "Asesoría", tipo: "honorario", monto: 300000, montoPagado: 100000, estado: "pagado_parcial", fechaVencimiento: new Date("2025-01-01"), createdAt: BASE_DATE },
  { id: 3, userId: "u1", cliente: "Cliente C", concepto: "Redacción", tipo: "honorario", monto: 200000, montoPagado: null, estado: "pendiente", fechaVencimiento: new Date("2025-02-01"), createdAt: BASE_DATE },
];

const HONORARIOS_U2: HonorarioRow[] = [
  { id: 50, userId: "u2", cliente: "Otro", concepto: "Nada", tipo: "honorario", monto: 100000, montoPagado: null, estado: "pendiente", fechaVencimiento: null, createdAt: BASE_DATE },
];

const ALL_HONORARIOS = [...HONORARIOS_U1, ...HONORARIOS_U2];

let insertedValues: Record<string, unknown> | null = null;
let updatedValues: Record<string, unknown> | null = null;
// Track which id was queried for select-by-id
let lastSelectId: number | null = null;

vi.mock("./queries/connection", () => {
  return {
    getDb: () => {
      const db: any = {
        _limitN: null as number | null,
        select: function () { return this; },
        from: function () { return this; },
        where: function (_cond?: unknown) { return this; },
        orderBy: function () { return this; },
        limit: function (n: number) {
          const userId = (globalThis as any).__userId as string;
          const cursor = (globalThis as any).__cursor as number | null;
          const filterById = (globalThis as any).__selectId as number | null;
          let rows = ALL_HONORARIOS.filter((r) => r.userId === userId);
          if (filterById != null) {
            rows = rows.filter((r) => r.id === filterById);
          }
          if (cursor != null) rows = rows.filter((r) => r.id < cursor);
          rows.sort((a, b) => b.id - a.id);
          return Promise.resolve(rows.slice(0, n));
        },
        // Support direct await (no .limit) — for estadisticas which awaits the chain
        then: (resolve: (v: HonorarioRow[]) => void) => {
          const userId = (globalThis as any).__userId as string;
          const rows = ALL_HONORARIOS.filter((r) => r.userId === userId);
          return Promise.resolve(rows).then(resolve);
        },
        insert: (_table: unknown) => ({
          values: (v: Record<string, unknown>) => {
            insertedValues = v;
            return { $returningId: () => Promise.resolve([{ id: 888 }]) };
          },
        }),
        update: (_table: unknown) => ({
          set: (v: Record<string, unknown>) => {
            updatedValues = v;
            return { where: () => Promise.resolve() };
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
    sql: ((..._args: unknown[]) => ({ _op: "sql" })) as any,
    lt: (..._args: unknown[]) => ({ _op: "lt" }),
  };
});

// Mock the cobranza lib imports (not under test here)
vi.mock("./lib/cobranza/reportes", () => ({
  generarEstadoCuenta: () => "# Estado de cuenta",
  generarReporteCobranza: () => ({ markdown: "# Reporte" }),
  generarCartaCobranza: () => "# Carta",
}));

const { honorarioRouter } = await import("./honorario-router");

function makeCtx(userId: string) {
  return {
    user: { id: userId, role: "abogado" as const, email: `${userId}@test.cl` },
  } as any;
}

beforeEach(() => {
  (globalThis as any).__userId = "u1";
  (globalThis as any).__cursor = null;
  (globalThis as any).__selectId = null;
  insertedValues = null;
  updatedValues = null;
});

describe("honorario.listar", () => {
  it("returns items + nextCursor for caller's honorarios only", async () => {
    (globalThis as any).__userId = "u1";
    const caller = honorarioRouter.createCaller(makeCtx("u1"));
    const result = await caller.listar({ limit: 2 });
    expect(result.items).toHaveLength(2);
    result.items.forEach((i) => expect(i.userId).toBe("u1"));
    expect(result.nextCursor).toBe(result.items[1].id);
  });

  it("does not include another user's honorarios", async () => {
    (globalThis as any).__userId = "u1";
    const caller = honorarioRouter.createCaller(makeCtx("u1"));
    const result = await caller.listar({ limit: 100 });
    const foreign = result.items.filter((i) => i.userId !== "u1");
    expect(foreign).toHaveLength(0);
  });
});

describe("honorario.crear", () => {
  it("stamps userId from context on insert", async () => {
    const caller = honorarioRouter.createCaller(makeCtx("u1"));
    const result = await caller.crear({
      cliente: "Nuevo cliente",
      concepto: "Asesoría",
      monto: 150000,
    });
    expect(result).toEqual({ id: 888 });
    expect(insertedValues?.userId).toBe("u1");
    expect(insertedValues?.cliente).toBe("Nuevo cliente");
    expect(insertedValues?.monto).toBe(150000);
  });
});

describe("honorario.registrarPago", () => {
  it("returns ok:false when honorario belongs to different user (not found)", async () => {
    // u1 tries to pay honorario id=50 which belongs to u2
    (globalThis as any).__userId = "u1";
    (globalThis as any).__selectId = 50;
    const caller = honorarioRouter.createCaller(makeCtx("u1"));
    // The mock returns rows filtered by userId "u1", so id=50 (u2's) won't match
    const result = await caller.registrarPago({ id: 50, monto: 50000 });
    expect(result).toEqual({ ok: false });
  });

  it("returns ok:true when honorario belongs to caller", async () => {
    (globalThis as any).__userId = "u1";
    (globalThis as any).__selectId = 2;
    const caller = honorarioRouter.createCaller(makeCtx("u1"));
    const result = await caller.registrarPago({ id: 2, monto: 50000 });
    expect(result).toEqual({ ok: true });
    expect(updatedValues?.montoPagado).toBe(150000); // 100000 + 50000
  });
});

describe("honorario.estadisticas", () => {
  it("returns aggregated totals for caller only", async () => {
    (globalThis as any).__userId = "u1";
    const caller = honorarioRouter.createCaller(makeCtx("u1"));
    const stats = await caller.estadisticas();
    // u1 has: 500000 + 300000 + 200000 = 1000000 facturado
    expect(stats.totalFacturado).toBe(1000000);
    // montoPagado: 500000 + 100000 + 0 = 600000
    expect(stats.totalPagado).toBe(600000);
    expect(stats.porCobrar).toBe(400000);
    expect(stats.totalDocumentos).toBe(3);
    // pendiente + pagado_parcial = 2
    expect(stats.pendientes).toBe(2);
  });
});

describe("honorario.calcularIntereses", () => {
  it("returns interest calculation for a known overdue honorario", async () => {
    // honorario id=2: monto=300000, montoPagado=100000, fechaVencimiento=2025-01-01
    (globalThis as any).__userId = "u1";
    (globalThis as any).__selectId = 2;
    const caller = honorarioRouter.createCaller(makeCtx("u1"));
    const result = await caller.calcularIntereses({ id: 2 });
    expect(result).not.toBeNull();
    expect(result?.honorarioId).toBe(2);
    expect(result?.interes).not.toBeNull();
    const interes = result!.interes!;
    // montoPendiente = 300000 - 100000 = 200000
    expect(interes.montoPendiente).toBe(200000);
    // dias > 0 (2025-01-01 is in the past relative to 2026-05-27)
    expect(interes.diasMora).toBeGreaterThan(0);
    expect(interes.interesCalculado).toBeGreaterThan(0);
    expect(interes.totalConInteres).toBe(interes.montoPendiente + interes.interesCalculado);
  });

  it("returns null for honorario not found (cross-tenant)", async () => {
    // u1 tries to access honorario id=50 belonging to u2
    (globalThis as any).__userId = "u1";
    (globalThis as any).__selectId = 50;
    const caller = honorarioRouter.createCaller(makeCtx("u1"));
    const result = await caller.calcularIntereses({ id: 50 });
    expect(result).toBeNull();
  });
});
