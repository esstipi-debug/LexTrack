import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * End-to-end tests for the Anthropic agent chat flow in api/agent-router.ts.
 *
 * Mocking strategy:
 * - We mock `./lib/anthropic` (the small wrapper around Anthropic's HTTP API)
 *   instead of `@anthropic-ai/sdk` because the wrapper is the actual boundary
 *   the router calls (`rawComplete`). Mocking here means zero network I/O and
 *   a tiny surface to maintain.
 * - We mock `./queries/connection` so tool executors (e.g. `listar_causas`)
 *   hit an in-memory fluent fake instead of a real DB.
 * - We mock `./lib/env` so `env.anthropicApiKey` is set (otherwise the router
 *   falls into the keyword fallback path before ever touching the loop).
 * - We mock `./queries/rag-pg` and `./lib/rag/*` so RAG doesn't kick in.
 * - We mock drizzle-orm helpers (eq/desc/and/sql) so they are callable stubs.
 *
 * Run with:  npm test api/agent-router
 */

// ── Anthropic mock ───────────────────────────────────────────────
// We push response objects onto __anthropicResponses; rawComplete pops the
// next one on each call. __anthropicCalls captures every (system,messages,tools)
// payload so individual tests can assert on what the loop sent.

type AnthResponse = {
  content: any[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens";
  usage?: { input_tokens: number; output_tokens: number };
};

const __anthropicState: {
  responses: AnthResponse[];
  calls: any[];
  loopForever: AnthResponse | null;
} = {
  responses: [],
  calls: [],
  loopForever: null,
};

vi.mock("./lib/anthropic", () => {
  return {
    rawComplete: vi.fn(async (params: any) => {
      __anthropicState.calls.push({
        system: params.system,
        messages: JSON.parse(JSON.stringify(params.messages)),
        tools: params.tools?.map((t: any) => t.name) ?? [],
      });
      if (__anthropicState.loopForever) {
        return {
          ...__anthropicState.loopForever,
          usage: { input_tokens: 0, output_tokens: 0 },
        };
      }
      const next = __anthropicState.responses.shift();
      if (!next) {
        throw new Error(
          `rawComplete called more times than mocked responses (call #${__anthropicState.calls.length})`,
        );
      }
      return { ...next, usage: { input_tokens: 0, output_tokens: 0 } };
    }),
    completeMessages: vi.fn(),
  };
});

// ── env mock: pretend ANTHROPIC_API_KEY is set ───────────────────
vi.mock("./lib/env", () => ({
  env: {
    anthropicApiKey: "test-key",
    anthropicModel: "claude-sonnet-test",
    voyageApiKey: "",
  },
}));

// ── RAG mocks (avoid hybrid path; force MySQL lexical fallback) ──
vi.mock("./queries/rag-pg", () => ({
  getRagPool: () => null,
}));
vi.mock("./lib/rag/retrieve-local", () => ({
  rankDocumentosLegales: (_q: string, docs: any[], n: number) =>
    docs.slice(0, n).map((d) => ({ ...d, score: 1 })),
  rankJurisprudencia: (_q: string, juris: any[], n: number) => juris.slice(0, n),
}));
vi.mock("./lib/rag/pg-hybrid", () => ({
  hybridRetrieve: async () => [],
  pgRowToRetrievedChunk: (r: any) => r,
}));

// ── External lib mocks ──────────────────────────────────────────
vi.mock("./lib/pjud/client", () => ({
  consultarCausa: async () => null,
  buscarPorRut: async () => [],
}));
vi.mock("./lib/pjud/sync", () => ({
  sincronizarCausa: async () => ({ ok: true }),
}));
vi.mock("./lib/dt", () => ({ buscarDictamenes: async () => [] }));
vi.mock("./lib/bcn", () => ({ buscarNormas: async () => [] }));
vi.mock("./lib/suprema", () => ({ buscarFallos: async () => [] }));
vi.mock("./lib/karin/documentos", () => ({
  generarActaRecepcion: () => "ACTA",
  generarInformeFinal: () => "INFORME",
  generarNotificacionMedidas: () => "NOTIF",
}));

// ── drizzle-orm operator stubs ───────────────────────────────────
vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    eq: (..._a: unknown[]) => ({ _op: "eq", _a }),
    desc: (..._a: unknown[]) => ({ _op: "desc", _a }),
    and: (..._a: unknown[]) => ({ _op: "and", _a }),
    sql: ((..._a: unknown[]) => ({ _op: "sql", _a })) as any,
    lt: (..._a: unknown[]) => ({ _op: "lt", _a }),
  };
});

