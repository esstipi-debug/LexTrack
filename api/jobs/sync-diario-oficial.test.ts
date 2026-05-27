import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit test for syncDiarioOficialDaily.
 * - Mocks the diariooficial facade + db.
 * - Asserts labor-matter normas fan out an alerta per user.
 * - Asserts non-labor normas insert into diarioOficialNormas but DON'T
 *   create alertas.
 * - Asserts duplicates (already in diarioOficialNormas) are skipped.
 */

const usersRows = [{ id: 1 }, { id: 2 }, { id: 3 }];

// One existing norma to test dedupe (matches numero=999 + tipo=ley)
const existingNormas = [
  { id: 100, numeroNorma: "999", tipo: "ley" },
];

const insertedNormas: any[] = [];
const insertedAlertas: any[] = [];

const usersTable = { __t: "users" } as any;
const normasTable = { __t: "diarioOficialNormas" } as any;
const alertasTable = { __t: "alertas" } as any;

vi.mock("@db/schema", () => ({
  users: usersTable,
  diarioOficialNormas: normasTable,
  alertas: alertasTable,
}));

vi.mock("../queries/connection", () => {
  return {
    getDb: () => ({
      select: (cols?: any) => ({
        from: (table: any) => {
          if (table === usersTable) {
            return Promise.resolve(usersRows);
          }
          return {
            where: (_cond?: unknown) => {
              if (table === normasTable) {
                const num = (globalThis as any).__currentNum;
                return Promise.resolve(
                  existingNormas.filter((n) => n.numeroNorma === num),
                );
              }
              return Promise.resolve([]);
            },
          };
        },
      }),
      insert: (table: any) => ({
        values: (v: any) => {
          if (table === normasTable) {
            insertedNormas.push(v);
            (globalThis as any).__currentNum = v.numeroNorma;
            return {
              returning: () => Promise.resolve([{ id: 500 + insertedNormas.length }]),
            };
          }
          if (table === alertasTable) {
            insertedAlertas.push(v);
            return Promise.resolve();
          }
          return Promise.resolve();
        },
      }),
    }),
  };
});

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    eq: (col: any, val: any) => {
      // Capture numero to drive dedupe lookup
      if (typeof val === "string") (globalThis as any).__currentNum = val;
      return { _op: "eq", val };
    },
    and: (..._args: unknown[]) => ({ _op: "and" }),
  };
});

vi.mock("../lib/diariooficial", () => {
  class FakeUnavailable extends Error {}
  return {
    DiarioOficialUnavailableError: FakeUnavailable,
    obtenerEdicionDelDia: vi.fn(async () => [
      // labor (new) → should create alertas for all 3 users
      {
        tipoNorma: "Ley",
        numero: "111",
        titulo: "Reforma laboral",
        fechaPublicacion: "2024-06-01",
        organismo: "Ministerio del Trabajo",
        materia: "laboral",
        url: "https://do.cl/111",
      },
      // non-labor (new) → inserted but no alertas
      {
        tipoNorma: "Decreto",
        numero: "222",
        titulo: "Decreto tributario",
        fechaPublicacion: "2024-06-01",
        organismo: "SII",
        materia: "tributaria",
        url: "https://do.cl/222",
      },
      // duplicate of existing
      {
        tipoNorma: "Ley",
        numero: "999",
        titulo: "Ley antigua",
        fechaPublicacion: "2024-06-01",
        organismo: "MinHacienda",
        materia: "laboral",
        url: "https://do.cl/999",
      },
    ]),
  };
});

beforeEach(() => {
  insertedNormas.length = 0;
  insertedAlertas.length = 0;
  (globalThis as any).__currentNum = undefined;
});

describe("syncDiarioOficialDaily", () => {
  it("inserts only new normas; fans out alertas per user ONLY for labor matters; skips duplicates", async () => {
    const { syncDiarioOficialDaily } = await import("./sync-diario-oficial");
    const result = await syncDiarioOficialDaily();

    expect(result.normasFetched).toBe(3);
    expect(result.normasInsertadas).toBe(2); // 111 + 222, NOT 999

    // Alertas: only the labor norma (111) fans out, one per user.
    expect(insertedAlertas).toHaveLength(usersRows.length);
    const userIds = insertedAlertas.map((a) => a.userId).sort();
    expect(userIds).toEqual([1, 2, 3]);

    for (const a of insertedAlertas) {
      expect(a.prioridad).toBe("baja");
      expect(a.tipo).toBe("diario_oficial");
      expect(a.titulo).toContain("Reforma laboral");
    }
  });
});
