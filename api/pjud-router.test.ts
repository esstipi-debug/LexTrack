import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Unit tests for pjudRouter.
 *
 * Mocks:
 *   - ./queries/connection  → fake DB with chainable builder + insert store
 *   - ./lib/pjud/index      → PJUD facade (consultarCausa, buscarPorRut)
 *   - ./lib/pjud/sync       → sincronizarCausa, sincronizarTodas
 */

// ── Shared mock state ─────────────────────────────────────────────────────────

let insertedValues: Record<string, unknown> | null = null;

// ── DB mock ───────────────────────────────────────────────────────────────────

vi.mock("./queries/connection", () => {
  return {
    getDb: () => {
      const db: any = {
        select: () => db,
        from: () => db,
        where: () => db,
        orderBy: () => db,
        limit: () => Promise.resolve([]),
        insert: (_table: unknown) => ({
          values: (v: Record<string, unknown>) => {
            insertedValues = v;
            return Promise.resolve();
          },
        }),
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
    eq: (..._args: unknown[]) => ({ _op: "eq" }),
    and: (..._args: unknown[]) => ({ _op: "and" }),
    desc: (..._args: unknown[]) => ({ _op: "desc" }),
    sql: ((..._args: unknown[]) => ({ _op: "sql" })) as any,
  };
});

// ── PJUD facade mock ──────────────────────────────────────────────────────────

const MOCK_CAUSA_RESULT = {
  rit: "T-123-2024",
  ruc: "14-2-0123456-0",
  caratula: "González con Empresa SpA",
  tribunal: "1er Juzgado de Letras del Trabajo de Santiago",
  estado: "Tramitacion",
  etapa: "Discusion",
  fechaIngreso: "2024-01-15",
  ultimoMovimiento: {
    fecha: "2024-05-10",
    tipo: "resolucion",
    descripcion: "Llamado a conciliación",
  },
  litigantes: ["Juan González", "Empresa SpA"],
};

const MOCK_RUT_RESULTS = [
  { ...MOCK_CAUSA_RESULT, rit: "T-456-2024" },
  { ...MOCK_CAUSA_RESULT, rit: "T-789-2024" },
];

vi.mock("./lib/pjud/index", () => ({
  consultarCausa: vi.fn().mockResolvedValue(MOCK_CAUSA_RESULT),
  buscarPorRut: vi.fn().mockResolvedValue(MOCK_RUT_RESULTS),
  PjudUnavailableError: class PjudUnavailableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "PjudUnavailableError";
    }
  },
}));

// ── Sync mock ─────────────────────────────────────────────────────────────────

const MOCK_SYNC_RESULT = {
  causaId: 1,
  rit: "T-123-2024",
  synced: true,
  cambios: {
    estadoCambio: null,
    nuevosMovimientos: 2,
    movimientos: [
      { fecha: "2024-05-10", tipo: "resolucion", descripcion: "Auto de prueba" },
      { fecha: "2024-05-12", tipo: "audiencia", descripcion: "Audiencia preparatoria" },
    ],
  },
};

vi.mock("./lib/pjud/sync", () => ({
  sincronizarCausa: vi.fn().mockResolvedValue(MOCK_SYNC_RESULT),
  sincronizarTodas: vi.fn().mockResolvedValue([MOCK_SYNC_RESULT]),
}));

// ── Import router after all mocks are set ─────────────────────────────────────

const { pjudRouter } = await import("./pjud-router");

function makeCtx(userId = "u1", role: "abogado" | "admin" = "abogado") {
  return {
    user: { id: userId, role, email: `${userId}@test.cl` },
  } as any;
}

