export type Plan = 'free' | 'starter' | 'pro';
export type BillingProvider = 'stripe' | 'mercadopago';

export interface Subscription {
  userId: number;
  plan: Plan;
  provider: BillingProvider;
  externalId: string; // Stripe subscription ID or MercadoPago payment/preference ID
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export const PLANS = {
  free:    { name: 'Gratuito',    price: 0,    mpUnitPrice: 0,    currency: 'CLP', features: ['5 causas', '1 usuario'] },
  starter: { name: 'Profesional', price: 29900, mpUnitPrice: 29900, currency: 'CLP', features: ['50 causas', '3 usuarios', 'Agente IA', 'PJUD sync'] },
  pro:     { name: 'Firma',       price: 79900, mpUnitPrice: 79900, currency: 'CLP', features: ['Causas ilimitadas', '10 usuarios', 'Todo incluido', 'Soporte prioritario'] },
} as const;
