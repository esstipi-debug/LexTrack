import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit tests for checklistRouter.
 *
 * All DB calls are mocked — no real connection.
 * Mock style matches causa-router.test.ts / alerta-router.test.ts.
 */

// ─── Fixture data ──────────────────────────────────────────────────────────

type TemplateRow = { id: number; nombre: string; descripcion: string | null };
type ItemRow = { id: number; templateId: number; texto: string; orden: number };
type EjecucionRow = { id: number; userId: string; orgId?: number | null; templateId: number; titulo: string; causaId: number | null };
type CompletadoRow = { id: number; userId: string; ejecucionId: number; itemId: number; completado: boolean; notas: string | null; completadoAt: Date | null };

const TEMPLATES: TemplateRow[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  nombre: `Template ${i + 1}`,
  descripcion: null,
}));

const ITEMS_T1: ItemRow[] = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  templateId: 1,
  texto: `Item ${i + 1}`,
  orden: i + 1,
}));

const EJECUCIONES_U1: EjecucionRow[] = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  userId: "u1",
  templateId: 1,
  titulo: `Ejecucion ${i + 1}`,
  causaId: null,
}));

const EJECUCIONES_U2: EjecucionRow[] = [
  { id: 100, userId: "u2", templateId: 1, titulo: "Ejecucion U2", causaId: null },
];

const ALL_EJECUCIONES = [...EJECUCIONES_U1, ...EJECUCIONES_U2];

// Multi-firma fixture: ejecuciones for firmaA (orgId=10) vs firmaB (orgId=20).
const FIRMA_EJECUCIONES: EjecucionRow[] = [
  { id: 9501, userId: "uA", orgId: 10, templateId: 1, titulo: "Ejec firmaA #1", causaId: null },
  { id: 9502, userId: "uA", orgId: 10, templateId: 1, titulo: "Ejec firmaA #2", causaId: null },
  { id: 9601, userId: "uX", orgId: 20, templateId: 1, titulo: "Ejec firmaB #1", causaId: null },
];

// Tracks what was inserted / updated
let insertedEjecucion: Record<string, unknown> | null = null;
let insertedCompletado: Record<string, unknown> | null = null;
let updatedCompletado: Record<string, unknown> | null = null;

// Drive which completados the mock returns
let mockCompletados: CompletadoRow[] = [];

