// ─── DT Dictámenes — Playwright Scraper ──────────────────────────
// Real implementation that drives headless Chromium against the
// Buscador de Dictámenes de la Dirección del Trabajo:
//   https://www.dt.gob.cl/legislacion/1624/w3-propertyvalue-138187.html
//
// Mirrors the PJUD scraper pattern: lazy `playwright` import,
// browser singleton, typed errors, retry helper, centralised
// SELECTORS. All selectors are PLACEHOLDERS pending verification.

import type { Browser, BrowserContext, Page } from "playwright";
import type { DtDictamen } from "./types";
import { DtNotFoundError, DtUnavailableError } from "./types";

export { DtNotFoundError, DtUnavailableError };

export const DT_BASE_URL =
  "https://www.dt.gob.cl/legislacion/1624/w3-propertyvalue-138187.html";

const NAV_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

// ─── Selectors (PLACEHOLDERS — must be verified) ─────────────────
export const SELECTORS = {
  // TODO: verify against dt.gob.cl
  searchInput: "input[name='q'], input[type='search']",
  // TODO: verify against dt.gob.cl
  submitButton: "button[type='submit'], input[type='submit']",
  // TODO: verify against dt.gob.cl
  resultsContainer: ".resultados, #resultados",
  // TODO: verify against dt.gob.cl
  resultRow: ".dictamen, li.resultado, .resultado-dictamen",
  // TODO: verify against dt.gob.cl
  noResults: ".sin-resultados, .no-results",
  // TODO: verify against dt.gob.cl
  ordinario: ".ordinario, .numero-ordinario",
  // TODO: verify against dt.gob.cl
  fecha: ".fecha, time",
  // TODO: verify against dt.gob.cl
  materia: ".materia, .tema",
  // TODO: verify against dt.gob.cl
  sumario: ".sumario, .extracto, .descripcion",
  // TODO: verify against dt.gob.cl
  link: "a[href*='w3-article']",
  // TODO: verify against dt.gob.cl
  textoCompleto: ".texto-dictamen, article .contenido",
} as const;

// ─── Browser singleton (lazy import) ─────────────────────────────

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import("playwright");
      return chromium.launch({ headless: true });
    })();
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  try {
    const b = await browserPromise;
    await b.close();
  } catch {
    /* best effort */
  } finally {
    browserPromise = null;
  }
}

// ─── Retry helper ────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  { maxRetries = MAX_RETRIES, baseMs = RETRY_BASE_MS } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof DtNotFoundError) throw err;
      lastErr = err;
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, baseMs * Math.pow(2, attempt)));
      }
    }
  }
  throw new DtUnavailableError(
    `DT scraper failed after ${maxRetries} attempts`,
    lastErr,
  );
}

async function newPage(): Promise<{ page: Page; context: BrowserContext }> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
  page.setDefaultTimeout(NAV_TIMEOUT_MS);
  return { page, context };
}

async function textOrEmpty(scope: Page | any, selector: string): Promise<string> {
  const el = await scope.$(selector);
  if (!el) return "";
  return ((await el.textContent()) || "").trim();
}

// ─── Public API ──────────────────────────────────────────────────

export async function buscarDictamenes(
  query: string,
  opts?: { limite?: number },
): Promise<DtDictamen[]> {
  const limite = Math.min(Math.max(opts?.limite ?? 5, 1), 20);
  return withRetry(async () => {
    const { page, context } = await newPage();
    try {
      await page.goto(DT_BASE_URL, { waitUntil: "domcontentloaded" });
      await page.fill(SELECTORS.searchInput, query).catch(() => {});
      await page.click(SELECTORS.submitButton).catch(() => {});
      await page.waitForLoadState("domcontentloaded");

      const noResults = await page.$(SELECTORS.noResults);
      if (noResults) return [];

      const rows = await page.$$(SELECTORS.resultRow);
      const out: DtDictamen[] = [];
      for (const row of rows.slice(0, limite)) {
        const ordinario = await textOrEmpty(row, SELECTORS.ordinario);
        const fecha = await textOrEmpty(row, SELECTORS.fecha);
        const materia = await textOrEmpty(row, SELECTORS.materia);
        const sumario = await textOrEmpty(row, SELECTORS.sumario);
        const linkEl = await row.$(SELECTORS.link);
        const href = linkEl ? await linkEl.getAttribute("href") : null;
        const url = href
          ? new URL(href, DT_BASE_URL).toString()
          : DT_BASE_URL;
        if (!ordinario && !materia) continue;
        out.push({ ordinario, fecha, materia, sumario, url });
      }
      return out;
    } finally {
      await context.close().catch(() => {});
    }
  });
}

export async function obtenerDictamen(
  ordinario: string,
): Promise<DtDictamen | null> {
  return withRetry(async () => {
    const results = await buscarDictamenes(ordinario, { limite: 5 });
    const match =
      results.find((d) => d.ordinario.includes(ordinario)) || results[0];
    if (!match) throw new DtNotFoundError();

    const { page, context } = await newPage();
    try {
      await page.goto(match.url, { waitUntil: "domcontentloaded" });
      const texto = await textOrEmpty(page, SELECTORS.textoCompleto);
      return { ...match, texto: texto || undefined };
    } finally {
      await context.close().catch(() => {});
    }
  });
}
