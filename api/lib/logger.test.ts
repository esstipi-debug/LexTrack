// Verifies the redact list in api/lib/logger.ts hides sensitive
// fields (authorization, cookie, password, token, apiKey) from
// serialized output.

import { describe, it, expect } from "vitest";
import pino from "pino";
import { Writable } from "node:stream";
import { REDACT_PATHS } from "./logger";

function makeCaptureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  const log = pino(
    {
      level: "info",
      redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    },
    stream,
  );
  return { log, lines };
}

describe("logger redact", () => {
  it("redacts req.headers.authorization and req.headers.cookie", () => {
    const { log, lines } = makeCaptureLogger();
    log.info(
      {
        req: {
          headers: {
            authorization: "Bearer super-secret-jwt",
            cookie: "session=abc123",
            "user-agent": "vitest",
          },
        },
      },
      "request",
    );
    const out = lines.join("\n");
    expect(out).not.toContain("super-secret-jwt");
    expect(out).not.toContain("session=abc123");
    expect(out).toContain("[REDACTED]");
    expect(out).toContain("vitest");
  });

  it("redacts wildcard *.password, *.token, *.apiKey", () => {
    const { log, lines } = makeCaptureLogger();
    log.info(
      {
        user: {
          password: "hunter2",
          token: "tok_abc",
          apiKey: "sk-live-xyz",
          name: "Alice",
        },
      },
      "login",
    );
    const out = lines.join("\n");
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("tok_abc");
    expect(out).not.toContain("sk-live-xyz");
    expect(out).toContain("Alice");
    expect(out).toContain("[REDACTED]");
  });

  it("leaves non-sensitive fields intact", () => {
    const { log, lines } = makeCaptureLogger();
    log.info({ userId: 42, durationMs: 13 }, "ok");
    const out = lines.join("\n");
    expect(out).toContain("\"userId\":42");
    expect(out).toContain("\"durationMs\":13");
  });
});
