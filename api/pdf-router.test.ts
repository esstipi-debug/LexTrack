import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Unit tests for pdfRouter.
 *
 * generatePdf is mocked to return a fixed Buffer so tests do not depend
 * on pdfkit. DB is mocked following the alerta/causa pattern.
 */

// ─── Fixed PDF buffer ──────────────────────────────────────────────────────

const FAKE_PDF = Buffer.from("%PDF-test");

vi.mock("./lib/pdf/generate-pdf", () => ({
  generatePdf: vi.fn().mockResolvedValue(FAKE_PDF),
}));

// ─── Document fixture ──────────────────────────────────────────────────────

type DocumentoRow = { id: number; userId: string; titulo: string; contenido: string | null };

const DOCUMENTOS: DocumentoRow[] = [
  { id: 1, userId: "u1", titulo: "Contrato Tipo A", contenido: "Cuerpo del contrato" },
  { id: 2, userId: "u2", titulo: "Contrato U2",     contenido: "Documento de u2" },
];

vi.mock("./queries/connection", () => {
  return {
    getDb: () => {
      const db: any = {
        select: () => db,
        from: () => db,
        orderBy: () => db,
        // where captures the query state but we resolve via globalThis
        where: (_cond?: unknown) => db,
        limit: () => {
          const docId  = (globalThis as any).__docId  as number | undefined;
          const userId = (globalThis as any).__userId as string;
          if (docId == null) return Promise.resolve([]);
          const row = DOCUMENTOS.find((d) => d.id === docId && d.userId === userId);
          return Promise.resolve(row ? [row] : []);
        },
        // then: used when chain is awaited directly (select().from().where())
        then: (resolve: (v: DocumentoRow[]) => void) => {
          const docId  = (globalThis as any).__docId  as number | undefined;
          const userId = (globalThis as any).__userId as string;
          if (docId == null) return Promise.resolve([]).then(resolve);
          const row = DOCUMENTOS.find((d) => d.id === docId && d.userId === userId);
          return Promise.resolve(row ? [row] : []).then(resolve);
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

const { pdfRouter } = await import("./pdf-router");

function makeCtx(userId = "u1", email = "u1@test.cl") {
  return {
    user: { id: userId, role: "abogado" as const, email },
  } as any;
}

beforeEach(() => {
  (globalThis as any).__userId = "u1";
  (globalThis as any).__docId  = undefined;
});

// ─── pdf.exportDocumento — inline contenido ────────────────────────────────

describe("pdf.exportDocumento with inline contenido", () => {
  it("returns {filename, base64, mimeType, bytes} and base64 decodes to the fake PDF buffer", async () => {
    const caller = pdfRouter.createCaller(makeCtx());
    const result = await caller.exportDocumento({
      tipo: "generico",
      contenido: { title: "Mi Documento", body: "Cuerpo del PDF" },
    });
    expect(typeof result.filename).toBe("string");
    expect(typeof result.base64).toBe("string");
    expect(result.mimeType).toBe("application/pdf");
    expect(typeof result.bytes).toBe("number");

    // base64 should decode back to the fake buffer starting with %PDF
    const decoded = Buffer.from(result.base64, "base64");
    expect(decoded.toString().startsWith("%PDF")).toBe(true);
  });

  it("filename includes the tipo slug and today's ISO date", async () => {
    const caller = pdfRouter.createCaller(makeCtx());
    const result = await caller.exportDocumento({
      tipo: "karin-acta",
      contenido: { title: "Acta de Recepción", body: "Contenido" },
    });
    const today = new Date().toISOString().slice(0, 10);
    expect(result.filename).toContain("karin-acta");
    expect(result.filename).toContain(today);
    expect(result.filename).toEndWith(".pdf");
  });

  it("throws BAD_REQUEST when neither documentoId nor contenido is provided", async () => {
    const caller = pdfRouter.createCaller(makeCtx());
    await expect(
      caller.exportDocumento({ tipo: "generico" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws validation error when contenido.body is empty string", async () => {
    const caller = pdfRouter.createCaller(makeCtx());
    await expect(
      caller.exportDocumento({
        tipo: "generico",
        contenido: { title: "Titulo", body: "" },
      })
    ).rejects.toThrow(); // zod min(1) rejects empty body
  });
});

// ─── pdf.exportDocumento — documentoId path ───────────────────────────────

describe("pdf.exportDocumento with documentoId", () => {
  it("fetches document from DB by id + userId and generates PDF", async () => {
    (globalThis as any).__userId = "u1";
    (globalThis as any).__docId  = 1;
    const caller = pdfRouter.createCaller(makeCtx("u1"));
    const result = await caller.exportDocumento({
      tipo: "generico",
      documentoId: 1,
    });
    expect(result.filename).toContain("1");
    const decoded = Buffer.from(result.base64, "base64");
    expect(decoded.toString().startsWith("%PDF")).toBe(true);
  });

  it("throws NOT_FOUND when documentoId belongs to a different user (cross-tenant)", async () => {
    // u1 tries to export doc id=2 which belongs to u2
    (globalThis as any).__userId = "u1";
    (globalThis as any).__docId  = 2; // doc 2 belongs to u2; mock filters by userId=u1 → not found
    const caller = pdfRouter.createCaller(makeCtx("u1"));
    await expect(
      caller.exportDocumento({ tipo: "generico", documentoId: 2 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws NOT_FOUND when documentoId does not exist at all", async () => {
    (globalThis as any).__userId = "u1";
    (globalThis as any).__docId  = 9999;
    const caller = pdfRouter.createCaller(makeCtx("u1"));
    await expect(
      caller.exportDocumento({ tipo: "generico", documentoId: 9999 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
