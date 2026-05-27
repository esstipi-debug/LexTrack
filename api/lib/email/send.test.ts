// ─── sendEmail unit tests ──────────────────────────────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to mock the client module before importing send.
// Use vi.mock with a factory so the mock is hoisted.

const mockSend = vi.fn().mockResolvedValue({ data: { id: "test-id" }, error: null });

vi.mock("./client", () => ({
  emailClient: {
    emails: {
      send: mockSend,
    },
  },
}));

import { sendEmail } from "./send";
import { bienvenida } from "./templates";

const sampleTemplate = bienvenida({ nombre: "Ana García", email: "ana@example.com" });

describe("sendEmail", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.clearAllMocks();
  });

  it("in non-production (test) mode, logs but does NOT call Resend client", async () => {
    process.env.NODE_ENV = "test";
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await sendEmail({ to: "user@example.com", template: sampleTemplate });

    expect(mockSend).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[LexTrack email – dev mode]"),
    );

    consoleSpy.mockRestore();
  });

  it("in production mode, calls emailClient.emails.send with correct 'from'", async () => {
    process.env.NODE_ENV = "production";

    await sendEmail({ to: "user@example.com", template: sampleTemplate });

    expect(mockSend).toHaveBeenCalledOnce();
    const callArgs = mockSend.mock.calls[0][0] as {
      from: string;
      to: string;
      subject: string;
    };
    expect(callArgs.from).toMatch(/LexTrack/);
    expect(callArgs.from).toMatch(/no-reply@lextrack\.cl/);
    expect(callArgs.to).toBe("user@example.com");
    expect(callArgs.subject).toBe(sampleTemplate.subject);
  });

  it("swallows Resend errors — does not throw", async () => {
    process.env.NODE_ENV = "production";
    mockSend.mockRejectedValueOnce(new Error("Resend network error"));

    // Must not throw — email failures are non-critical.
    await expect(
      sendEmail({ to: "user@example.com", template: sampleTemplate }),
    ).resolves.toBeUndefined();
  });
});
