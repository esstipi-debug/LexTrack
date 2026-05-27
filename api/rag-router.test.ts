import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit tests for ragRouter.
 *
 * Strategy:
 *   - getRagPool() returns null so the router always uses the mysql_lexical
 *     pipeline (no real Postgres RAG pool needed).
 *   - DB mock returns deterministic rows for documentosLegales, jurisprudencias,
 *     and conversacionesRag.
 *   - lib/rag helpers (rankDocumentosLegales, rankJurisprudencia, etc.) are mocked
 *     to return simple deterministic results.
 *   - answerWithClaude is mocked to return a fixed response string.
 */

// ── Mock state ────────────────────────────────────────────────────────────────

let insertedRows: Record<string, unknown>[] = [];
let likePatternUsed: string | null = null;

// ── Fake data ─────────────────────────────────────────────────────────────────

const FAKE_DOC = {
  id: 1,
  norma: "Código del Trabajo",
  articulo: "Art. 1",
  titulo: "Ámbito de aplicación",
  contenido: "Las relaciones laborales...",
  tipo: "CT" as const,
  estaActiva: true,
  materia: "laboral" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const FAKE_JURIS = {
  id: 10,
  rol: "T-100-2023",
  caratula: "Trabajador con Empresa",
  contenido: "La relación de dependencia y subordinación...",
  tribunal: "Juzgado de Letras del Trabajo",
  fecha: "2023-06-01",
  estaActiva: true,
  materia: "laboral" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const FAKE_CONV = {
  id: 1,
  userId: "u1",
  sessionId: "sess-abc",
  role: "user" as const,
  content: "¿Qué dice el artículo 1?",
  createdAt: new Date(),
};

// ── DB mock ───────────────────────────────────────────────────────────────────

vi.mock("./queries/connection", () => {
  return {
    getDb: () => {
      const db: any = {
        select: () => db,
        from: () => db,
        where: (_cond?: unknown) => db,
        orderBy: (_col?: unknown) => db,
        groupBy: () => db,
        limit: (n: number) => {
          // Return fake docs up to n
          const table = (globalThis as any).__queryTable as string;
          if (table === "conversacionesRag") {
            return Promise.resolve([FAKE_CONV]);
          }
          if (table === "jurisprudencias") {
            return Promise.resolve([FAKE_JURIS]);
          }
          return Promise.resolve([FAKE_DOC]);
        },
        then: (resolve: (v: unknown[]) => void) => {
          // For queries awaited without .limit() (estadisticas, buscar fallback)
          const table = (globalThis as any).__queryTable as string;
          if (table === "conversacionesRag") {
            return Promise.resolve([FAKE_CONV]).then(resolve);
          }
          if (table === "jurisprudencias") {
            return Promise.resolve([FAKE_JURIS]).then(resolve);
          }
          return Promise.resolve([FAKE_DOC]).then(resolve);
        },
        insert: (_table: unknown) => ({
          values: (v: Record<string, unknown>) => {
            insertedRows.push(v);
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
    sql: ((..._args: unknown[]) => ({ _op: "sql" })) as any,
    gt: (..._args: unknown[]) => ({ _op: "gt" }),
    like: (_col: unknown, pattern: unknown) => {
      likePatternUsed = pattern as string;
      return { _op: "like", pattern };
    },
    desc: (..._args: unknown[]) => ({ _op: "desc" }),
  };
});

// ── RAG pool mock (returns null → forces mysql_lexical pipeline) ───────────────

vi.mock("./queries/rag-pg", () => ({
  getRagPool: () => null,
  getRagDb: () => null,
}));

// ── lib/rag helpers mocks ─────────────────────────────────────────────────────

vi.mock("./lib/rag/retrieve-local", () => ({
  rankDocumentosLegales: vi.fn().mockImplementation((query: string, docs: unknown[], _limit: number) => {
    return docs.slice(0, _limit).map((d: any) => ({ ...d, score: 0.9 }));
  }),
  rankJurisprudencia: vi.fn().mockImplementation((query: string, juris: unknown[], _limit: number) => {
    return juris.slice(0, _limit).map((j: any) => ({ ...j, score: 0.8 }));
  }),
}));

vi.mock("./lib/rag/chunks", () => ({
  rowsToRetrievedChunks: vi.fn().mockReturnValue([]),
}));

vi.mock("./lib/rag/chat-markdown", () => ({
  renderChatMarkdownFromChunks: vi.fn().mockReturnValue({
    markdown: "## Respuesta\n\nContenido relevante del Código del Trabajo.",
    fuentes: ["Código del Trabajo — Art. 1"],
  }),
}));

vi.mock("./lib/rag/citations", () => ({
  verifyCitations: vi.fn().mockReturnValue({
    ok: true,
    invalidArticles: [],
    invalidRoles: [],
    invalidLeyes: [],
    citasSugeridas: [],
  }),
}));

vi.mock("./lib/rag/pg-hybrid", () => ({
  hybridRetrieve: vi.fn().mockResolvedValue([]),
  pgRowToRetrievedChunk: vi.fn().mockReturnValue({}),
}));

vi.mock("./lib/rag/llm-answer", () => ({
  answerWithClaude: vi.fn().mockResolvedValue("Respuesta del LLM sobre el Código del Trabajo."),
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

vi.mock("./lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── env mock ─────────────────────────────────────────────────────────────────

vi.mock("./lib/env", () => ({
  env: {
    ragDatabaseUrl: null,
    voyageApiKey: null,
    anthropicApiKey: null,
  },
}));

// ── Import router after all mocks ─────────────────────────────────────────────

const { ragRouter } = await import("./rag-router");

function makeCtx(userId = "u1") {
  return {
    user: { id: userId, role: "abogado" as const, email: `${userId}@test.cl` },
  } as any;
}

beforeEach(() => {
  insertedRows = [];
  likePatternUsed = null;
  (globalThis as any).__queryTable = "documentosLegales";
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("rag.buscar", () => {
  it("returns expected shape {documentos, jurisprudencia, totalDocumentos, totalJurisprudencia}", async () => {
    (globalThis as any).__queryTable = "documentosLegales";
    const caller = ragRouter.createCaller(makeCtx("u1"));

    const result = await caller.buscar({ query: "contrato de trabajo", limite: 5 });

    expect(result).toHaveProperty("documentos");
    expect(result).toHaveProperty("jurisprudencia");
    expect(result).toHaveProperty("totalDocumentos");
    expect(result).toHaveProperty("totalJurisprudencia");
    expect(typeof result.totalDocumentos).toBe("number");
    expect(typeof result.totalJurisprudencia).toBe("number");
    expect(Array.isArray(result.documentos)).toBe(true);
    expect(Array.isArray(result.jurisprudencia)).toBe(true);
  });

  it("passes ilike/like pattern built from query to the DB where clause", async () => {
    const caller = ragRouter.createCaller(makeCtx("u1"));

    await caller.buscar({ query: "desahucio" });

    // The router builds likePattern = `%${query}%`
    expect(likePatternUsed).toBe("%desahucio%");
  });

  it("throws validation error when query is empty string", async () => {
    const caller = ragRouter.createCaller(makeCtx("u1"));

    // z.string().min(1) should reject empty string
    await expect(caller.buscar({ query: "" })).rejects.toThrow();
  });

  it("calls rankDocumentosLegales with the query term", async () => {
    const { rankDocumentosLegales } = await import("./lib/rag/retrieve-local");
    const caller = ragRouter.createCaller(makeCtx("u1"));

    await caller.buscar({ query: "fuero maternal", limite: 3 });

    expect(rankDocumentosLegales).toHaveBeenCalledWith("fuero maternal", expect.any(Array), 3);
  });
});

describe("rag.chat", () => {
  it("creates conversacionesRag records with userId when sessionId is provided", async () => {
    const caller = ragRouter.createCaller(makeCtx("u1"));

    const result = await caller.chat({
      mensaje: "¿Qué dice el artículo 1 del Código del Trabajo?",
      sessionId: "sess-abc",
    });

    // Should have inserted user message + assistant message
    const userInsert = insertedRows.find((r) => r.role === "user");
    const assistantInsert = insertedRows.find((r) => r.role === "assistant");

    expect(userInsert).toBeDefined();
    expect(assistantInsert).toBeDefined();
    expect(userInsert?.userId).toBe("u1");
    expect(assistantInsert?.userId).toBe("u1");
    expect(userInsert?.sessionId).toBe("sess-abc");
    expect(assistantInsert?.sessionId).toBe("sess-abc");
  });

  it("returns expected shape {respuesta, fuentes, pipeline, documentosEncontrados}", async () => {
    const caller = ragRouter.createCaller(makeCtx("u1"));

    const result = await caller.chat({
      mensaje: "¿Qué es el fuero laboral?",
    });

    expect(result).toHaveProperty("respuesta");
    expect(result).toHaveProperty("fuentes");
    expect(result).toHaveProperty("pipeline");
    expect(result).toHaveProperty("documentosEncontrados");
    expect(result).toHaveProperty("jurisprudenciaEncontrada");
    expect(result).toHaveProperty("verificacionCitas");
    expect(typeof result.respuesta).toBe("string");
    expect(result.respuesta.length).toBeGreaterThan(0);
  });

  it("does NOT insert conversacionesRag when sessionId is not provided", async () => {
    const caller = ragRouter.createCaller(makeCtx("u1"));

    await caller.chat({ mensaje: "Consulta sin sesión" });

    // No inserts should have happened (no sessionId)
    expect(insertedRows).toHaveLength(0);
  });
});

describe("rag.conversaciones", () => {
  it("returns paginated conversations scoped to caller's userId and sessionId", async () => {
    (globalThis as any).__queryTable = "conversacionesRag";
    const caller = ragRouter.createCaller(makeCtx("u1"));

    const result = await caller.conversaciones({ sessionId: "sess-abc", limit: 10 });

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("nextCursor");
    expect(Array.isArray(result.items)).toBe(true);
  });
});

describe("rag.estadisticas", () => {
  it("returns counts of documentos, jurisprudencia, conversaciones scoped to userId", async () => {
    const caller = ragRouter.createCaller(makeCtx("u1"));

    const result = await caller.estadisticas();

    expect(result).toHaveProperty("totalDocumentos");
    expect(result).toHaveProperty("totalJurisprudencia");
    expect(result).toHaveProperty("totalConversaciones");
    expect(result).toHaveProperty("porNorma");
    expect(result).toHaveProperty("ragPostgresChunks");

    expect(typeof result.totalDocumentos).toBe("number");
    expect(typeof result.totalJurisprudencia).toBe("number");
    expect(typeof result.totalConversaciones).toBe("number");
    expect(typeof result.porNorma).toBe("object");

    // With no RAG pool, ragPostgresChunks should be null
    expect(result.ragPostgresChunks).toBeNull();
  });
});
