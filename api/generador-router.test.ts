import { describe, expect, it, vi } from "vitest";

/**
 * Unit tests for generadorRouter.
 *
 * The router is mostly read-only / computation:
 *   - templates: pure static list, no DB
 *   - generar: calls recuperarContexto (DB) then builds string output
 *   - calcularIndemnizacion: pure math, no DB
 *
 * We mock getDb() for the recuperarContexto call inside generar.
 */

vi.mock("./queries/connection", () => {
  return {
    getDb: () => {
      const db: any = {
        select: () => db,
        from: () => db,
        where: () => db,
        orderBy: () => db,
        limit: () => Promise.resolve([]),
        // Awaiting db without .limit() — recuperarContexto awaits select().from().where()
        then: (resolve: (v: unknown[]) => void) => {
          return Promise.resolve([]).then(resolve);
        },
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

const { generadorRouter } = await import("./generador-router");

function makeCtx(userId = "u1") {
  return {
    user: { id: userId, role: "abogado" as const, email: `${userId}@test.cl` },
  } as any;
}

// ─── generador.templates ───────────────────────────────────────────────────

describe("generador.templates", () => {
  it("returns the static list of document templates", async () => {
    const caller = generadorRouter.createCaller(makeCtx());
    const result = await caller.templates();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("each template has id, nombre, descripcion, and icono fields", async () => {
    const caller = generadorRouter.createCaller(makeCtx());
    const result = await caller.templates();
    for (const t of result) {
      expect(typeof t.id).toBe("string");
      expect(typeof t.nombre).toBe("string");
      expect(typeof t.descripcion).toBe("string");
      expect(typeof t.icono).toBe("string");
    }
  });

  it("includes carta_aviso_despido and demanda_indemnizacion in the list", async () => {
    const caller = generadorRouter.createCaller(makeCtx());
    const result = await caller.templates();
    const ids = result.map((t) => t.id);
    expect(ids).toContain("carta_aviso_despido");
    expect(ids).toContain("demanda_indemnizacion");
  });
});

// ─── generador.generar ─────────────────────────────────────────────────────

describe("generador.generar", () => {
  it("returns a non-empty string for carta_aviso_despido with valid datos", async () => {
    const caller = generadorRouter.createCaller(makeCtx());
    const result = await caller.generar({
      templateId: "carta_aviso_despido",
      datos: {
        trabajador: "Juan Pérez",
        rut_trabajador: "12.345.678-9",
        empresa: "Empresa SA",
        rut_empresa: "76.543.210-1",
        fecha_termino: "2026-06-30",
        causal: "Necesidades de la empresa (Art. 161 CT)",
        representante: "María González",
      },
    });
    expect(typeof result.titulo).toBe("string");
    expect(result.titulo.length).toBeGreaterThan(0);
    expect(typeof result.contenido).toBe("string");
    expect(result.contenido.length).toBeGreaterThan(0);
    expect(result.contenido).toContain("Juan Pérez");
  });

  it("returns a non-empty string for demanda_indemnizacion with anios/remuneracion", async () => {
    const caller = generadorRouter.createCaller(makeCtx());
    const result = await caller.generar({
      templateId: "demanda_indemnizacion",
      datos: {
        demandante: "Ana López",
        rut_demandante: "11.111.111-1",
        empresa: "Corp Ltda",
        anios: 5,
        remuneracion: 1500000,
        abogado: "Pedro Soto",
      },
    });
    expect(result.contenido).toContain("Ana López");
    // The router calculates: min(5*30, 330) = 150 days → 5 months of salary
    expect(result.contenido).toContain("150");
  });

  it("falls through to default for unknown templateId and returns placeholder", async () => {
    const caller = generadorRouter.createCaller(makeCtx());
    const result = await caller.generar({
      templateId: "plantilla_inexistente",
      datos: {},
    });
    // Router returns { titulo: "Documento", contenido: "Template no implementado" }
    expect(result.titulo).toBe("Documento");
    expect(result.contenido).toBe("Template no implementado");
  });

  it("contexto is always an array (even when DB is empty)", async () => {
    const caller = generadorRouter.createCaller(makeCtx());
    const result = await caller.generar({
      templateId: "carta_aviso_despido",
      datos: {},
    });
    expect(Array.isArray(result.contexto)).toBe(true);
  });
});

// ─── generador.calcularIndemnizacion ──────────────────────────────────────

describe("generador.calcularIndemnizacion", () => {
  it("returns correct diasIndemnizacion for 5 years at 1,500,000 CLP", async () => {
    const caller = generadorRouter.createCaller(makeCtx());
    const result = await caller.calcularIndemnizacion({
      anios: 5,
      sueldo: 1_500_000,
    });
    // 5 years * 30 days = 150 days (below tope 330)
    expect(result.diasIndemnizacion).toBe(150);
    // montoIndemnizacion = (150/30) * 1_500_000 = 7_500_000
    expect(result.montoIndemnizacion).toBe(7_500_000);
    expect(typeof result.proporcionalVacaciones).toBe("number");
    expect(typeof result.proporcionalFeriado).toBe("number");
    expect(typeof result.total).toBe("number");
  });

  it("caps salary at 90 UF (3,348,000 CLP) for topeAplicado", async () => {
    const caller = generadorRouter.createCaller(makeCtx());
    const result = await caller.calcularIndemnizacion({
      anios: 3,
      sueldo: 5_000_000, // above 90 UF cap
    });
    expect(result.topeAplicado).toBe(true);
    // montoIndemnizacion must be capped
    const tope = 90 * 37200;
    expect(result.montoIndemnizacion).toBeLessThanOrEqual(3 * tope);
  });

  it("caps diasIndemnizacion at 330 (11 months) for 15+ years", async () => {
    const caller = generadorRouter.createCaller(makeCtx());
    const result = await caller.calcularIndemnizacion({
      anios: 15,
      sueldo: 800_000,
    });
    expect(result.diasIndemnizacion).toBe(330);
  });

  it("adds aviso previo when avisoPrevio=false (not given)", async () => {
    const caller = generadorRouter.createCaller(makeCtx());
    const withoutAviso = await caller.calcularIndemnizacion({
      anios: 2,
      sueldo: 1_000_000,
      avisoPrevio: false,
    });
    const withAviso = await caller.calcularIndemnizacion({
      anios: 2,
      sueldo: 1_000_000,
      avisoPrevio: true,
    });
    // withoutAviso should include one extra month
    expect(withoutAviso.montoAvisoPrevio).toBe(1_000_000);
    expect(withAviso.montoAvisoPrevio).toBe(0);
    expect(withoutAviso.total).toBeGreaterThan(withAviso.total);
  });

  it("rounds partial year up when meses >= 6", async () => {
    const caller = generadorRouter.createCaller(makeCtx());
    const withPartial = await caller.calcularIndemnizacion({
      anios: 3,
      meses: 6,
      sueldo: 1_000_000,
    });
    const withoutPartial = await caller.calcularIndemnizacion({
      anios: 3,
      meses: 5,
      sueldo: 1_000_000,
    });
    // meses=6 rounds to 4 years → 120 days; meses=5 stays at 3 years → 90 days
    expect(withPartial.diasIndemnizacion).toBe(120);
    expect(withoutPartial.diasIndemnizacion).toBe(90);
  });
});
