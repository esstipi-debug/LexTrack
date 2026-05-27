// ─── Structured logging via Pino ─────────────────────────────────
// One shared root logger; per-module child loggers via createLogger().
// In dev (NODE_ENV !== "production") we pipe through pino-pretty for
// human-readable output; in prod we emit newline-delimited JSON.
// Sensitive fields are redacted before serialization.

import pino, { type Logger } from "pino";

const isProd = process.env.NODE_ENV === "production";
const level = process.env.LOG_LEVEL || "info";

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.token',
  '*.apiKey',
];

export const logger: Logger = pino({
  level,
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
  ...(isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        },
      }),
});

export function createLogger(context: string): Logger {
  return logger.child({ context });
}
