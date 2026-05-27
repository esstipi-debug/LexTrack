import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import type { Plan } from './types';

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN ?? '',
  options: { timeout: 5000 },
});

export interface MpPreferenceResult {
  initPoint: string;
  preferenceId: string;
}

export interface MpWebhookResult {
  type: 'payment_approved' | 'payment_pending' | 'payment_rejected';
  userId: number;
  plan: string;
  paymentId: string;
}

/**
 * Creates a MercadoPago Preference (standard checkout flow for Chile/LatAm).
 * In dev (no MP_ACCESS_TOKEN), returns a mock preference so the app works
 * without real credentials.
 */
export async function createMpPreference(
  userId: number,
  plan: Exclude<Plan, 'free'>,
  successUrl: string,
  failureUrl: string,
  pendingUrl: string,
): Promise<MpPreferenceResult> {
  // Dev mock — return immediately without hitting the MP API
  if (!process.env.MP_ACCESS_TOKEN) {
    return {
      initPoint: 'https://sandbox.mercadopago.cl/checkout/v1/redirect?pref_id=mock',
      preferenceId: 'mock-pref-id',
    };
  }

  const { PLANS } = await import('./types');
  const planConfig = PLANS[plan];

  const preference = new Preference(client);
  const response = await preference.create({
    body: {
      items: [
        {
          id: `lextrack-${plan}`,
          title: `LexTrack ${planConfig.name}`,
          unit_price: planConfig.mpUnitPrice,
          quantity: 1,
          currency_id: 'CLP',
        },
      ],
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl,
      },
      auto_return: 'approved',
      external_reference: String(userId),
      metadata: {
        plan,
        userId,
      },
    },
  });

  return {
    initPoint: response.init_point ?? '',
    preferenceId: response.id ?? '',
  };
}

/**
 * Fetches a MercadoPago payment by ID and returns its status.
 */
export async function getMpPaymentStatus(paymentId: string) {
  const payment = new Payment(client);
  const response = await payment.get({ id: paymentId });
  return response;
}

/**
 * Processes an IPN/webhook notification from MercadoPago.
 * MP sends: { type: 'payment', data: { id: '<paymentId>' } }
 *
 * Returns a normalised result so billing-router can upsert the subscription.
 * Idempotency: callers are expected to check for an existing record keyed on
 * paymentId (externalId) before inserting — the router does this via upsert.
 */
export async function handleMpWebhook(body: unknown): Promise<MpWebhookResult> {
  const raw = body as { type?: string; data?: { id?: string } };

  if (raw?.type !== 'payment' || !raw?.data?.id) {
    throw new Error('Unrecognised MercadoPago webhook payload');
  }

  const paymentId = String(raw.data.id);
  const payment = await getMpPaymentStatus(paymentId);

  const statusRaw = payment.status ?? '';
  let type: MpWebhookResult['type'];
  if (statusRaw === 'approved') {
    type = 'payment_approved';
  } else if (statusRaw === 'rejected' || statusRaw === 'cancelled') {
    type = 'payment_rejected';
  } else {
    type = 'payment_pending';
  }

  const meta = payment.metadata as { plan?: string; user_id?: number | string } | undefined;
  const userId = Number(meta?.user_id ?? payment.external_reference ?? 0);
  const plan = String(meta?.plan ?? '');

  return { type, userId, plan, paymentId };
}
