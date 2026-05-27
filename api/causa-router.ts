import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { causas, tareas, alertas, cronologia, notas } from "@db/schema";
import { subscriptions } from "../db/schema-billing";
import { eq, desc, sql, and, lt, count } from "drizzle-orm";
import { auditFromCtx } from "./lib/audit";
import { getUserOrgIds, getPrimaryOrgId, visibleToUserCondition } from "./lib/org-scope";

async function checkPlanLimit(userId: number, db: ReturnType<typeof getDb>) {
  // Get user's current plan from subscriptions table
  const sub = await db.select({ plan: subscriptions.plan })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
    .limit(1);

  const plan = sub[0]?.plan ?? 'free';
  const limit = plan === 'pro' ? Infinity : plan === 'starter' ? 50 : 5;

  if (limit === Infinity) return; // pro has no limit

  // Plan limit applies per-user (matches existing legacy semantics — a user can
  // only create N personal causas; firm-shared causas counted via their author).
  const [{ count: currentCount }] = await db.select({ count: count() })
    .from(causas)
    .where(eq(causas.userId, userId));

  if (Number(currentCount) >= limit) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Tu plan ${plan} permite máximo ${limit} causas. Actualiza tu plan para continuar.`,
    });
  }
}

const paginationInput = z.object({
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.number().int().positive().nullish(),
});

export const causaRouter = createRouter({
  listar: authedQuery
    .input(paginationInput.optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const limit = Math.min(input?.limit ?? 20, 100);
      const cursor = input?.cursor ?? null;
      const orgIds = await getUserOrgIds(ctx.user.id);
      const visibility = visibleToUserCondition(
        causas.userId,
        causas.orgId,
        ctx.user.id,
        orgIds,
      );
      const rows = await db
        .select()
        .from(causas)
        .where(
          and(
            visibility,
            cursor ? lt(causas.id, cursor) : undefined
          )
        )
        .orderBy(desc(causas.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1].id : null;
      return { items, nextCursor };
    }),

  crear: authedQuery
    .input(
      z.object({
        rit: z.string(),
        ruc: z.string().optional(),
        caratula: z.string(),
        tribunal: z.string(),
        comuna: z.string().optional(),
        region: z.string().optional(),
        materia: z.string().default("laboral"),
        estado: z.string().default("tramitacion"),
        etapa: z.string().optional(),
        fechaIngreso: z.string().optional(),
        litigantes: z.string().optional(),
        abogadoDemandante: z.string().optional(),
        abogadoDemandado: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await checkPlanLimit(ctx.user.id, db);
      const orgId = await getPrimaryOrgId(ctx.user.id);
      const values: Record<string, unknown> = {
        ...input,
        userId: ctx.user.id,
        orgId, // null if user has no firm; firm id otherwise (auto-share within firm)
      };
      if (input.fechaIngreso) values.fechaIngreso = new Date(input.fechaIngreso);
      delete (values as any).datos;
      await db.insert(causas).values(values as any);
      // audit
      await auditFromCtx(ctx, {
        action: "causa.create",
        tableName: "causas",
        after: values,
      });
      return { ok: true };
    }),

  obtener: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const orgIds = await getUserOrgIds(ctx.user.id);
      const causaVis = visibleToUserCondition(
        causas.userId,
        causas.orgId,
        ctx.user.id,
        orgIds,
      );
      const causa = await db
        .select()
        .from(causas)
        .where(and(eq(causas.id, input.id), causaVis))
        .limit(1);
      if (causa.length === 0) return null;
      const tareaVis = visibleToUserCondition(
        tareas.userId,
        tareas.orgId,
        ctx.user.id,
        orgIds,
      );
      const alertaVis = visibleToUserCondition(
        alertas.userId,
        alertas.orgId,
        ctx.user.id,
        orgIds,
      );
      // cronologia & notas stay per-user — these tables do not (yet) carry orgId.
      const tareasCausa = await db
        .select()
        .from(tareas)
        .where(and(eq(tareas.causaId, input.id), tareaVis));
      const alertasCausa = await db
        .select()
        .from(alertas)
        .where(and(eq(alertas.causaId, input.id), alertaVis));
      const cronologiaCausa = await db
        .select()
        .from(cronologia)
        .where(
          and(eq(cronologia.causaId, input.id), eq(cronologia.userId, ctx.user.id))
        );
      const notasCausa = await db
        .select()
        .from(notas)
        .where(and(eq(notas.causaId, input.id), eq(notas.userId, ctx.user.id)));
      return { ...causa[0], tareas: tareasCausa, alertas: alertasCausa, cronologia: cronologiaCausa, notas: notasCausa };
    }),

  actualizar: authedQuery
    .input(
      z.object({
        id: z.number(),
        datos: z.object({
          rit: z.string().optional(),
          ruc: z.string().optional(),
          rol: z.string().optional(),
          caratula: z.string().optional(),
          tribunal: z.string().optional(),
          comuna: z.string().optional(),
          region: z.string().optional(),
          materia: z.string().optional(),
          estado: z.string().optional(),
          etapa: z.string().optional(),
          fechaIngreso: z.string().optional(),
          litigantes: z.string().optional(),
          abogadoDemandante: z.string().optional(),
          abogadoDemandado: z.string().optional(),
          expedienteId: z.number().optional(),
          estaMonitoreando: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const orgIds = await getUserOrgIds(ctx.user.id);
      const visibility = visibleToUserCondition(
        causas.userId,
        causas.orgId,
        ctx.user.id,
        orgIds,
      );
      // fetch before for audit
      const [before] = await db
        .select()
        .from(causas)
        .where(and(eq(causas.id, input.id), visibility))
        .limit(1);
      await db
        .update(causas)
        .set(input.datos)
        .where(and(eq(causas.id, input.id), visibility));
      // audit
      await auditFromCtx(ctx, {
        action: "causa.update",
        tableName: "causas",
        recordId: input.id,
        before: before ?? null,
        after: input.datos,
      });
      return { ok: true };
    }),

  buscar: authedQuery
    .input(z.object({ termino: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const orgIds = await getUserOrgIds(ctx.user.id);
      const visibility = visibleToUserCondition(
        causas.userId,
        causas.orgId,
        ctx.user.id,
        orgIds,
      );
      return db
        .select()
        .from(causas)
        .where(
          and(
            visibility,
            sql`${causas.caratula} ILIKE ${"%" + input.termino + "%"} OR ${causas.rit} ILIKE ${"%" + input.termino + "%"} OR ${causas.ruc} ILIKE ${"%" + input.termino + "%"}`
          )
        )
        .limit(10);
    }),

  crearNota: authedQuery
    .input(z.object({
      causaId: z.number(),
      contenido: z.string(),
      tipo: z.string().default("general"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.insert(notas).values({
        userId: ctx.user.id,
        causaId: input.causaId,
        contenido: input.contenido,
        tipo: input.tipo as any,
      });
      return { ok: true };
    }),
});
