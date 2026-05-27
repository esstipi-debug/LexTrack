import Stripe from 'stripe';
import type { Plan } from './types';
import { PLANS } from './types';

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  // Stripe v16 latest stable API version
  return new Stripe(key);
}

export async function createCheckoutSession(
  userId: number,
  plan: Exclude<Plan, 'free'>,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string }> {
  const stripe = getStripeClient();
  const planConfig = PLANS[plan];

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: planConfig.currency.toLowerCase(),
          product_data: {
            name: planConfig.name,
            description: planConfig.features.join(', '),
          },
          unit_amount: planConfig.price,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      },
    ],
    metadata: { userId: String(userId), plan },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL');
  }

  return { url: session.url };
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const stripe = getStripeClient();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

export async function handleWebhook(
  rawBody: string,
  signature: string,
): Promise<Stripe.Event> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  }
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

export async function getSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();
  return stripe.subscriptions.retrieve(subscriptionId);
}

export async function cancelSubscriptionAtPeriodEnd(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}
