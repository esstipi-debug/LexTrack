import * as cookie from "cookie";
import { z } from "zod";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, causas, tareas, alertas, honorarios, leykarinDenuncias } from "@db/schema";
import { eq, count } from "drizzle-orm";

export const authRouter = createRouter({
  me: authedQuery.query((opts) => opts.ctx.user),

  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),

  updateProfile: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(255).optional(),
        avatar: z.string().url().max(2048).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.avatar !== undefined) updates.avatar = input.avatar;
      if (Object.keys(updates).length === 0) {
        return ctx.user;
      }
      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, ctx.user.id))
        .returning();
      return updated;
    }),

  giveConsent: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    // Idempotent: set consentedAt if not already consented, always mark onboarding complete
    await db
      .update(users)
      .set({
        ...(ctx.user.consentedAt ? {} : { consentedAt: new Date() }),
        hasCompletedOnboarding: true,
      })
      .where(eq(users.id, ctx.user.id));
    return { ok: true };
  }),

  dataExport: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;

    const [
      causasCount,
      tareasCount,
      alertasCount,
      honorariosCount,
      denunciasCount,
    ] = await Promise.all([
      db.select({ count: count() }).from(causas).where(eq(causas.userId, userId)),
      db.select({ count: count() }).from(tareas).where(eq(tareas.userId, userId)),
      db.select({ count: count() }).from(alertas).where(eq(alertas.userId, userId)),
      db.select({ count: count() }).from(honorarios).where(eq(honorarios.userId, userId)),
      db.select({ count: count() }).from(leykarinDenuncias).where(eq(leykarinDenuncias.userId, userId)),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email,
        avatar: ctx.user.avatar,
        role: ctx.user.role,
        createdAt: ctx.user.createdAt,
        consentedAt: ctx.user.consentedAt,
        hasCompletedOnboarding: ctx.user.hasCompletedOnboarding,
      },
      counts: {
        causas: Number(causasCount[0]?.count ?? 0),
        tareas: Number(tareasCount[0]?.count ?? 0),
        alertas: Number(alertasCount[0]?.count ?? 0),
        honorarios: Number(honorariosCount[0]?.count ?? 0),
        denunciasLeykarin: Number(denunciasCount[0]?.count ?? 0),
      },
    };
  }),
});
