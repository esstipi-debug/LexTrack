import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit tests for leykarinRouter.
 *
 * All DB calls are mocked (no real DB). Karin lib functions (pure string
 * generators) are mocked to return fixed strings so tests don't depend
 * on their internal formatting.
 */

// ─── Mock karin libs ───────────────────────────────────────────────────────

vi.mock("./lib/karin/protocolo", () => ({
  generarProtocoloKarin: vi.fn().mockReturnValue("PROTOCOLO_MOCK"),
  generarChecklistKarin: vi.fn().mockReturnValue("CHECKLIST_MOCK"),
}));

vi.mock("./lib/karin/documentos", () => ({
  generarActaRecepcion: vi.fn().mockReturnValue("ACTA_MOCK"),
  generarInformeFinal: vi.fn().mockReturnValue("INFORME_MOCK"),
  generarNotificacionMedidas: vi.fn().mockReturnValue("NOTIFICACION_MOCK"),
}));

// ─── Fixture data ──────────────────────────────────────────────────────────

type DenunciaRow = {
  id: number;
  userId: string;
  orgId?: number | null;
  codigo: string;
  estado: string;
  tipo: string;
  prioridad: string;
  fechaRecepcion: Date;
  denunciante: string | null;
  denunciado: string;
  descripcionHechos: string;
  diasPlazo: number | null;
  rutDenunciante: string | null;
  cargoDenunciante: string | null;
  cargoDenunciado: string | null;
  testigos: string | null;
  rutDenunciado: string | null;
  fechaInicioInvestigacion: Date | null;
  fechaResolucion: Date | null;
  area: string | null;
};

function makeDenuncia(
  id: number,
  userId: string,
  overrides: Partial<DenunciaRow> = {}
): DenunciaRow {
  return {
    id,
    userId,
    codigo: `KRN-${id}`,
    estado: "recepcionada",
    tipo: "acoso_laboral",
    prioridad: "media",
    fechaRecepcion: new Date("2026-01-01"),
    denunciante: "Ana López",
    denunciado: "Pedro Ruiz",
    descripcionHechos: "Hechos descritos aquí.",
    diasPlazo: 30,
    rutDenunciante: null,
    cargoDenunciante: null,
    cargoDenunciado: null,
    testigos: null,
    rutDenunciado: null,
    fechaInicioInvestigacion: null,
    fechaResolucion: null,
    area: null,
    ...overrides,
  };
}

const DENUNCIAS_U1: DenunciaRow[] = [
  makeDenuncia(1, "u1"),
  makeDenuncia(2, "u1", { estado: "evaluacion" }),
  makeDenuncia(3, "u1", { estado: "investigacion" }),
  makeDenuncia(4, "u1", { estado: "archivada" }),
];
const DENUNCIAS_U2: DenunciaRow[] = [
  makeDenuncia(100, "u2"),
];
const ALL_DENUNCIAS = [...DENUNCIAS_U1, ...DENUNCIAS_U2];

// Multi-firma fixture: denuncias visible across firmaA (orgId=10) and firmaB (orgId=20).
const FIRMA_DENUNCIAS: DenunciaRow[] = [
  makeDenuncia(9001, "uA", { orgId: 10 }),
  makeDenuncia(9002, "uA", { orgId: 10 }),
  makeDenuncia(9100, "uX", { orgId: 20 }),
];

let insertedDenuncia: Record<string, unknown> | null = null;
let updatedEstado: Record<string, unknown> | null = null;

