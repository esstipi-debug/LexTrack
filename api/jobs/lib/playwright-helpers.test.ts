import { describe, expect, it, vi } from "vitest";

import { safeSelector, withRetries } from "./playwright-helpers";

// Note: `withBrowser` and `captureDebugScreenshot` are intentionally
// NOT unit-tested here. They are too side-effecty (launches a real
// browser, touches the filesystem); they belong in an integration
// suite that's out of scope for this scaffolding work.

describe("withRetries", () => {
  it("returns the result on the first successful attempt without retrying", async () => {
    const fn = vi.fn(async () => "ok");
    const result = await withRetries(fn, { label: "test", retries: 3, baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries up to `retries` times before throwing the last error", async () => {
    let attempts = 0;
    const finalErr = new Error("attempt 3 failed");
    const fn = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error(`attempt ${attempts} failed`);
      throw finalErr;
    });

    await expect(
      withRetries(fn, { label: "flaky", retries: 3, baseDelayMs: 1 }),
    ).rejects.toBe(finalErr);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("returns the value after one transient failure", async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("transient");
      return "second-try";
    });

    const result = await withRetries(fn, { label: "flaky", retries: 3, baseDelayMs: 1 });
    expect(result).toBe("second-try");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("respects `shouldRetry`: aborts and rethrows immediately when predicate returns false", async () => {
    class FatalError extends Error {}
    const fatal = new FatalError("do not retry me");
    const fn = vi.fn(async () => {
      throw fatal;
    });

    await expect(
      withRetries(fn, {
        label: "fatal",
        retries: 5,
        baseDelayMs: 1,
        shouldRetry: (err) => !(err instanceof FatalError),
      }),
    ).rejects.toBe(fatal);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("safeSelector", () => {
  it("resolves silently when page.waitForSelector resolves", async () => {
    const page = {
      waitForSelector: vi.fn(async () => undefined),
    };
    await expect(
      safeSelector(page as any, ".foo", "the foo widget"),
    ).resolves.toBeUndefined();
    expect(page.waitForSelector).toHaveBeenCalledWith(".foo", { timeout: 10000 });
  });

  it("throws an error that includes both the selector and the label", async () => {
    const page = {
      waitForSelector: vi.fn(async () => {
        throw new Error("Timeout 10000ms exceeded.");
      }),
    };

    await expect(
      safeSelector(page as any, "div.causa-row", "PJUD causa results table"),
    ).rejects.toThrow(/div\.causa-row/);
    await expect(
      safeSelector(page as any, "div.causa-row", "PJUD causa results table"),
    ).rejects.toThrow(/PJUD causa results table/);
    await expect(
      safeSelector(page as any, "div.causa-row", "PJUD causa results table"),
    ).rejects.toThrow(/DOM may have changed/);
  });

  it("preserves the underlying error message in the thrown error", async () => {
    const page = {
      waitForSelector: vi.fn(async () => {
        throw new Error("Timeout 10000ms exceeded waiting for selector.");
      }),
    };

    await expect(
      safeSelector(page as any, "#login", "login form"),
    ).rejects.toThrow(/Timeout 10000ms exceeded/);
  });
});
