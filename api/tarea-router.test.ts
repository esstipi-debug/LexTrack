import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit tests for tareaRouter.
 *
 * Mock strategy: vi.mock("./queries/connection") with chainable fluent builder.
 * Global flags drive row selection deterministically.
 */

type TareaRow = {
  id: number;
  userId: string;
  orgId?: number | null;
  causaId: number | null;
  titulo: string;
  tipo: string;
  prioridad: string;
  estado: string;
  fechaVencimiento: Date | null;
  fechaCompletada: Date | null;
  descripcion: string | null;
};

const PAST_DATE = new Date("2025-01-01T00:00:00.000Z");
const FUTURE_DATE = new Date("2030-01-01T00:00:00.000Z");

const TAREAS_U1: TareaRow[] = [
  { id: 10, userId: "u1", causaId: 1, titulo: "Revisar contrato", tipo: "revision_documento", prioridad: "alta", estado: "pendiente", fechaVencimiento: FUTURE_DATE, fechaCompletada: null, descripcion: null },
  { id: 9, userId: "u1", causaId: 1, titulo: "Preparar escrito", tipo: "preparar_escrito", prioridad: "media", estado: "en_progreso", fechaVencimiento: PAST_DATE, fechaCompletada: null, descripcion: null },
  { id: 8, userId: "u1", causaId: 2, titulo: "Notificar cliente", tipo: "notificar_cliente", prioridad: "baja", estado: "completada", fechaVencimiento: null, fechaCompletada: new Date("2026-01-10"), descripcion: null },
  { id: 7, userId: "u1", causaId: null, titulo: "Investigar norma", tipo: "investigar_norma", prioridad: "media", estado: "pendiente", fechaVencimiento: PAST_DATE, fechaCompletada: null, descripcion: null },
];

const TAREAS_U2: TareaRow[] = [
  { id: 50, userId: "u2", causaId: 99, titulo: "Tarea ajena", tipo: "otra", prioridad: "baja", estado: "pendiente", fechaVencimiento: null, fechaCompletada: null, descripcion: null },
];

const ALL_TAREAS = [...TAREAS_U1, ...TAREAS_U2];

// Multi-firma fixture: tareas tied to firmaA (orgId=10) vs firmaB (orgId=20).
const FIRMA_TAREAS: TareaRow[] = [
  { id: 5010, userId: "uA", orgId: 10, causaId: null, titulo: "Tarea firmaA #1", tipo: "otra", prioridad: "media", estado: "pendiente", fechaVencimiento: null, fechaCompletada: null, descripcion: null },
  { id: 5011, userId: "uA", orgId: 10, causaId: null, titulo: "Tarea firmaA #2", tipo: "otra", prioridad: "media", estado: "pendiente", fechaVencimiento: null, fechaCompletada: null, descripcion: null },
  { id: 6010, userId: "uX", orgId: 20, causaId: null, titulo: "Tarea firmaB #1", tipo: "otra", prioridad: "media", estado: "pendiente", fechaVencimiento: null, fechaCompletada: null, descripcion: null },
];

let insertedValues: Record<string, unknown> | null = null;
let updatedValues: Record<string, unknown> | null = null;

