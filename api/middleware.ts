import { ErrorMessages } from "@contracts/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { desc, eq } from "drizzle-orm";
import type { TrpcContext } from "./context";
import { getDb } from "./queries/connection";
import { subscriptions } from "@db/schema-billing";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

const requireAuth = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ErrorMessages.unauthenticated,
    });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

function requireRole(role: string) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== role) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: ErrorMessages.insufficientRole,
      });
    }

    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

export const authedQuery = t.procedure.use(requireAuth);
export const adminQuery = authedQuery.use(requireRole("admin"));

// ─── Subscription gate ────────────────────────────────────────────
// Allows access when:
//   - status='active'
//   - status='trialing' AND trialEndsAt > now
// Otherwise blocks with FORBIDDEN. Use for IA / scraper-backed features.
const requireActiveSubscription = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ErrorMessages.unauthenticated,
    });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, ctx.user.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  const sub = rows[0];

  if (!sub) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Sin suscripción activa",
    });
  }

  const now = new Date();

  if (sub.status === "active") {
    return next({ ctx: { ...ctx, user: ctx.user } });
  }

  if (
    sub.status === "trialing" &&
    sub.trialEndsAt &&
    sub.trialEndsAt.getTime() > now.getTime()
  ) {
    return next({ ctx: { ...ctx, user: ctx.user } });
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Prueba expirada. Activa un plan.",
  });
});

export const subscriptionGatedQuery = authedQuery.use(requireActiveSubscription);
