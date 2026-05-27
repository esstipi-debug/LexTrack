import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit test for syncPjudActiveCausas.
 * - Mocks db (causas + cronologia + alertas) and the PJUD facade.
 * - Asserts new movements create cronologia + alerta scoped to userId.
 * - Asserts duplicates (same fecha + descripcion) are NOT re-inserted.
 * - Asserts PjudUnavailableError per-causa is swallowed and counted.
 */

const causasRows = [
  {
    id: 1,
    userId: 42,
    rit: "C-1-2024",
    rol: "C-1-2024",
    tribunal: "1JL Santiago",
    estado: "tramitacion",
    estaMonitoreando: true,
  },
  {
    id: 2,
    userId: 7,
    rit: "C-2-2024",
    rol: "C-2-2024",
    tribunal: "2JL Santiago",
    estado: "tramitacion",
    estaMonitoreando: true,
  },
];

// Existing cronologia for causa 1 — used to dedupe one of the movements.
const existingCron: Array<{
  causaId: number;
  userId: number;
  fecha: Date;
  titulo: string;
}> = [
  {
    causaId: 1,
    userId: 42,
    fecha: new Date("2024-05-01"),
    titulo: "Resolución antigua",
  },
];

const insertedCron: any[] = [];
const insertedAlertas: any[] = [];

vi.mock("../queries/connection", () => {
  return {
    getDb: () => ({
      select: () => ({
        from: (table: any) => ({
          where: (_cond?: unknown) => {
            const tableName = table?.[Symbol.for("drizzle:Name")] || "";
            if (table === causasTable) return Promise.resolve(causasRows);
            if (table === cronologiaTable) {
              // crude: return existing for both queries; filter doesn't matter much
              return Promise.resolve(existingCron);
            }
            return Promise.resolve([]);
          },
        }),
      }),
      insert: (table: any) => ({
        values: (v: any) => {
          if (table === cronologiaTable) insertedCron.push(v);
          if (table === alertasTable) insertedAlertas.push(v);
          return Promise.resolve();
        },
      }),
    }),
  };
});

// Sentinels for table identity inside mocks.
const causasTable = { __t: "causas" } as any;
const cronologiaTable = { __t: "cronologia" } as any;
const alertasTable = { __t: "alertas" } as any;

vi.mock("@db/schema", () => ({
  causas: causasTable,
  cronologia: cronologiaTable,
  alertas: alertasTable,
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    eq: (..._args: unknown[]) => ({ _op: "eq" }),
    and: (..._args: unknown[]) => ({ _op: "and" }),
  };
});

class FakePjudUnavailable extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "PjudUnavailableError";
  }
}
class FakePjudNotFound extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "PjudNotFoundError";
  }
}

vi.mock("../lib/pjud/index", () => {
  return {
    PjudUnavailableError: FakePjudUnavailable,
    PjudNotFoundError: FakePjudNotFound,
    obtenerMovimientos: vi.fn(async (rol: string) => {
      if (rol === "C-1-2024") {
        return [
          // duplicate of existingCron
          {
            fecha: "2024-05-01",
            tipo: "resolución",
            descripcion: "Resolución antigua",
            folio: "1",
          },
          // new
          {
            fecha: "2024-06-10",
            tipo: "sentencia",
            descripcion: "Sentencia definitiva",
            folio: "9",
          },
        ];
      }
      if (rol === "C-2-2024") {
        throw new FakePjudUnavailable("timeout");
      }
      return [];
    }),
  };
});

beforeEach(() => {
  insertedCron.length = 0;
  insertedAlertas.length = 0;
});

describe("syncPjudActiveCausas", () => {
  it("inserts new movements + alertas scoped to causa.userId, skips dupes, swallows scraper errors", async () => {
    const { syncPjudActiveCausas } = await import("./sync-pjud");
    const result = await syncPjudActiveCausas();

    expect(result.causasProcesadas).toBe(2);
    // Only the non-duplicate movement is inserted (1 of 2 from causa 1).
    expect(insertedCron).toHaveLength(1);
    expect(insertedCron[0].userId).toBe(42);
    expect(insertedCron[0].causaId).toBe(1);

    // Alerta mirrors the userId of the owning causa.
    expect(insertedAlertas).toHaveLength(1);
    expect(insertedAlertas[0].userId).toBe(42);
    expect(insertedAlertas[0].prioridad).toBe("alta"); // sentencia → alta

    // Causa 2 errored; counted but not aborting the loop.
    expect(result.errores).toBeGreaterThanOrEqual(1);
  });
});