// ── DB mock: a tiny fluent builder that returns from __dbState ───
// Each test sets __dbState.rows.<table> = [...] and __dbState.lastUserId
// captures the userId the executor filtered by.

type DbState = {
  rows: Record<string, any[]>;
  lastInsert: { table: string; values: any } | null;
  insertResult: any;
  capturedConditions: any[]; // every .where(...) condition object seen
};

const __dbState: DbState = {
  rows: {},
  lastInsert: null,
  insertResult: [{ insertId: 42 }],
  capturedConditions: [],
};

function makeBuilder(tableKey: string) {
  const builder: any = {
    _table: tableKey,
    where: (cond: unknown) => {
      __dbState.capturedConditions.push(cond);
      return builder;
    },
    orderBy: () => builder,
    limit: (_n: number) => Promise.resolve(__dbState.rows[tableKey] ?? []),
    then: (resolve: any, reject: any) =>
      Promise.resolve(__dbState.rows[tableKey] ?? []).then(resolve, reject),
  };
  return builder;
}

function tableKeyFromSchemaRef(t: any): string {
  // Drizzle table objects expose a Symbol-keyed name; fall back to the
  // table's `._.name` if available. For our purposes a stable per-call
  // string is enough — we attach a synthetic `__name` via the schema mock.
  return t?.__name ?? "unknown";
}

vi.mock("@db/schema", () => {
  const make = (name: string) => ({ __name: name });
  return {
    causas: make("causas"),
    tareas: make("tareas"),
    alertas: make("alertas"),
    honorarios: make("honorarios"),
    jurisprudencias: make("jurisprudencias"),
    documentosLegales: make("documentosLegales"),
    leykarinDenuncias: make("leykarinDenuncias"),
    leykarinActuaciones: make("leykarinActuaciones"),
    diarioOficialNormas: make("diarioOficialNormas"),
    cronologia: make("cronologia"),
    notas: make("notas"),
  };
});

vi.mock("./queries/connection", () => ({
  getDb: () => ({
    select: () => ({
      from: (t: any) => makeBuilder(tableKeyFromSchemaRef(t)),
    }),
    insert: (t: any) => ({
      values: async (v: any) => {
        __dbState.lastInsert = { table: tableKeyFromSchemaRef(t), values: v };
        return __dbState.insertResult;
      },
    }),
  }),
}));

// ── Import router AFTER all mocks are registered ─────────────────
const { agentRouter } = await import("./agent-router");

function ctxFor(userId = 1, role: "user" | "admin" = "user") {
  return {
    user: { id: userId, role, email: "test@lextrack.cl" },
  } as any;
}

function resetState() {
  __anthropicState.responses = [];
  __anthropicState.calls = [];
  __anthropicState.loopForever = null;
  __dbState.rows = {};
  __dbState.lastInsert = null;
  __dbState.insertResult = [{ insertId: 42 }];
  __dbState.capturedConditions = [];
}

beforeEach(() => {
  resetState();
});

