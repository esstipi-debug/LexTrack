import { createHmac } from 'crypto';
import type { Plan } from './types';

const DLOCAL_API_BASE = 'https://api.dlocal.com';

interface DlocalPaymentResponse {
  redirectUrl: string;
  orderId: string;
}

interface DlocalStatusResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
  order_id: string;
}

function buildDlocalHeaders(login: string, secretKey: string, body: string): Record<string, string> {
  const date = new Date().toISOString();
  const xLogin = login;
  // dLocal HMAC-SHA256 signature: X-Login + X-Date + body
  const toSign = xLogin + date + body;
  const signature = createHmac('sha256', secretKey).update(toSign).digest('hex');
  return {
    'Content-Type': 'application/json',
    'X-Date': date,
    'X-Login': xLogin,
    'X-Trans-Key': secretKey,
    Authorization: `V2-HMAC-SHA256, Signature: ${signature}`,
  };
}

export async function createDlocalPayment(
  userId: number,
  plan: Exclude<Plan, 'free'>,
  amount: number,
  notifyUrl: string,
): Promise<DlocalPaymentResponse> {
  const login = process.env.DLOCAL_X_LOGIN;
  const secretKey = process.env.DLOCAL_SECRET_KEY;

  // Dev mock: return a fake redirect when credentials are absent
  if (!login || !secretKey) {
    if (process.env.NODE_ENV !== 'production') {
      return {
        redirectUrl: `http://localhost:5173/billing?mock=1&plan=${plan}&userId=${userId}`,
        orderId: `mock-order-${Date.now()}`,
      };
    }
    throw new Error('DLOCAL_X_LOGIN and DLOCAL_SECRET_KEY not configured');
  }

  const orderId = `lex-${userId}-${Date.now()}`;
  const payload = {
    amount,
    currency: 'CLP',
    country: 'CL',
    payment_method_id: 'CARD',
    payment_method_flow: 'REDIRECT',
    order_id: orderId,
    notification_url: notifyUrl,
    description: `LexTrack plan ${plan}`,
    payer: { name: `User ${userId}` },
  };

  const body = JSON.stringify(payload);
  const headers = buildDlocalHeaders(login, secretKey, body);

  const res = await fetch(`${DLOCAL_API_BASE}/payments`, {
    method: 'POST',
    headers,
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`dLocal payment creation failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { redirect_url?: string; id?: string };
  return {
    redirectUrl: data.redirect_url ?? '',
    orderId: data.id ?? orderId,
  };
}

export async function getDlocalPaymentStatus(
  orderId: string,
): Promise<DlocalStatusResponse> {
  const login = process.env.DLOCAL_X_LOGIN;
  const secretKey = process.env.DLOCAL_SECRET_KEY;

  if (!login || !secretKey) {
    if (process.env.NODE_ENV !== 'production') {
      return {
        id: orderId,
        status: 'PENDING',
        amount: 0,
        currency: 'CLP',
        order_id: orderId,
      };
    }
    throw new Error('DLOCAL_X_LOGIN and DLOCAL_SECRET_KEY not configured');
  }

  const body = '';
  const headers = buildDlocalHeaders(login, secretKey, body);

  const res = await fetch(`${DLOCAL_API_BASE}/payments/${orderId}`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`dLocal status check failed: ${res.status} ${text}`);
  }

  return (await res.json()) as DlocalStatusResponse;
}
