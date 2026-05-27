import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { organizations, orgMembers, invites, users } from "@db/schema";
import { createLogger } from "./lib/logger";
import { sendEmail } from "./lib/email/send";
import { inviteMiembro } from "./lib/email/templates";
import { auditFromCtx } from "./lib/audit";

const log = createLogger("org-router");

// ─── Helpers ─────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/** Returns the orgMember record for the caller, or null if they don't belong to any org. */
async function getCallerMember(userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** Asserts the caller is owner or admin of their org; returns the member record. */
async function requireOwnerOrAdmin(userId: number) {
  const member = await getCallerMember(userId);
  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No perteneces a ninguna organización.",
    });
  }
  if (member.role !== "owner" && member.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Solo owners y admins pueden realizar esta acción.",
    });
  }
  return member;
}

// ─── Router ──────────────────────────────────────────────────────

export const orgRouter = createRouter({
  /**
   * Returns the organization the current user belongs to, or null if none.
   */
  miOrg: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const member = await getCallerMember(ctx.user.id);
    if (!member) return null;

    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, member.orgId))
      .limit(1);

    return org[0] ? { ...org[0], role: member.role } : null;
  }),

  /**
   * Creates a new organization and makes the caller the owner.
   * Each user can only own/belong to one org.
   */
  crear: authedQuery
    .input(z.object({ nombre: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Enforce one-org-per-user
      const existing = await getCallerMember(ctx.user.id);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ya perteneces a una organización.",
        });
      }

      const slug = slugify(input.nombre);

      // Check slug uniqueness; append random suffix if taken
      const slugRows = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      const finalSlug =
        slugRows.length > 0 ? `${slug}-${nanoid(6).toLowerCase()}` : slug;

      const [org] = await db
        .insert(organizations)
        .values({
          nombre: input.nombre,
          slug: finalSlug,
        })
        .returning();

      await db.insert(orgMembers).values({
        orgId: org.id,
        userId: ctx.user.id,
        role: "owner",
      });

      log.info({ orgId: org.id, userId: ctx.user.id }, "Organización creada");
      // audit
      await auditFromCtx(ctx, {
        action: "org.create",
        tableName: "organizations",
        recordId: org.id,
        after: { id: org.id, nombre: org.nombre, slug: org.slug },
      });
      return org;
    }),

  /**
   * Sends (creates) an invitation to an email for the caller's org.
   * Caller must be owner or admin.
   */
  invitarMiembro: authedQuery
    .input(
      z.object({
        email: z.string().email().max(320),
        role: z.enum(["admin", "member"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const member = await requireOwnerOrAdmin(ctx.user.id);

      const token = nanoid(32);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const [invite] = await db
        .insert(invites)
        .values({
          orgId: member.orgId,
          invitedByUserId: ctx.user.id,
          email: input.email,
          role: input.role,
          token,
          expiresAt,
        })
        .returning();

      const inviteUrl = `${process.env.APP_URL}/invitar/${token}`;
      log.info(
        { inviteId: invite.id, orgId: member.orgId, email: input.email },
        "Invitación creada"
      );

      // Send invitation email — failures must NOT propagate
      try {
        const orgRows = await db
          .select({ nombre: organizations.nombre })
          .from(organizations)
          .where(eq(organizations.id, member.orgId))
          .limit(1);

        const invitadorNombre = ctx.user.name ?? ctx.user.email ?? "Un colega";
        const invitadorEmail = ctx.user.email ?? "";
        const orgNombre = orgRows[0]?.nombre ?? "tu organización";

        await sendEmail({
          to: input.email,
          template: inviteMiembro({
            invitadoEmail: input.email,
            invitadorNombre,
            invitadorEmail,
            orgNombre,
            role: input.role,
            inviteUrl,
            expiresAt: invite.expiresAt,
          }),
        });
      } catch (err) {
        log.error(
          { err, inviteId: invite.id, email: input.email },
          "No se pudo enviar email de invitación — invite creado igual"
        );
      }

      // audit
      await auditFromCtx(ctx, {
        action: "org.invite",
        tableName: "invites",
        recordId: invite.id,
        after: { email: input.email, role: input.role, orgId: member.orgId },
      });

      return { token: invite.token, inviteUrl };
    }),

  /**
   * Accepts an invite by token. Creates the orgMembers record and marks invite accepted.
   */
  aceptarInvite: authedQuery
    .input(z.object({ token: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const inviteRows = await db
        .select()
        .from(invites)
        .where(eq(invites.token, input.token))
        .limit(1);

      const invite = inviteRows[0];

      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitación no encontrada.",
        });
      }
      if (invite.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La invitación ya fue utilizada o expiró.",
        });
      }
      if (invite.expiresAt < new Date()) {
        await db
          .update(invites)
          .set({ status: "expired" })
          .where(eq(invites.id, invite.id));
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La invitación ha expirado.",
        });
      }

      // Check caller isn't already a member
      const alreadyMember = await getCallerMember(ctx.user.id);
      if (alreadyMember) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ya perteneces a una organización.",
        });
      }

      await db.insert(orgMembers).values({
        orgId: invite.orgId,
        userId: ctx.user.id,
        role: invite.role,
      });

      await db
        .update(invites)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(eq(invites.id, invite.id));

      const orgRows = await db
        .select({ id: organizations.id, nombre: organizations.nombre })
        .from(organizations)
        .where(eq(organizations.id, invite.orgId))
        .limit(1);

      log.info(
        { inviteId: invite.id, userId: ctx.user.id, orgId: invite.orgId },
        "Invitación aceptada"
      );

      // audit
      await auditFromCtx(ctx, {
        action: "org.acceptInvite",
        tableName: "org_members",
        recordId: invite.id,
        after: { orgId: invite.orgId, userId: ctx.user.id, role: invite.role },
      });

      return {
        orgId: invite.orgId,
        orgNombre: orgRows[0]?.nombre ?? "",
      };
    }),

  /**
   * Lists all members of the caller's org, joined with user details.
   */
  miembros: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const member = await getCallerMember(ctx.user.id);
    if (!member) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No perteneces a ninguna organización.",
      });
    }

    const rows = await db
      .select({
        memberId: orgMembers.id,
        role: orgMembers.role,
        joinedAt: orgMembers.joinedAt,
        userId: users.id,
        name: users.name,
        email: users.email,
        avatar: users.avatar,
      })
      .from(orgMembers)
      .innerJoin(users, eq(orgMembers.userId, users.id))
      .where(eq(orgMembers.orgId, member.orgId));

    return rows;
  }),

  /**
   * Removes a member from the caller's org. Caller must be owner. Cannot remove owner.
   */
  removerMiembro: authedQuery
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const callerMember = await getCallerMember(ctx.user.id);
      if (!callerMember || callerMember.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el owner puede remover miembros.",
        });
      }

      // Find the target member
      const targetRows = await db
        .select()
        .from(orgMembers)
        .where(
          and(
            eq(orgMembers.orgId, callerMember.orgId),
            eq(orgMembers.userId, input.userId)
          )
        )
        .limit(1);

      const target = targetRows[0];
      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Miembro no encontrado en esta organización.",
        });
      }
      if (target.role === "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No es posible remover al owner de la organización.",
        });
      }

      await db
        .delete(orgMembers)
        .where(eq(orgMembers.id, target.id));

      log.info(
        { orgId: callerMember.orgId, removedUserId: input.userId },
        "Miembro removido"
      );

      // audit
      await auditFromCtx(ctx, {
        action: "org.removeMember",
        tableName: "org_members",
        recordId: target.id,
        before: { orgId: callerMember.orgId, userId: input.userId, role: target.role },
      });

      return { success: true };
    }),

  /**
   * Updates the org's nombre and/or logoUrl. Caller must be owner or admin.
   */
  actualizarOrg: authedQuery
    .input(
      z.object({
        nombre: z.string().min(1).max(255).optional(),
        logoUrl: z.string().url().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const member = await requireOwnerOrAdmin(ctx.user.id);

      if (!input.nombre && !input.logoUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Debes enviar al menos un campo para actualizar.",
        });
      }

      const updates: Partial<{ nombre: string; logoUrl: string; updatedAt: Date }> =
        { updatedAt: new Date() };
      if (input.nombre) updates.nombre = input.nombre;
      if (input.logoUrl) updates.logoUrl = input.logoUrl;

      const [updated] = await db
        .update(organizations)
        .set(updates)
        .where(eq(organizations.id, member.orgId))
        .returning();

      log.info(
        { orgId: member.orgId, fields: Object.keys(updates) },
        "Organización actualizada"
      );

      return updated;
    }),
});
