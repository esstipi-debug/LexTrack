// ─── Playwright helpers — shared scaffolding for scrapers ────────
// Centralises the boilerplate every scraper needs:
//   • `withBrowser`     — launches Chromium with env-driven config,
//                         creates a page, guarantees teardown on
//                         success OR error.
//   • `withRetries`     — exponential backoff for transient failures.
//   • `safeSelector`    — `page.waitForSelector` with clearer errors
//                         that include both the selector AND a
//                         human-readable label, so when the DOM
//                         changes it's obvious which selector to fix.
//   • `captureDebugScreenshot` — saves a timestamped screenshot to
//                         SCRAPER_DEBUG_DIR (gated on SCRAPER_DEBUG).
//
// Env vars consumed:
//   PLAYWRIGHT_HEADLESS   "false" → run with head (debugging)
//   SCRAPER_TIMEOUT_MS    default selector/navigation timeout in ms
//   SCRAPER_USER_AGENT    custom user-agent string
//   SCRAPER_DEBUG         "true" → enable debug screenshots
//   SCRAPER_DEBUG_DIR     where to write debug screenshots (default ./debug)

import { chromium, type Browser, type Page } from "playwright";
import { createLogger } from "../../lib/logger";

const log = createLogger("playwright");

export interface ScraperContext {
  browser: Browser;
  page: Page;
}

/**
 * Run `fn` with a fresh Chromium browser + page. Browser is closed in
 * a `finally` so a thrown error never leaks a process.
 */
export async function withBrowser<T>(
  fn: (ctx: ScraperContext) => Promise<T>,
): Promise<T> {
  const browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage({
      userAgent:
        process.env.SCRAPER_USER_AGENT ??
        "Mozilla/5.0 (compatible; LexTrack/1.0)",
    });
    page.setDefaultTimeout(
      parseInt(process.env.SCRAPER_TIMEOUT_MS ?? "30000", 10),
    );
    return await fn({ browser, page });
  } finally {
    await browser
      .close()
      .catch((err) => log.warn({ err }, "browser close failed"));
  }
}

export interface WithRetriesOpts {
  retries?: number;
  baseDelayMs?: number;
  label: string;
  /**
   * Optional predicate: returning `false` aborts the retry loop and
   * re-throws the error immediately. Use for logical errors
   * (NotFound, Captcha) that should not be retried.
   */
  shouldRetry?: (err: unknown) => boolean;
}

/** Retry helper with exponential backoff. */
export async function withRetries<T>(
  fn: () => Promise<T>,
  opts: WithRetriesOpts = { label: "operation" },
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseDelay = opts.baseDelayMs ?? 1000;
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (opts.shouldRetry && !opts.shouldRetry(err)) throw err;
      // Don't wait after the last attempt.
      if (attempt < retries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        log.warn(
          {
            attempt: attempt + 1,
            retries,
            delay,
            err,
            label: opts.label,
          },
          "retrying",
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

/**
 * Save a screenshot on error for debugging. Path is timestamped under
 * SCRAPER_DEBUG_DIR (default: ./debug). Returns the saved path, or
 * null if `SCRAPER_DEBUG !== "true"` or the capture itself failed.
 */
export async function captureDebugScreenshot(
  page: Page,
  name: string,
): Promise<string | null> {
  if (process.env.SCRAPER_DEBUG !== "true") return null;
  try {
    const dir = process.env.SCRAPER_DEBUG_DIR ?? "./debug";
    const fs = await import("node:fs/promises");
    await fs.mkdir(dir, { recursive: true });
    const path = `${dir}/${name}-${Date.now()}.png`;
    await page.screenshot({ path, fullPage: true });
    log.info({ path }, "debug screenshot saved");
    return path;
  } catch (err) {
    log.warn({ err }, "screenshot capture failed");
    return null;
  }
}

/**
 * Wait for a selector with an explicit, short timeout and a clearer
 * error message that names both the selector and what it was waiting
 * for. When the DOM changes, the thrown message tells you exactly
 * which entry in the SELECTORS object to update.
 */
export async function safeSelector(
  page: Page,
  selector: string,
  label: string,
): Promise<void> {
  try {
    await page.waitForSelector(selector, { timeout: 10000 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Selector "${selector}" (${label}) not found — DOM may have changed. ${detail}`,
    );
  }
}