beforeEach(() => {
  insertedValues = null;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("pjud.consultar", () => {
  it("calls the PJUD facade with rit and optional tribunal, returns result shape", async () => {
    const { consultarCausa } = await import("./lib/pjud/index");
    const caller = pjudRouter.createCaller(makeCtx("u1"));

    const result = await caller.consultar({ rit: "T-123-2024", tribunal: "1er Juzgado" });

    expect(consultarCausa).toHaveBeenCalledWith("T-123-2024", "1er Juzgado");
    expect(result).toMatchObject({
      rit: "T-123-2024",
      caratula: "González con Empresa SpA",
      estado: "Tramitacion",
    });
    expect(Array.isArray(result!.litigantes)).toBe(true);
  });

  it("returns null when facade returns null (causa not found)", async () => {
    const { consultarCausa } = await import("./lib/pjud/index");
    (consultarCausa as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const caller = pjudRouter.createCaller(makeCtx("u1"));
    const result = await caller.consultar({ rit: "NONEXISTENT-999" });

    expect(result).toBeNull();
  });
});

describe("pjud.buscarPorRut", () => {
  it("returns results from the facade mock", async () => {
    const { buscarPorRut } = await import("./lib/pjud/index");
    const caller = pjudRouter.createCaller(makeCtx("u1"));

    const result = await caller.buscarPorRut({ rut: "12.345.678-9" });

    expect(buscarPorRut).toHaveBeenCalledWith("12.345.678-9");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].rit).toBe("T-456-2024");
  });
});

describe("pjud.importar", () => {
  it("inserts a causa with userId stamped from context", async () => {
    const caller = pjudRouter.createCaller(makeCtx("u1"));

    const result = await caller.importar({
      rit: "T-123-2024",
      caratula: "González con Empresa SpA",
      tribunal: "1er Juzgado de Letras del Trabajo de Santiago",
      estado: "Tramitacion",
      fechaIngreso: "2024-01-15",
    });

    expect(result).toEqual({ ok: true });
    expect(insertedValues?.userId).toBe("u1");
    expect(insertedValues?.rit).toBe("T-123-2024");
    expect(insertedValues?.caratula).toBe("González con Empresa SpA");
    expect(insertedValues?.fuente).toBe("consulta_unificada");
    expect(insertedValues?.estaMonitoreando).toBe(true);
  });

  it("maps PJUD estado string to local enum on insert", async () => {
    const caller = pjudRouter.createCaller(makeCtx("u1"));

    await caller.importar({
      rit: "T-999-2024",
      caratula: "Test causa",
      tribunal: "Juzgado X",
      estado: "Sentenciada",
    });

    expect(insertedValues?.estado).toBe("sentencia");
  });
});

describe("pjud.sincronizar", () => {
  it("calls sincronizarCausa with causaId and userId, returns SyncResult shape", async () => {
    const { sincronizarCausa } = await import("./lib/pjud/sync");
    const caller = pjudRouter.createCaller(makeCtx("u1"));

    const result = await caller.sincronizar({ causaId: 1 });

    expect(sincronizarCausa).toHaveBeenCalledWith(1, "u1");
    expect(result).toMatchObject({
      causaId: 1,
      rit: "T-123-2024",
      synced: true,
    });
    expect(typeof result.cambios.nuevosMovimientos).toBe("number");
    expect(Array.isArray(result.cambios.movimientos)).toBe(true);
  });
});

describe("pjud.sincronizarTodas", () => {
  it("calls sincronizarTodas with userId and returns array of SyncResults", async () => {
    const { sincronizarTodas } = await import("./lib/pjud/sync");
    const caller = pjudRouter.createCaller(makeCtx("u1"));

    const result = await caller.sincronizarTodas();

    expect(sincronizarTodas).toHaveBeenCalledWith("u1");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].synced).toBe(true);
  });
});

describe("pjud.consultar — PjudUnavailableError handling", () => {
  it("propagates PjudUnavailableError as thrown error", async () => {
    const { consultarCausa } = await import("./lib/pjud/index");
    const { PjudUnavailableError } = await import("./lib/pjud/index");

    (consultarCausa as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new PjudUnavailableError("PJUD service unavailable")
    );

    const caller = pjudRouter.createCaller(makeCtx("u1"));

    await expect(caller.consultar({ rit: "T-123-2024" })).rejects.toThrow(
      "PJUD service unavailable"
    );
  });
});