describe("agent.chat — end-to-end (mocked Anthropic + DB)", () => {
  it("single-turn no tool: returns the text from end_turn response", async () => {
    __anthropicState.responses.push({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Hola, ¿en qué te ayudo?" }],
    });

    const caller = agentRouter.createCaller(ctxFor());
    const res = await caller.chat({ mensaje: "hola" });

    expect(res.respuesta).toBe("Hola, ¿en qué te ayudo?");
    expect(res.herramientasUsadas).toEqual([]);
    expect(res.tipo).toBe("agent");
    expect(__anthropicState.calls).toHaveLength(1);
  });

  it("single tool call success: dispatches tool, sends tool_result, returns final text", async () => {
    __dbState.rows["causas"] = [
      { id: 1, rit: "T-1-2025", caratula: "A vs B", tribunal: "JLT Stgo", estado: "tramitacion", materia: "laboral", fechaIngreso: "2025-01-01", createdAt: new Date() },
      { id: 2, rit: "T-2-2025", caratula: "C vs D", tribunal: "JLT Stgo", estado: "tramitacion", materia: "laboral", fechaIngreso: "2025-02-01", createdAt: new Date() },
      { id: 3, rit: "T-3-2025", caratula: "E vs F", tribunal: "JLT Stgo", estado: "tramitacion", materia: "laboral", fechaIngreso: "2025-03-01", createdAt: new Date() },
    ];

    __anthropicState.responses.push({
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "t1", name: "listar_causas", input: {} }],
    });
    __anthropicState.responses.push({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Tienes 3 causas" }],
    });

    const caller = agentRouter.createCaller(ctxFor(7));
    const res = await caller.chat({ mensaje: "¿cuántas causas tengo?" });

    expect(res.respuesta).toBe("Tienes 3 causas");
    expect(res.herramientasUsadas).toEqual(["listar_causas"]);
    expect(__anthropicState.calls).toHaveLength(2);

    // Second call must include the tool_result block from our dispatch
    const secondCallLast = __anthropicState.calls[1].messages.at(-1);
    expect(secondCallLast.role).toBe("user");
    expect(Array.isArray(secondCallLast.content)).toBe(true);
    const toolResultBlock = secondCallLast.content.find((b: any) => b.type === "tool_result");
    expect(toolResultBlock).toBeDefined();
    expect(toolResultBlock.tool_use_id).toBe("t1");
    expect(toolResultBlock.is_error).toBe(false);
    const parsed = JSON.parse(toolResultBlock.content);
    expect(parsed.total).toBe(3);
    expect(parsed.causas).toHaveLength(3);
  });

  it("two tools in series: tool_use → end_turn (with text) and second tool_use → end_turn — dispatch order preserved", async () => {
    __dbState.rows["causas"] = [{ id: 1, rit: "T-1-2025", caratula: "X vs Y", tribunal: "JLT", estado: "tramitacion", materia: "laboral", fechaIngreso: "2025-01-01", createdAt: new Date() }];
    __dbState.rows["tareas"] = [{ id: 9, titulo: "Revisar", estado: "pendiente", prioridad: "alta", fechaVencimiento: "2025-12-01", tipo: "otra", descripcion: "x" }];

    __anthropicState.responses.push({
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "t1", name: "listar_causas", input: {} }],
    });
    __anthropicState.responses.push({
      stop_reason: "tool_use",
      content: [
        { type: "text", text: "Voy a revisar las tareas..." },
        { type: "tool_use", id: "t2", name: "listar_tareas", input: {} },
      ],
    });
    __anthropicState.responses.push({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Listo, tienes 1 causa y 1 tarea." }],
    });

    const caller = agentRouter.createCaller(ctxFor(7));
    const res = await caller.chat({ mensaje: "resumen" });

    expect(res.respuesta).toBe("Listo, tienes 1 causa y 1 tarea.");
    expect(res.herramientasUsadas).toEqual(["listar_causas", "listar_tareas"]);
    expect(__anthropicState.calls).toHaveLength(3);
  });

  it("tool throws: result is wrapped into tool_result with is_error=true and the loop continues", async () => {
    // Force `consultar_pjud` to throw by re-mocking via a property override on
    // the already-mocked module is awkward; instead, point Anthropic to use
    // `sincronizar_causa`, whose backing function we re-spy to throw.
    const sync = await import("./lib/pjud/sync");
    const spy = vi.spyOn(sync, "sincronizarCausa").mockRejectedValueOnce(new Error("boom"));

    __anthropicState.responses.push({
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "t1", name: "sincronizar_causa", input: { causa_id: 42 } }],
    });
    __anthropicState.responses.push({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "No pude sincronizar." }],
    });

    const caller = agentRouter.createCaller(ctxFor(7));
    const res = await caller.chat({ mensaje: "sincroniza causa 42" });

    expect(res.respuesta).toBe("No pude sincronizar.");
    expect(spy).toHaveBeenCalled();

    const secondCallLast = __anthropicState.calls[1].messages.at(-1);
    const toolResultBlock = secondCallLast.content.find((b: any) => b.type === "tool_result");
    expect(toolResultBlock.is_error).toBe(true);
    const parsed = JSON.parse(toolResultBlock.content);
    expect(parsed.error).toMatch(/sincronizar_causa/);
    expect(parsed.error).toMatch(/boom/);
  });

  it("userId scoping: tool executor receives ctx.user.id from auth context", async () => {
    __dbState.rows["causas"] = [];

    __anthropicState.responses.push({
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "t1", name: "listar_causas", input: {} }],
    });
    __anthropicState.responses.push({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Sin causas." }],
    });

    const USER_ID = 4242;
    const caller = agentRouter.createCaller(ctxFor(USER_ID));
    await caller.chat({ mensaje: "mis causas" });

    // Drizzle's eq(causas.userId, userId) is stubbed to capture its args.
    // The first captured condition is and(eq(userId, USER_ID)).
    const firstCond = __dbState.capturedConditions[0];
    // and(...) stub stores args in _a; first child should be the userId eq.
    const eqArgs = firstCond._a?.[0]?._a ?? firstCond._a;
    expect(JSON.stringify(eqArgs)).toContain(String(USER_ID));
  });

  it("userId scoping (crear_tarea insert): values include the authenticated userId", async () => {
    __anthropicState.responses.push({
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "t1", name: "crear_tarea", input: { titulo: "Revisar contrato" } }],
    });
    __anthropicState.responses.push({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Tarea creada." }],
    });

    const caller = agentRouter.createCaller(ctxFor(99));
    await caller.chat({ mensaje: "crea una tarea para revisar contrato" });

    expect(__dbState.lastInsert).toBeTruthy();
    expect(__dbState.lastInsert!.table).toBe("tareas");
    expect(__dbState.lastInsert!.values.userId).toBe(99);
    expect(__dbState.lastInsert!.values.titulo).toBe("Revisar contrato");
  });

  it("max iterations guard: loop breaks after MAX_TOOL_ROUNDS even if Anthropic keeps returning tool_use", async () => {
    __dbState.rows["causas"] = [];
    __anthropicState.loopForever = {
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "loop", name: "listar_causas", input: {} }],
    };

    const caller = agentRouter.createCaller(ctxFor());
    const res = await caller.chat({ mensaje: "loop" });

    // MAX_TOOL_ROUNDS = 5 in agent-router.ts
    expect(__anthropicState.calls.length).toBe(5);
    // No end_turn ever arrived, so finalText is empty — but the request must
    // resolve cleanly without crashing.
    expect(res.respuesta).toBe("");
    expect(res.tipo).toBe("agent");
    expect(res.herramientasUsadas.length).toBe(5);
  });

  it("invalid tool name: tool_result has is_error=true with 'Herramienta desconocida' and loop continues", async () => {
    __anthropicState.responses.push({
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "x1", name: "no_existe", input: {} }],
    });
    __anthropicState.responses.push({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Esa herramienta no existe." }],
    });

    const caller = agentRouter.createCaller(ctxFor());
    const res = await caller.chat({ mensaje: "usa una herramienta inexistente" });

    expect(res.respuesta).toBe("Esa herramienta no existe.");
    const secondCallLast = __anthropicState.calls[1].messages.at(-1);
    const toolResultBlock = secondCallLast.content.find((b: any) => b.type === "tool_result");
    expect(toolResultBlock).toBeDefined();
    expect(toolResultBlock.is_error).toBe(true);
    const parsed = JSON.parse(toolResultBlock.content);
    expect(parsed.error).toMatch(/desconocida/i);
  });

  it("fallback path: returns 'fallback' tipo when no API key is configured", async () => {
    // Temporarily flip env. We re-import is not needed because the router
    // reads env at request time inside the mutation handler.
    const envMod: any = await import("./lib/env");
    const orig = envMod.env.anthropicApiKey;
    envMod.env.anthropicApiKey = "";
    try {
      const caller = agentRouter.createCaller(ctxFor());
      const res = await caller.chat({ mensaje: "hola" });
      expect(res.tipo).toBe("fallback");
    } finally {
      envMod.env.anthropicApiKey = orig;
    }
  });
});
