import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { createRouter, publicQuery, authedQuery } from './middleware';
import { getDb } from './queries/connection';
import { subscriptions } from '@db/schema-billing';
import { PLANS } from './lib/billing/types';
import {
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  cancelSubscriptionAtPeriodEnd,
} from './lib/billing/stripe';
import { createDlocalPayment } from './lib/billing/dlocal';

export const billingRouter = createRouter({
  // ─── Public: list all plans ────────────────────────────────────────
  plans: publicQuery.query(() => PLANS),

  // ─── Authed: get caller's current plan ────────────────────────────
  currentPlan: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, ctx.user.id))
      .limit(1);

    if (rows.length === 0) return { plan: 'free' as const, subscription: null };
    return { plan: rows[0].plan, subscription: rows[0] };
  }),

  // ─── Authed: create checkout session (Stripe or dLocal) ───────────
  createCheckout: authedQuery
    .input(
      z.object({
        plan: z.enum(['starter', 'pro']),
        provider: z.enum(['stripe', 'dlocal']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const baseUrl =
        process.env.APP_URL ?? 'http://localhost:5173';
      const successUrl = `${baseUrl}/billing?success=1`;
      const cancelUrl = `${baseUrl}/billing?canceled=1`;

      if (input.provider === 'stripe') {
        const { url } = await createCheckoutSession(
          ctx.user.id,
          input.plan,
          successUrl,
          cancelUrl,
        );
        return { url };
      }

      // dLocal provider
      const planConfig = PLANS[input.plan];
      const notifyUrl = `${baseUrl}/api/trpc/billing.webhook`;
      const { redirectUrl } = await createDlocalPayment(
        ctx.user.id,
        input.plan,
        planConfig.price,
        notifyUrl,
      );
      return { url: redirectUrl };
    }),

  // ─── Public: Stripe webhook ────────────────────────────────────────
  webhook: publicQuery
    .input(
      z.object({
        rawBody: z.string(),
        signature: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      let event;
      try {
        event = await handleWebhook(input.rawBody, input.signature);
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Webhook signature verification failed: ${String(err)}`,
        });
      }

      const db = getDb();

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as {
          metadata?: { userId?: string; plan?: string };
          subscription?: string;
          customer?: string;
        };
        const userId = Number(session.metadata?.userId);
        const plan = session.metadata?.plan as 'starter' | 'pro' | undefined;
        const subscriptionId = session.subscription;

        if (userId && plan && subscriptionId) {
          const existing = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, userId))
            .limit(1);

          const now = new Date();
          const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

          if (existing.length > 0) {
            await db
              .update(subscriptions)
              .set({
                plan,
                provider: 'stripe',
                externalId: subscriptionId,
                status: 'active',
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false,
                updatedAt: now,
              })
              .where(eq(subscriptions.userId, userId));
          } else {
            await db.insert(subscriptions).values({
              userId,
              plan,
              provider: 'stripe',
              externalId: subscriptionId,
              status: 'active',
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: false,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }

      if (
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted'
      ) {
        const sub = event.data.object as {
          id: string;
          status: string;
          cancel_at_period_end: boolean;
          current_period_end: number;
        };

        const status = event.type === 'customer.subscription.deleted'
          ? 'canceled'
          : (sub.status as 'active' | 'past_due' | 'canceled' | 'trialing');

        const rows = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.externalId, sub.id))
          .limit(1);

        if (rows.length > 0) {
          await db
            .update(subscriptions)
            .set({
              status,
              cancelAtPeriodEnd: sub.cancel_at_period_end,
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.externalId, sub.id));
        }
      }

      return { received: true };
    }),

  // ─── Authed: cancel subscription at period end ────────────────────
  cancelSubscription: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, ctx.user.id))
      .limit(1);

    if (rows.length === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'No active subscription' });
    }

    const sub = rows[0];
    if (sub.provider !== 'stripe' || !sub.externalId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only Stripe subscriptions can be cancelled via this endpoint',
      });
    }

    await cancelSubscriptionAtPeriodEnd(sub.externalId);

    await db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
      .where(eq(subscriptions.userId, ctx.user.id));

    return { ok: true };
  }),

  // ─── Authed: Stripe customer portal session ───────────────────────
  portalSession: authedQuery
    .input(z.object({ returnUrl: z.string().url().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, ctx.user.id))
        .limit(1);

      if (rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No subscription found' });
      }

      const sub = rows[0];
      if (sub.provider !== 'stripe' || !sub.externalId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Portal only available for Stripe subscriptions',
        });
      }

      // We need the Stripe customer ID; we store subscriptionId in externalId
      // so we fetch the subscription to get the customer
      const { default: Stripe } = await import('stripe');
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'STRIPE_SECRET_KEY not configured' });
      const stripe = new Stripe(stripeKey);
      const stripeSub = await stripe.subscriptions.retrieve(sub.externalId);
      const customerId = typeof stripeSub.customer === 'string'
        ? stripeSub.customer
        : stripeSub.customer.id;

      const baseUrl = process.env.APP_URL ?? 'http://localhost:5173';
      const returnUrl = input.returnUrl ?? `${baseUrl}/billing`;

      const { url } = await createPortalSession(customerId, returnUrl);
      return { url };
    }),
});