vi.mock("./queries/connection", () => {
  return {
    getDb: () => {
      const db: any = {
        select: () => db,
        from: () => db,
        orderBy: () => db,
        groupBy: () => db,
        where: (_cond?: unknown) => db,
        // limit: drives paginated queries (listar)
        limit: (n: number) => {
          const userId = (globalThis as any).__userId as string;
          const cursor = (globalThis as any).__cursor as number | null;
          const source = (globalThis as any).__source as "all" | "firma" | undefined;
          const orgIds = ((globalThis as any).__orgIds as number[] | undefined) ?? [];
          const dataset = source === "firma" ? FIRMA_DENUNCIAS : ALL_DENUNCIAS;
          let rows = dataset.filter((r) =>
            source === "firma"
              ? r.userId === userId || (r.orgId != null && orgIds.includes(r.orgId))
              : r.userId === userId,
          );
          if (cursor != null) rows = rows.filter((r) => r.id < cursor);
          rows.sort((a, b) => b.id - a.id);
          return Promise.resolve(rows.slice(0, n));
        },
        // then: used when chain is awaited directly (no .limit())
        // Used by: obtener, cambiarEstado, dashboard, calcularPlazo, generarActa, getUserOrgIds
        then: (resolve: (v: DenunciaRow[]) => void) => {
          const userId = (globalThis as any).__userId as string;
          const singleId = (globalThis as any).__singleId as number | undefined;
          let rows: DenunciaRow[];
          if (singleId != null) {
            rows = ALL_DENUNCIAS.filter((r) => r.id === singleId && r.userId === userId);
          } else {
            rows = ALL_DENUNCIAS.filter((r) => r.userId === userId);
          }
          return Promise.resolve(rows).then(resolve);
        },
        insert: (_table: unknown) => ({
          values: (v: Record<string, unknown>) => {
            // ignore audit_log inserts to keep capture focused on subject under test
            if (!("action" in v && "tableName" in v)) insertedDenuncia = v;
            return Promise.resolve();
          },
        }),
        update: (_table: unknown) => ({
          set: (v: Record<string, unknown>) => {
            updatedEstado = v;
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

// rutSchema used inside leykarin-router via @contracts/rut
vi.mock("@contracts/rut", () => ({
  rutSchema: { parse: (v: string) => v, _def: { typeName: "ZodString" } },
}));

const { leykarinRouter } = await import("./leykarin-router");

function makeCtx(userId = "u1", role: "abogado" | "admin" = "abogado") {
  return {
    user: { id: userId, role, email: `${userId}@test.cl` },
  } as any;
}

beforeEach(() => {
  (globalThis as any).__userId = "u1";
  (globalThis as any).__cursor = null;
  (globalThis as any).__singleId = undefined;
  (globalThis as any).__source = "all";
  (globalThis as any).__orgIds = [];
  insertedDenuncia = null;
  updatedEstado = null;
});

// ─── leykarin.listar ───────────────────────────────────────────────────────

describe("leykarin.listar", () => {
  it("returns paginated denuncias scoped to caller userId", async () => {
    (globalThis as any).__userId = "u1";
    const caller = leykarinRouter.createCaller(makeCtx("u1"));
    const result = await caller.listar({ limit: 3 });
    expect(result.items).toHaveLength(3);
    result.items.forEach((item) => expect(item.userId).toBe("u1"));
    expect(result.nextCursor).toBe(result.items[2].id);
  });

  it("does not return another user's denuncias", async () => {
    (globalThis as any).__userId = "u1";
    const caller = leykarinRouter.createCaller(makeCtx("u1"));
    const result = await caller.listar({ limit: 100 });
    expect(result.items.length).toBe(4);
    const u2items = result.items.filter((i) => i.userId === "u2");
    expect(u2items).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it("cursor pagination works across pages", async () => {
    (globalThis as any).__userId = "u1";
    const caller = leykarinRouter.createCaller(makeCtx("u1"));

    const page1 = await caller.listar({ limit: 2 });
    expect(page1.items).toHaveLength(2);
    const cursor = page1.nextCursor!;

    (globalThis as any).__cursor = cursor;
    const page2 = await caller.listar({ limit: 2, cursor });
    expect(page2.items.length).toBeGreaterThan(0);
    page2.items.forEach((item) => expect(item.id).toBeLessThan(cursor));
  });
});

// ─── leykarin.crear ────────────────────────────────────────────────────────

describe("leykarin.crear", () => {
  it("stamps userId from context on new denuncia insert", async () => {
    const caller = leykarinRouter.createCaller(makeCtx("u1"));
    const result = await caller.crear({
      codigo: "KRN-TEST-001",
      fechaRecepcion: "2026-05-01",
      denunciado: "Carlos Rojas",
      descripcionHechos: "Conducta inapropiada reiterada",
    });
    expect(result).toEqual({ ok: true });
    expect(insertedDenuncia?.userId).toBe("u1");
    expect(insertedDenuncia?.codigo).toBe("KRN-TEST-001");
    expect(insertedDenuncia?.denunciado).toBe("Carlos Rojas");
  });

  it("defaults tipo to acoso_laboral and prioridad to media", async () => {
    const caller = leykarinRouter.createCaller(makeCtx("u1"));
    await caller.crear({
      codigo: "KRN-TEST-002",
      fechaRecepcion: "2026-05-01",
      denunciado: "Luis Torres",
      descripcionHechos: "Hostigamiento reiterado",
    });
    expect(insertedDenuncia?.tipo).toBe("acoso_laboral");
    expect(insertedDenuncia?.prioridad).toBe("media");
  });
});

// ─── leykarin.obtener ──────────────────────────────────────────────────────

describe("leykarin.obtener", () => {
  it("returns the denuncia with actuaciones for the owner", async () => {
    (globalThis as any).__userId = "u1";
    (globalThis as any).__singleId = 1;
    const caller = leykarinRouter.createCaller(makeCtx("u1"));
    const result = await caller.obtener({ id: 1 });
    expect(result.id).toBe(1);
    expect(result.userId).toBe("u1");
    expect(Array.isArray(result.actuaciones)).toBe(true);
  });

  it("throws NOT_FOUND for cross-tenant access (u1 tries to get u2 denuncia)", async () => {
    (globalThis as any).__userId = "u1";
    (globalThis as any).__singleId = 100; // belongs to u2 — mock filters userId=u1, returns []
    const caller = leykarinRouter.createCaller(makeCtx("u1"));
    await expect(caller.obtener({ id: 100 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ─── leykarin.cambiarEstado ────────────────────────────────────────────────

describe("leykarin.cambiarEstado", () => {
  it("updates estado and returns de/a when transition is valid", async () => {
    // Denuncia 1 is in estado=recepcionada, valid next is evaluacion
    (globalThis as any).__userId = "u1";
    (globalThis as any).__singleId = 1;
    const caller = leykarinRouter.createCaller(makeCtx("u1"));
    const result = await caller.cambiarEstado({ id: 1, estado: "evaluacion" });
    expect(result.ok).toBe(true);
    expect(result.de).toBe("recepcionada");
    expect(result.a).toBe("evaluacion");
    expect(updatedEstado?.estado).toBe("evaluacion");
  });

  it("throws NOT_FOUND when attempting cambiarEstado on cross-tenant denuncia", async () => {
    (globalThis as any).__userId = "u1";
    (globalThis as any).__singleId = 100; // belongs to u2 — returns [] for u1
    const caller = leykarinRouter.createCaller(makeCtx("u1"));
    await expect(
      caller.cambiarEstado({ id: 100, estado: "evaluacion" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws PRECONDITION_FAILED for invalid state transition (archivada → evaluacion)", async () => {
    // Denuncia 4 is archivada (terminal)
    (globalThis as any).__userId = "u1";
    (globalThis as any).__singleId = 4;
    const caller = leykarinRouter.createCaller(makeCtx("u1"));
    await expect(
      caller.cambiarEstado({ id: 4, estado: "evaluacion" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

// ─── leykarin.generarProtocolo ─────────────────────────────────────────────

describe("leykarin.generarProtocolo", () => {
  it("returns {protocolo, checklist, generadoEn} with non-empty strings", async () => {
    const caller = leykarinRouter.createCaller(makeCtx("u1"));
    const result = await caller.generarProtocolo({
      razonSocial: "Empresa Ejemplo SA",
      rut: "76.543.210-1",
      rubro: "Comercio",
      domicilioPrincipal: "Av. Libertador 1234, Santiago",
      dotacionTotal: 50,
      sucursales: [],
      encargadoNombre: "María González",
      encargadoCargo: "RRHH",
      encargadoEmail: "mgonzalez@empresa.cl",
      representanteLegalNombre: "José Pérez",
      representanteLegalRut: "12.345.678-9",
      canalesDenuncia: ["presencial"],
      fechaVigencia: "2026-08-01",
    });
    expect(typeof result.protocolo).toBe("string");
    expect(result.protocolo.length).toBeGreaterThan(0);
    expect(typeof result.checklist).toBe("string");
    expect(result.checklist.length).toBeGreaterThan(0);
    expect(typeof result.generadoEn).toBe("string");
  });
});

// ─── leykarin.generarActa ──────────────────────────────────────────────────

describe("leykarin.generarActa", () => {
  it("returns {documento, folio, generadoEn} with a non-empty string documento", async () => {
    (globalThis as any).__userId = "u1";
    (globalThis as any).__singleId = 1;
    const caller = leykarinRouter.createCaller(makeCtx("u1"));
    const result = await caller.generarActa({
      denunciaId: 1,
      empresa: "Empresa Ejemplo SA",
      receptor: "Paula Soto",
      receptorCargo: "Encargada RRHH",
    });
    expect(typeof result.documento).toBe("string");
    expect(result.documento.length).toBeGreaterThan(0);
    expect(result.folio).toBe("KRN-1");
  });

  it("throws NOT_FOUND for cross-tenant denunciaId in generarActa", async () => {
    (globalThis as any).__userId = "u1";
    (globalThis as any).__singleId = 100;
    const caller = leykarinRouter.createCaller(makeCtx("u1"));
    await expect(
      caller.generarActa({
        denunciaId: 100,
        empresa: "Empresa SA",
        receptor: "Receptor",
        receptorCargo: "Cargo",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ─── leykarin.dashboard ────────────────────────────────────────────────────

describe("leykarin.dashboard", () => {
  it("returns counts scoped to caller userId", async () => {
    (globalThis as any).__userId = "u1";
    (globalThis as any).__singleId = undefined;
    const caller = leykarinRouter.createCaller(makeCtx("u1"));
    const result = await caller.dashboard();
    // u1 has 4 denuncias
    expect(result.total).toBe(4);
    expect(typeof result.activas).toBe("number");
    expect(typeof result.urgentes).toBe("number");
    expect(typeof result.vencidas).toBe("number");
    expect(typeof result.porEstado).toBe("object");
    expect(typeof result.porTipo).toBe("object");
  });

  it("porEstado counts match the fixture data", async () => {
    (globalThis as any).__userId = "u1";
    (globalThis as any).__singleId = undefined;
    const caller = leykarinRouter.createCaller(makeCtx("u1"));
    const result = await caller.dashboard();
    // 1 recepcionada, 1 evaluacion, 1 investigacion, 1 archivada
    expect(result.porEstado["recepcionada"]).toBe(1);
    expect(result.porEstado["evaluacion"]).toBe(1);
    expect(result.porEstado["archivada"]).toBe(1);
  });
});

// ─── leykarin.calcularPlazo ────────────────────────────────────────────────

describe("leykarin.calcularPlazo", () => {
  it("returns plazo fields for a valid denuncia owned by caller", async () => {
    (globalThis as any).__userId = "u1";
    (globalThis as any).__singleId = 1;
    const caller = leykarinRouter.createCaller(makeCtx("u1"));
    const result = await caller.calcularPlazo({ id: 1 });
    expect(result.denunciaId).toBe(1);
    expect(result.codigo).toBe("KRN-1");
    expect(typeof result.diasRestantesInvestigacion).toBe("number");
    expect(typeof result.diasRestantesCautelares).toBe("number");
    expect(typeof result.vencidaInvestigacion).toBe("boolean");
    expect(typeof result.vencidaCautelares).toBe("boolean");
  });

  it("diasRestantesInvestigacion is negative for old fechaRecepcion (vencida)", async () => {
    // Denuncia with fechaRecepcion in far past — plazo 30 days already exceeded
    const oldDate = new Date("2020-01-01");
    DENUNCIAS_U1.push(makeDenuncia(99, "u1", { fechaRecepcion: oldDate, diasPlazo: 30 }));
    (globalThis as any).__userId = "u1";
    (globalThis as any).__singleId = 99;
    const caller = leykarinRouter.createCaller(makeCtx("u1"));
    const result = await caller.calcularPlazo({ id: 99 });
    expect(result.vencidaInvestigacion).toBe(true);
    expect(result.diasRestantesInvestigacion).toBeLessThan(0);
    // Clean up
    DENUNCIAS_U1.pop();
  });

  it("throws NOT_FOUND for cross-tenant calcularPlazo", async () => {
    (globalThis as any).__userId = "u1";
    (globalThis as any).__singleId = 100;
    const caller = leykarinRouter.createCaller(makeCtx("u1"));
    await expect(caller.calcularPlazo({ id: 100 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ─── Multi-firma visibility ────────────────────────────────────────────────
describe("leykarin.listar — multi-firma visibility", () => {
  it("firm member sees colleagues' denuncias in the same firm", async () => {
    (globalThis as any).__source = "firma";
    (globalThis as any).__userId = "uB";
    (globalThis as any).__orgIds = [10];
    const caller = leykarinRouter.createCaller(makeCtx("uB"));
    const result = await caller.listar({ limit: 50 });
    const ids = result.items.map((i) => i.id).sort((a, b) => a - b);
    expect(ids).toEqual([9001, 9002]);
  });

  it("user in other firm cannot see firmaA denuncias", async () => {
    (globalThis as any).__source = "firma";
    (globalThis as any).__userId = "uY";
    (globalThis as any).__orgIds = [20];
    const caller = leykarinRouter.createCaller(makeCtx("uY"));
    const result = await caller.listar({ limit: 50 });
    expect(result.items.map((i) => i.id)).toEqual([9100]);
  });

  it("user with no firm sees nothing from firma fixture", async () => {
    (globalThis as any).__source = "firma";
    (globalThis as any).__userId = "uZ";
    (globalThis as any).__orgIds = [];
    const caller = leykarinRouter.createCaller(makeCtx("uZ"));
    const result = await caller.listar({ limit: 50 });
    expect(result.items).toEqual([]);
  });
});