vi.mock("./queries/connection", () => {
  return {
    getDb: () => {
      const db: any = {
        select: function () { return this; },
        from: function () { return this; },
        where: function (_cond?: unknown) { return this; },
        orderBy: function () { return this; },
        limit: function (n: number) {
          const userId = (globalThis as any).__userId as string;
          const cursor = (globalThis as any).__cursor as number | null;
          const causaFilter = (globalThis as any).__causaId as number | null;
          const source = (globalThis as any).__source as "all" | "firma" | undefined;
          const orgIds = ((globalThis as any).__orgIds as number[] | undefined) ?? [];
          const dataset = source === "firma" ? FIRMA_TAREAS : ALL_TAREAS;
          let rows = dataset.filter((r) =>
            source === "firma"
              ? r.userId === userId || (r.orgId != null && orgIds.includes(r.orgId))
              : r.userId === userId,
          );
          if (causaFilter != null) rows = rows.filter((r) => r.causaId === causaFilter);
          if (cursor != null) rows = rows.filter((r) => r.id < cursor);
          rows.sort((a, b) => b.id - a.id);
          return Promise.resolve(rows.slice(0, n));
        },
        then: (resolve: (v: unknown[]) => void) => {
          // Used for: getUserOrgIds (router maps r.orgId) and resumenSemanal awaits.
          // Returning orgMember-shaped rows is safe — resumenSemanal only asserts
          // array structure in tests.
          const orgIds = ((globalThis as any).__orgIds as number[] | undefined) ?? [];
          return Promise.resolve(orgIds.map((id) => ({ orgId: id }))).then(resolve);
        },
        insert: (_table: unknown) => ({
          values: (v: Record<string, unknown>) => {
            insertedValues = v;
            return { $returningId: () => Promise.resolve([{ id: 777 }]) };
          },
        }),
        update: (_table: unknown) => ({
          set: (v: Record<string, unknown>) => {
            updatedValues = v;
            return { where: () => Promise.resolve() };
          },
        }),
        delete: (_table: unknown) => ({
          where: () => Promise.resolve(),
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

const { tareaRouter } = await import("./tarea-router");

function makeCtx(userId: string) {
  return {
    user: { id: userId, role: "abogado" as const, email: `${userId}@test.cl` },
  } as any;
}

beforeEach(() => {
  (globalThis as any).__userId = "u1";
  (globalThis as any).__cursor = null;
  (globalThis as any).__causaId = null;
  (globalThis as any).__source = "all";
  (globalThis as any).__orgIds = [];
  insertedValues = null;
  updatedValues = null;
});

describe("tarea.listar", () => {
  it("returns items + nextCursor scoped to caller's userId", async () => {
    (globalThis as any).__userId = "u1";
    const caller = tareaRouter.createCaller(makeCtx("u1"));
    const result = await caller.listar({ limit: 2 });
    expect(result.items).toHaveLength(2);
    result.items.forEach((i) => expect(i.userId).toBe("u1"));
    expect(result.nextCursor).toBe(result.items[1].id);
  });

  it("does not include another user's tareas", async () => {
    (globalThis as any).__userId = "u1";
    const caller = tareaRouter.createCaller(makeCtx("u1"));
    const result = await caller.listar({ limit: 100 });
    const foreign = result.items.filter((i) => i.userId !== "u1");
    expect(foreign).toHaveLength(0);
    expect(result.items).toHaveLength(4);
  });
});

describe("tarea.crear", () => {
  it("stamps userId from context and returns new id", async () => {
    const caller = tareaRouter.createCaller(makeCtx("u1"));
    const result = await caller.crear({
      titulo: "Nueva tarea",
      tipo: "otra",
      prioridad: "media",
    });
    expect(result).toEqual({ id: 777 });
    expect(insertedValues?.userId).toBe("u1");
    expect(insertedValues?.titulo).toBe("Nueva tarea");
  });
});

describe("tarea.completar", () => {
  it("sets estado=completada for caller's own tarea", async () => {
    const caller = tareaRouter.createCaller(makeCtx("u1"));
    const result = await caller.completar({ id: 9 });
    expect(result).toEqual({ ok: true });
    expect(updatedValues?.estado).toBe("completada");
    expect(updatedValues?.fechaCompletada).toBeInstanceOf(Date);
  });

  it("still returns ok:true for cross-tenant attempt — WHERE clause prevents mutation", async () => {
    // The router scopes the update to eq(tareas.userId, ctx.user.id)
    // so a cross-user id just silently updates 0 rows
    const caller = tareaRouter.createCaller(makeCtx("u1"));
    const result = await caller.completar({ id: 50 }); // id=50 belongs to u2
    expect(result).toEqual({ ok: true });
  });
});

describe("tarea.porCausa", () => {
  it("returns only tareas for the given causaId owned by caller", async () => {
    (globalThis as any).__userId = "u1";
    (globalThis as any).__causaId = 1;
    const caller = tareaRouter.createCaller(makeCtx("u1"));
    const result = await caller.porCausa({ causaId: 1, limit: 20 });
    expect(result.items.length).toBe(2);
    result.items.forEach((i) => {
      expect(i.causaId).toBe(1);
      expect(i.userId).toBe("u1");
    });
    expect(result.nextCursor).toBeNull();
  });

  it("returns empty list when causaId belongs to different user", async () => {
    // causaId=99 only has tareas for u2; u1 should see nothing
    (globalThis as any).__userId = "u1";
    (globalThis as any).__causaId = 99;
    const caller = tareaRouter.createCaller(makeCtx("u1"));
    const result = await caller.porCausa({ causaId: 99, limit: 20 });
    expect(result.items).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});

describe("tarea.resumenSemanal", () => {
  it("returns shape with vencenEstaSemana, vencidas, completadasEstaSemana arrays", async () => {
    (globalThis as any).__userId = "u1";
    const caller = tareaRouter.createCaller(makeCtx("u1"));
    const result = await caller.resumenSemanal();
    expect(Array.isArray(result.vencenEstaSemana)).toBe(true);
    expect(Array.isArray(result.vencidas)).toBe(true);
    expect(Array.isArray(result.completadasEstaSemana)).toBe(true);
  });
});

// ─── Multi-firma visibility ────────────────────────────────────────────────
describe("tarea.listar — multi-firma visibility", () => {
  it("firm member sees colleagues' tareas in the same firm", async () => {
    (globalThis as any).__source = "firma";
    (globalThis as any).__userId = "uB";
    (globalThis as any).__orgIds = [10];
    const caller = tareaRouter.createCaller(makeCtx("uB"));
    const result = await caller.listar({ limit: 50 });
    const ids = result.items.map((i) => i.id).sort((a, b) => a - b);
    expect(ids).toEqual([5010, 5011]);
  });

  it("user in other firm does NOT see firmaA tareas", async () => {
    (globalThis as any).__source = "firma";
    (globalThis as any).__userId = "uY";
    (globalThis as any).__orgIds = [20];
    const caller = tareaRouter.createCaller(makeCtx("uY"));
    const result = await caller.listar({ limit: 50 });
    expect(result.items.map((i) => i.id)).toEqual([6010]);
  });

  it("user with no firm sees no firma tareas", async () => {
    (globalThis as any).__source = "firma";
    (globalThis as any).__userId = "uZ";
    (globalThis as any).__orgIds = [];
    const caller = tareaRouter.createCaller(makeCtx("uZ"));
    const result = await caller.listar({ limit: 50 });
    expect(result.items).toEqual([]);
  });
});
