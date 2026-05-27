import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit tests for orgRouter.
 *
 * Mocking strategy:
 * - `./queries/connection` returns a per-table in-memory DB driven by `dbState`.
 *   The router does multiple sequential `select().from(orgMembers).where(...).limit(1)`
 *   calls within a single procedure (e.g. caller lookup then target lookup),
 *   so the mock supports a per-table "select queue": tests push successive
 *   result-sets into `dbState.queues.orgMembers` and each select pops one.
 *   If the queue is empty, the mock falls back to `dbState.<table>`.
 * - drizzle-orm `eq`/`and` are stubbed to callable markers.
 * - `@db/schema` is stubbed so each used table has a `__name`.
 * - `./lib/email/send` is mocked defensively even though the current
 *   org-router.ts doesn't import it — a parallel agent may add that call.
 * - `nanoid` is mocked to a deterministic value so tests can assert tokens.
 */

// ── nanoid mock ─────────────────────────────────────────────────
vi.mock("nanoid", () => ({
  nanoid: (len: number) => {
    const c = (globalThis as any).__nanoidCounter ?? 0;
    (globalThis as any).__nanoidCounter = c + 1;
    return `test-nanoid-${len}-${c + 1}`;
  },
}));

// ── email mock (defensive — see header) ─────────────────────────
vi.mock("./lib/email/send", () => ({
  sendEmail: vi.fn(async () => ({ ok: true })),
}));

// ── audit mock (avoid pino import via logger) ───────────────────
vi.mock("./lib/audit", () => ({
  audit: vi.fn(async () => undefined),
  auditFromCtx: vi.fn(async () => undefined),
}));

