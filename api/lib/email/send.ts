// ─── sendEmail utility ─────────────────────────────────────────────
// Wraps the Resend client with error-swallowing and dev-mode logging.
// Email failures MUST NOT propagate to callers.

import { emailClient } from "./client";
import { createLogger } from "../logger";
import type { EmailTemplate } from "./templates";

const log = createLogger("email/send");

const FROM = process.env.EMAIL_FROM ?? "LexTrack <no-reply@lextrack.cl>";
const isProduction = process.env.NODE_ENV === "production";

export async function sendEmail({
  to,
  template,
}: {
  to: string;
  template: EmailTemplate;
}): Promise<void> {
  if (!isProduction) {
    log.info(
      { to, subject: template.subject },
      "[dev] email not sent — logging content instead",
    );
    console.log(
      `\n── [LexTrack email – dev mode] ──────────────────────────\nTo:      ${to}\nFrom:    ${FROM}\nSubject: ${template.subject}\n\n${template.text}\n─────────────────────────────────────────────────────────\n`,
    );
    return;
  }

  try {
    const { error } = await emailClient.emails.send({
      from: FROM,
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    if (error) {
      log.error({ error, to, subject: template.subject }, "resend returned error");
    }
  } catch (err) {
    log.error({ err, to, subject: template.subject }, "sendEmail failed — swallowed");
  }
}