vi.mock("./queries/connection", () => {
  return {
    getDb: () => {
      const db: any = {
        select: () => db,
        from: () => db,
        where: (_cond?: unknown) => db,
        orderBy: () => db,
        // limit: drives pagination, and the visibility "exists?" check for ejecuciones.
        limit: (n: number) => {
          const mode = (globalThis as any).__dbMode as string;

          if (mode === "templates") {
            const cursor = (globalThis as any).__cursor as number | null;
            let rows = [...TEMPLATES];
            if (cursor != null) rows = rows.filter((r) => r.id < cursor);
            rows.sort((a, b) => b.id - a.id);
            return Promise.resolve(rows.slice(0, n));
          }

          if (mode === "items") {
            const cursor = (globalThis as any).__cursor as number | null;
            let rows = [...ITEMS_T1];
            if (cursor != null) rows = rows.filter((r) => r.id < cursor);
            rows.sort((a, b) => b.id - a.id);
            return Promise.resolve(rows.slice(0, n));
          }

          if (mode === "ejecuciones") {
            const userId = (globalThis as any).__userId as string;
            const cursor = (globalThis as any).__cursor as number | null;
            const source = (globalThis as any).__source as "all" | "firma" | undefined;
            const orgIds = ((globalThis as any).__orgIds as number[] | undefined) ?? [];
            const dataset = source === "firma" ? FIRMA_EJECUCIONES : ALL_EJECUCIONES;
            let rows = dataset.filter((r) =>
              source === "firma"
                ? r.userId === userId || (r.orgId != null && orgIds.includes(r.orgId))
                : r.userId === userId,
            );
            if (cursor != null) rows = rows.filter((r) => r.id < cursor);
            rows.sort((a, b) => b.id - a.id);
            return Promise.resolve(rows.slice(0, n));
          }

          // For other modes (progreso / completarItem call `.limit(1)` to check
          // ejecucion visibility), return a single stub row by default so the
          // visibility gate passes. Tests can set __ejecVisible=false to simulate
          // a cross-tenant lookup.
          if (n === 1) {
            const visible = (globalThis as any).__ejecVisible;
            if (visible === false) return Promise.resolve([]);
            return Promise.resolve([{ id: 1 }]);
          }

          return Promise.resolve([]);
        },
        // then: used when awaiting without .limit().
        // - getUserOrgIds expects rows with .orgId
        // - progreso / completarItem expect the completados list (mockCompletados)
        // Returning mockCompletados is safe for getUserOrgIds since it maps
        // to undefineds — the mock filter on `limit` ignores predicates anyway.
        then: (resolve: (v: unknown[]) => void) => {
          return Promise.resolve(mockCompletados).then(resolve);
        },
        insert: (_table: unknown) => ({
          values: (v: Record<string, unknown>) => {
            const mode = (globalThis as any).__dbMode as string;
            if (mode === "ejecuciones_insert") {
              insertedEjecucion = v;
            } else {
              insertedCompletado = v;
            }
            return {
              $returningId: () => Promise.resolve([{ id: 999 }]),
            };
          },
        }),
        update: (_table: unknown) => ({
          set: (v: Record<string, unknown>) => {
            updatedCompletado = v;
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

const { checklistRouter } = await import("./checklist-router");

function makeCtx(userId: string, role: "abogado" | "admin" = "abogado") {
  return {
    user: { id: userId, role, email: `${userId}@test.cl` },
  } as any;
}

beforeEach(() => {
  (globalThis as any).__userId = "u1";
  (globalThis as any).__cursor = null;
  (globalThis as any).__dbMode = "templates";
  (globalThis as any).__source = "all";
  (globalThis as any).__orgIds = [];
  (globalThis as any).__ejecVisible = true;
  insertedEjecucion = null;
  insertedCompletado = null;
  updatedCompletado = null;
  mockCompletados = [];
});

// ─── checklist.templates ───────────────────────────────────────────────────

describe("checklist.templates", () => {
  it("returns paginated list of templates (shared global — no userId filter)", async () => {
    (globalThis as any).__dbMode = "templates";
    const caller = checklistRouter.createCaller(makeCtx("u1"));
    const result = await caller.templates({ limit: 5 });
    expect(result.items).toHaveLength(5);
    // desc ordering: highest id first
    expect(result.items[0].id).toBe(12);
    expect(result.nextCursor).toBe(result.items[4].id);
  });

  it("returns all templates when limit exceeds dataset, nextCursor is null", async () => {
    (globalThis as any).__dbMode = "templates";
    const caller = checklistRouter.createCaller(makeCtx("u1"));
    const result = await caller.templates({ limit: 20 });
    expect(result.items).toHaveLength(12);
    expect(result.nextCursor).toBeNull();
  });

  it("cursor pagination: page 2 returns templates with id below cursor", async () => {
    (globalThis as any).__dbMode = "templates";
    const caller = checklistRouter.createCaller(makeCtx("u1"));

    const page1 = await caller.templates({ limit: 5 });
    expect(page1.items).toHaveLength(5);
    const cursor = page1.nextCursor!;

    (globalThis as any).__cursor = cursor;
    const page2 = await caller.templates({ limit: 5, cursor });
    expect(page2.items.length).toBeGreaterThan(0);
    page2.items.forEach((item) => expect(item.id).toBeLessThan(cursor));
  });
});

// ─── checklist.items ───────────────────────────────────────────────────────

describe("checklist.items", () => {
  it("returns paginated items for a given templateId", async () => {
    (globalThis as any).__dbMode = "items";
    const caller = checklistRouter.createCaller(makeCtx("u1"));
    const result = await caller.items({ templateId: 1, limit: 5 });
    expect(result.items).toHaveLength(5);
    expect(result.nextCursor).toBe(result.items[4].id);
  });

  it("returns all items when limit is large, nextCursor is null", async () => {
    (globalThis as any).__dbMode = "items";
    const caller = checklistRouter.createCaller(makeCtx("u1"));
    const result = await caller.items({ templateId: 1, limit: 20 });
    expect(result.items).toHaveLength(8);
    expect(result.nextCursor).toBeNull();
  });
});

// ─── checklist.ejecutar ────────────────────────────────────────────────────

describe("checklist.ejecutar", () => {
  it("creates an ejecucion stamped with userId from context", async () => {
    (globalThis as any).__dbMode = "ejecuciones_insert";
    const caller = checklistRouter.createCaller(makeCtx("u1"));
    const result = await caller.ejecutar({ templateId: 1, titulo: "Nueva ejecucion" });
    expect(result).toEqual({ id: 999 });
    expect(insertedEjecucion?.userId).toBe("u1");
    expect(insertedEjecucion?.templateId).toBe(1);
    expect(insertedEjecucion?.titulo).toBe("Nueva ejecucion");
  });

  it("persists optional causaId when provided", async () => {
    (globalThis as any).__dbMode = "ejecuciones_insert";
    const caller = checklistRouter.createCaller(makeCtx("u1"));
    await caller.ejecutar({ templateId: 2, titulo: "Con causa", causaId: 42 });
    expect(insertedEjecucion?.causaId).toBe(42);
  });
});

// ─── checklist.ejecuciones ─────────────────────────────────────────────────

describe("checklist.ejecuciones", () => {
  it("returns only the caller's own ejecuciones", async () => {
    (globalThis as any).__dbMode = "ejecuciones";
    (globalThis as any).__userId = "u1";
    const caller = checklistRouter.createCaller(makeCtx("u1"));
    const result = await caller.ejecuciones({ limit: 100 });
    expect(result.items.length).toBe(6);
    result.items.forEach((item) => expect(item.userId).toBe("u1"));
  });

  it("u2 caller does not see u1 ejecuciones", async () => {
    (globalThis as any).__dbMode = "ejecuciones";
    (globalThis as any).__userId = "u2";
    const caller = checklistRouter.createCaller(makeCtx("u2"));
    const result = await caller.ejecuciones({ limit: 100 });
    expect(result.items.length).toBe(1);
    expect(result.items[0].userId).toBe("u2");
  });
});

// ─── checklist.progreso ────────────────────────────────────────────────────

describe("checklist.progreso", () => {
  it("returns completados for the ejecucion owned by caller", async () => {
    mockCompletados = [
      { id: 1, userId: "u1", ejecucionId: 5, itemId: 1, completado: true, notas: null, completadoAt: new Date() },
      { id: 2, userId: "u1", ejecucionId: 5, itemId: 2, completado: false, notas: null, completadoAt: null },
    ];
    const caller = checklistRouter.createCaller(makeCtx("u1"));
    const result = await caller.progreso({ ejecucionId: 5 });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("returns empty array when cross-tenant ejecucionId is used", async () => {
    // Mock returns no completados for this user + ejecucionId
    mockCompletados = [];
    const caller = checklistRouter.createCaller(makeCtx("u2"));
    const result = await caller.progreso({ ejecucionId: 5 });
    expect(result).toHaveLength(0);
  });
});

// ─── checklist.completarItem ───────────────────────────────────────────────

describe("checklist.completarItem", () => {
  it("inserts a new completado record when none exists (completado=true)", async () => {
    mockCompletados = []; // no existing record
    const caller = checklistRouter.createCaller(makeCtx("u1"));
    const result = await caller.completarItem({
      ejecucionId: 1,
      itemId: 1,
      completado: true,
      notas: "Revisado",
    });
    expect(result).toEqual({ ok: true });
    expect(insertedCompletado?.userId).toBe("u1");
    expect(insertedCompletado?.completado).toBe(true);
    expect(insertedCompletado?.notas).toBe("Revisado");
  });

  it("updates existing record when called a second time (idempotent)", async () => {
    // Simulate existing record
    mockCompletados = [
      { id: 7, userId: "u1", ejecucionId: 1, itemId: 1, completado: true, notas: null, completadoAt: new Date() },
    ];
    const caller = checklistRouter.createCaller(makeCtx("u1"));
    const result = await caller.completarItem({
      ejecucionId: 1,
      itemId: 1,
      completado: true,
    });
    expect(result).toEqual({ ok: true });
    // Should update, not insert
    expect(updatedCompletado?.completado).toBe(true);
    expect(insertedCompletado).toBeNull();
  });

  it("cross-tenant: completarItem scopes WHERE clause to userId (no-op for other user's items)", async () => {
    // Simulate cross-tenant: the visibility "exists?" check finds no row,
    // so the router short-circuits and does NOT insert.
    mockCompletados = [];
    (globalThis as any).__dbMode = "none"; // disable templates default → falls through to n===1 stub
    (globalThis as any).__ejecVisible = false;
    const caller = checklistRouter.createCaller(makeCtx("u2"));
    const result = await caller.completarItem({
      ejecucionId: 1,
      itemId: 1,
      completado: true,
    });
    // Router always returns { ok: true } — safety is in the visibility gate
    expect(result).toEqual({ ok: true });
    // No insert happens because the visibility gate short-circuited
    expect(insertedCompletado).toBeNull();
  });
});

// ─── Multi-firma visibility ────────────────────────────────────────────────
describe("checklist.ejecuciones — multi-firma visibility", () => {
  it("firm member sees colleagues' ejecuciones in the same firm", async () => {
    (globalThis as any).__dbMode = "ejecuciones";
    (globalThis as any).__source = "firma";
    (globalThis as any).__userId = "uB";
    (globalThis as any).__orgIds = [10];
    const caller = checklistRouter.createCaller(makeCtx("uB"));
    const result = await caller.ejecuciones({ limit: 50 });
    const ids = result.items.map((i) => i.id).sort((a, b) => a - b);
    expect(ids).toEqual([9501, 9502]);
  });

  it("user in other firm cannot see firmaA ejecuciones", async () => {
    (globalThis as any).__dbMode = "ejecuciones";
    (globalThis as any).__source = "firma";
    (globalThis as any).__userId = "uY";
    (globalThis as any).__orgIds = [20];
    const caller = checklistRouter.createCaller(makeCtx("uY"));
    const result = await caller.ejecuciones({ limit: 50 });
    expect(result.items.map((i) => i.id)).toEqual([9601]);
  });

  it("user with no firm sees nothing from firma fixture", async () => {
    (globalThis as any).__dbMode = "ejecuciones";
    (globalThis as any).__source = "firma";
    (globalThis as any).__userId = "uZ";
    (globalThis as any).__orgIds = [];
    const caller = checklistRouter.createCaller(makeCtx("uZ"));
    const result = await caller.ejecuciones({ limit: 50 });
    expect(result.items).toEqual([]);
  });
});