// ── logger mock ─────────────────────────────────────────────────
vi.mock("./lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── drizzle-orm stub ────────────────────────────────────────────
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

// ── Schema stub: each table is a marker with a __name ───────────
vi.mock("@db/schema", () => {
  const make = (name: string) => ({ __name: name });
  return {
    organizations: make("organizations"),
    orgMembers: make("orgMembers"),
    invites: make("invites"),
    users: make("users"),
  };
});

// ── DB mock with per-table select queues ────────────────────────
vi.mock("./queries/connection", () => {
  function tableName(t: any): string {
    return t?.__name ?? "unknown";
  }

  function makeSelectBuilder(table: string) {
    let isJoin = false;
    const builder: any = {
      from: (_t: any) => builder,
      innerJoin: (_t: any, _cond: any) => {
        isJoin = true;
        return builder;
      },
      where: (_cond: unknown) => builder,
      orderBy: () => builder,
      limit: (_n: number) => Promise.resolve(resolveRows()),
      then: (resolve: any, reject: any) =>
        Promise.resolve(resolveRows()).then(resolve, reject),
    };
    function resolveRows() {
      const state = (globalThis as any).__dbState;
      if (isJoin && state.joinResult) return state.joinResult;
      const q = state.queues[table];
      if (q && q.length > 0) return q.shift();
      return state[table] ?? [];
    }
    return builder;
  }

  return {
    getDb: () => ({
      select: (_shape?: any) => ({
        from: (t: any) => makeSelectBuilder(tableName(t)),
      }),
      insert: (t: any) => ({
        values: (v: any) => {
          const name = tableName(t);
          const state = (globalThis as any).__dbState;
          const row = { id: state.nextInsertId++, ...v };
          state.lastInsert = { table: name, values: v };
          state[name] = state[name] ?? [];
          state[name].push(row);
          return {
            returning: async () => [row],
            then: (resolve: any) => Promise.resolve([row]).then(resolve),
          };
        },
      }),
      update: (t: any) => ({
        set: (v: any) => {
          const name = tableName(t);
          const state = (globalThis as any).__dbState;
          state.lastUpdate = { table: name, set: v };
          for (const row of state[name] ?? []) Object.assign(row, v);
          const whereChain: any = {
            returning: async () => state[name] ?? [],
            then: (resolve: any) => Promise.resolve().then(resolve),
          };
          return {
            where: () => whereChain,
            returning: async () => state[name] ?? [],
          };
        },
      }),
      delete: (t: any) => {
        const name = tableName(t);
        const state = (globalThis as any).__dbState;
        state.lastDelete = { table: name };
        return {
          where: () => {
            state[name] = [];
            return Promise.resolve();
          },
        };
      },
    }),
  };
});

// ── Import router AFTER all mocks ───────────────────────────────
const { orgRouter } = await import("./org-router");

type DbState = {
  organizations: any[];
  orgMembers: any[];
  invites: any[];
  users: any[];
  joinResult: any[] | null;
  queues: Record<string, any[][]>;
  lastInsert: { table: string; values: any } | null;
  lastUpdate: { table: string; set: any } | null;
  lastDelete: { table: string } | null;
  nextInsertId: number;
};

function ctxFor(userId = 1) {
  return {
    user: { id: userId, role: "user", email: "u@test.cl" },
  } as any;
}

function getState(): DbState {
  return (globalThis as any).__dbState as DbState;
}

beforeEach(() => {
  (globalThis as any).__dbState = {
    organizations: [],
    orgMembers: [],
    invites: [],
    users: [],
    joinResult: null,
    queues: { organizations: [], orgMembers: [], invites: [], users: [] },
    lastInsert: null,
    lastUpdate: null,
    lastDelete: null,
    nextInsertId: 100,
  };
  (globalThis as any).__nanoidCounter = 0;
});

// ── miOrg ────────────────────────────────────────────────────────
describe("org.miOrg", () => {
  it("returns null when user is not in any org", async () => {
    const caller = orgRouter.createCaller(ctxFor(1));
    const res = await caller.miOrg();
    expect(res).toBeNull();
  });

  it("returns org+role when user is a member", async () => {
    const state = getState();
    state.queues.orgMembers.push([
      { id: 1, orgId: 10, userId: 7, role: "admin", joinedAt: new Date() },
    ]);
    state.queues.organizations.push([
      { id: 10, nombre: "Acme Legal", slug: "acme-legal", plan: "free" },
    ]);
    const caller = orgRouter.createCaller(ctxFor(7));
    const res = await caller.miOrg();
    expect(res).not.toBeNull();
    expect(res!.nombre).toBe("Acme Legal");
    expect(res!.role).toBe("admin");
  });
});

// ── crear ────────────────────────────────────────────────────────
describe("org.crear", () => {
  it("creates an organization and makes caller owner", async () => {
    const state = getState();
    state.queues.orgMembers.push([]); // getCallerMember → no row
    state.queues.organizations.push([]); // slug check → no collision
    const caller = orgRouter.createCaller(ctxFor(5));
    const org = await caller.crear({ nombre: "Bufete Test" });

    expect(org.nombre).toBe("Bufete Test");
    expect(org.slug).toBe("bufete-test");
    expect(state.orgMembers.length).toBe(1);
    expect(state.orgMembers[0].role).toBe("owner");
    expect(state.orgMembers[0].userId).toBe(5);
  });

  it("auto-suffixes slug when it already exists", async () => {
    const state = getState();
    state.queues.orgMembers.push([]); // not in org
    state.queues.organizations.push([{ id: 1, slug: "bufete-test" }]); // collision
    const caller = orgRouter.createCaller(ctxFor(5));
    const org = await caller.crear({ nombre: "Bufete Test" });
    expect(org.slug).toMatch(/^bufete-test-/);
    expect(org.slug).not.toBe("bufete-test");
  });

  it("throws CONFLICT when caller is already in an org", async () => {
    const state = getState();
    state.queues.orgMembers.push([{ id: 1, orgId: 99, userId: 5, role: "owner" }]);
    const caller = orgRouter.createCaller(ctxFor(5));
    await expect(caller.crear({ nombre: "Otro" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("throws UNAUTHORIZED without a user", async () => {
    const caller = orgRouter.createCaller({} as any);
    await expect(caller.crear({ nombre: "X" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ── invitarMiembro ──────────────────────────────────────────────
describe("org.invitarMiembro", () => {
  it("owner can invite — creates an invite row", async () => {
    const state = getState();
    state.queues.orgMembers.push([{ id: 1, orgId: 10, userId: 7, role: "owner" }]);
    const caller = orgRouter.createCaller(ctxFor(7));
    const res = await caller.invitarMiembro({
      email: "newbie@test.cl",
      role: "member",
    });
    expect(res.token).toMatch(/^test-nanoid-/);
    expect(res.inviteUrl).toContain(res.token);
    expect(state.invites.length).toBe(1);
    expect(state.invites[0].email).toBe("newbie@test.cl");
    expect(state.invites[0].role).toBe("member");
    expect(state.invites[0].orgId).toBe(10);
  });

  it("admin can invite", async () => {
    const state = getState();
    state.queues.orgMembers.push([{ id: 1, orgId: 10, userId: 7, role: "admin" }]);
    const caller = orgRouter.createCaller(ctxFor(7));
    const res = await caller.invitarMiembro({ email: "x@test.cl", role: "admin" });
    expect(res.token).toBeTruthy();
    expect(state.invites.length).toBe(1);
  });

  it("plain member receives FORBIDDEN", async () => {
    const state = getState();
    state.queues.orgMembers.push([{ id: 1, orgId: 10, userId: 7, role: "member" }]);
    const caller = orgRouter.createCaller(ctxFor(7));
    await expect(
      caller.invitarMiembro({ email: "x@test.cl", role: "member" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("user with no org receives FORBIDDEN", async () => {
    const state = getState();
    state.queues.orgMembers.push([]);
    const caller = orgRouter.createCaller(ctxFor(7));
    await expect(
      caller.invitarMiembro({ email: "x@test.cl", role: "member" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects invalid email via zod", async () => {
    const state = getState();
    state.queues.orgMembers.push([{ id: 1, orgId: 10, userId: 7, role: "owner" }]);
    const caller = orgRouter.createCaller(ctxFor(7));
    await expect(
      caller.invitarMiembro({ email: "not-an-email", role: "member" }),
    ).rejects.toBeTruthy();
  });
});

// ── aceptarInvite ───────────────────────────────────────────────
describe("org.aceptarInvite", () => {
  it("happy path: pending + not expired + caller not in org → creates membership", async () => {
    const state = getState();
    const futureExp = new Date(Date.now() + 86400000);
    // 1st select: invites by token
    state.queues.invites.push([
      {
        id: 1,
        orgId: 10,
        invitedByUserId: 99,
        email: "x@test.cl",
        role: "admin",
        token: "tok-abc",
        status: "pending",
        expiresAt: futureExp,
      },
    ]);
    // 2nd select: orgMembers (alreadyMember check)
    state.queues.orgMembers.push([]);
    // 3rd select: organizations for nombre
    state.queues.organizations.push([{ id: 10, nombre: "Acme Legal" }]);

    const caller = orgRouter.createCaller(ctxFor(7));
    const res = await caller.aceptarInvite({ token: "tok-abc" });

    expect(res.orgId).toBe(10);
    expect(res.orgNombre).toBe("Acme Legal");
    expect(state.orgMembers.length).toBe(1);
    expect(state.orgMembers[0].userId).toBe(7);
    expect(state.orgMembers[0].role).toBe("admin");
    // last update sets invites.status = accepted
    expect(state.lastUpdate?.table).toBe("invites");
    expect(state.lastUpdate?.set.status).toBe("accepted");
  });

  it("NOT_FOUND when token doesn't exist", async () => {
    const state = getState();
    state.queues.invites.push([]);
    const caller = orgRouter.createCaller(ctxFor(7));
    await expect(caller.aceptarInvite({ token: "bogus" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("BAD_REQUEST when invite has been accepted", async () => {
    const state = getState();
    state.queues.invites.push([
      {
        id: 1,
        orgId: 10,
        email: "x@test.cl",
        role: "member",
        token: "tok",
        status: "accepted",
        expiresAt: new Date(Date.now() + 86400000),
      },
    ]);
    const caller = orgRouter.createCaller(ctxFor(7));
    await expect(caller.aceptarInvite({ token: "tok" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("BAD_REQUEST when invite is expired (and marks status='expired')", async () => {
    const state = getState();
    const pastExp = new Date(Date.now() - 86400000);
    state.queues.invites.push([
      {
        id: 1,
        orgId: 10,
        email: "x@test.cl",
        role: "member",
        token: "tok",
        status: "pending",
        expiresAt: pastExp,
      },
    ]);
    // The update call will mutate invites in dbState; seed the row so update
    // has something to flip.
    state.invites = [
      {
        id: 1,
        orgId: 10,
        email: "x@test.cl",
        role: "member",
        token: "tok",
        status: "pending",
        expiresAt: pastExp,
      },
    ];
    const caller = orgRouter.createCaller(ctxFor(7));
    await expect(caller.aceptarInvite({ token: "tok" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(state.lastUpdate?.set.status).toBe("expired");
  });

  it("CONFLICT when caller already belongs to an org", async () => {
    const state = getState();
    const futureExp = new Date(Date.now() + 86400000);
    state.queues.invites.push([
      {
        id: 1,
        orgId: 10,
        email: "x@test.cl",
        role: "member",
        token: "tok",
        status: "pending",
        expiresAt: futureExp,
      },
    ]);
    state.queues.orgMembers.push([{ id: 1, orgId: 99, userId: 7, role: "owner" }]);
    const caller = orgRouter.createCaller(ctxFor(7));
    await expect(caller.aceptarInvite({ token: "tok" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});

// ── miembros ────────────────────────────────────────────────────
describe("org.miembros", () => {
  it("returns the joined member list for the caller's org", async () => {
    const state = getState();
    state.queues.orgMembers.push([{ id: 1, orgId: 10, userId: 7, role: "owner" }]);
    state.joinResult = [
      {
        memberId: 1,
        role: "owner",
        joinedAt: new Date(),
        userId: 7,
        name: "Owner",
        email: "owner@test.cl",
        avatar: null,
      },
      {
        memberId: 2,
        role: "member",
        joinedAt: new Date(),
        userId: 8,
        name: "Member",
        email: "member@test.cl",
        avatar: null,
      },
    ];
    const caller = orgRouter.createCaller(ctxFor(7));
    const rows = await caller.miembros();
    expect(rows).toHaveLength(2);
    expect(rows[0].role).toBe("owner");
  });

  it("FORBIDDEN when caller is not in any org", async () => {
    const state = getState();
    state.queues.orgMembers.push([]);
    const caller = orgRouter.createCaller(ctxFor(7));
    await expect(caller.miembros()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ── removerMiembro ──────────────────────────────────────────────
describe("org.removerMiembro", () => {
  it("owner removes a non-owner member (happy path)", async () => {
    const state = getState();
    state.queues.orgMembers.push(
      [{ id: 1, orgId: 10, userId: 7, role: "owner" }], // caller lookup
      [{ id: 99, orgId: 10, userId: 8, role: "member" }], // target lookup
    );
    const caller = orgRouter.createCaller(ctxFor(7));
    const res = await caller.removerMiembro({ userId: 8 });
    expect(res.success).toBe(true);
    expect(state.lastDelete?.table).toBe("orgMembers");
  });

  it("FORBIDDEN when caller is admin (only owner can remove)", async () => {
    const state = getState();
    state.queues.orgMembers.push([{ id: 1, orgId: 10, userId: 7, role: "admin" }]);
    const caller = orgRouter.createCaller(ctxFor(7));
    await expect(caller.removerMiembro({ userId: 8 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("NOT_FOUND when target is not in the org", async () => {
    const state = getState();
    state.queues.orgMembers.push(
      [{ id: 1, orgId: 10, userId: 7, role: "owner" }],
      [],
    );
    const caller = orgRouter.createCaller(ctxFor(7));
    await expect(caller.removerMiembro({ userId: 999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("FORBIDDEN when trying to remove the owner", async () => {
    const state = getState();
    state.queues.orgMembers.push(
      [{ id: 1, orgId: 10, userId: 7, role: "owner" }],
      [{ id: 1, orgId: 10, userId: 7, role: "owner" }],
    );
    const caller = orgRouter.createCaller(ctxFor(7));
    await expect(caller.removerMiembro({ userId: 7 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

// ── actualizarOrg ───────────────────────────────────────────────
describe("org.actualizarOrg", () => {
  it("owner updates nombre", async () => {
    const state = getState();
    state.queues.orgMembers.push([{ id: 1, orgId: 10, userId: 7, role: "owner" }]);
    state.organizations = [{ id: 10, nombre: "Old", slug: "old" }];
    const caller = orgRouter.createCaller(ctxFor(7));
    const updated = await caller.actualizarOrg({ nombre: "New Name" });
    expect(updated.nombre).toBe("New Name");
    expect(state.lastUpdate?.set.nombre).toBe("New Name");
  });

  it("BAD_REQUEST when no fields provided", async () => {
    const state = getState();
    state.queues.orgMembers.push([{ id: 1, orgId: 10, userId: 7, role: "owner" }]);
    const caller = orgRouter.createCaller(ctxFor(7));
    await expect(caller.actualizarOrg({})).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("FORBIDDEN when caller is a plain member", async () => {
    const state = getState();
    state.queues.orgMembers.push([{ id: 1, orgId: 10, userId: 7, role: "member" }]);
    const caller = orgRouter.createCaller(ctxFor(7));
    await expect(caller.actualizarOrg({ nombre: "X" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
