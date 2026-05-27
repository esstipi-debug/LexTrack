// ─── Resend email client singleton ────────────────────────────────
// Initializes from RESEND_API_KEY. If the key is absent (dev / test),
// returns a no-op client so email failures never break the main flow.

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

function buildNoopClient() {
  const noop = async () => ({ data: null, error: null });
  return {
    emails: {
      send: noop,
    },
  } as unknown as Resend;
}

function buildClient(): Resend {
  if (!apiKey) {
    console.warn(
      "[LexTrack/email] RESEND_API_KEY is not set — email client running in no-op mode.",
    );
    return buildNoopClient();
  }
  return new Resend(apiKey);
}

export const emailClient: Resend = buildClient();
