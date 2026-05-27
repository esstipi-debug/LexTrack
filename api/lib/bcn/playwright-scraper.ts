// ─── BCN LeyChile — Playwright Scraper ───────────────────────────
// Real implementation that drives headless Chromium against el
// buscador de LeyChile de la Biblioteca del Congreso Nacional:
//   https://www.bcn.cl/leychile/consulta
//
// Mirrors the PJUD / DT scraper pattern: lazy `playwright` import,
// browser singleton, typed errors, retry helper, centralised
// SELECTORS. All selectors are PLACEHOLDERS pending verification.

import type { Browser, BrowserContext, Page } from "playwright";
import type { BcnNorma } from "./types";
import { BcnNotFoundError, BcnUnavailableError } from "./types";

export { BcnNotFoundError, BcnUnavailableError };

export const BCN_BASE_URL = "https://www.bcn.cl/leychile/consulta";

const NAV_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

// ─── Selectors (PLACEHOLDERS — must be verified) ─────────────────
export const SELECTORS = {
  // TODO: verify against bcn.cl
  searchInput: "input[name='q'], input[type='search'], #buscador",
  // TODO: verify against bcn.cl
  submitButton: "button[type='submit'], input[type='submit'], .btn-buscar",
  // TODO: verify against bcn.cl
  resultsContainer: ".resultados, #resultados-busqueda",
  // TODO: verify against bcn.cl
  resultRow: ".resultado-norma, li.norma, .result-item",
  // TODO: verify against bcn.cl
  noResults: ".sin-resultados, .no-results",
  // TODO: verify against bcn.cl
  numero: ".numero-norma, .num-norma",
  // TODO: verify against bcn.cl
  titulo: ".titulo-norma, .titulo, h3",
  // TODO: verify against bcn.cl
  tipo: ".tipo-norma, .tipo",
  // TODO: verify against bcn.cl
  fechaPublicacion: ".fecha-publicacion, time",
  // TODO: verify against bcn.cl
  link: "a[href*='navegar'], a[href*='idNorma']",
  // TODO: verify against bcn.cl
  textoCompleto: ".texto-norma, article .contenido, #texto",
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
      if (err instanceof BcnNotFoundError) throw err;
      lastErr = err;
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, baseMs * Math.pow(2, attempt)));
      }
    }
  }
  throw new BcnUnavailableError(
    `BCN scraper failed after ${maxRetries} attempts`,
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

export async function buscarNormas(
  query: string,
  opts?: { limite?: number },
): Promise<BcnNorma[]> {
  const limite = Math.min(Math.max(opts?.limite ?? 5, 1), 20);
  return withRetry(async () => {
    const { page, context } = await newPage();
    try {
      await page.goto(BCN_BASE_URL, { waitUntil: "domcontentloaded" });
      await page.fill(SELECTORS.searchInput, query).catch(() => {});
      await page.click(SELECTORS.submitButton).catch(() => {});
      await page.waitForLoadState("domcontentloaded");

      const noResults = await page.$(SELECTORS.noResults);
      if (noResults) return [];

      const rows = await page.$$(SELECTORS.resultRow);
      const out: BcnNorma[] = [];
      for (const row of rows.slice(0, limite)) {
        const numero = await textOrEmpty(row, SELECTORS.numero);
        const titulo = await textOrEmpty(row, SELECTORS.titulo);
        const tipo = (await textOrEmpty(row, SELECTORS.tipo)) || "ley";
        const fechaPublicacion = await textOrEmpty(row, SELECTORS.fechaPublicacion);
        const linkEl = await row.$(SELECTORS.link);
        const href = linkEl ? await linkEl.getAttribute("href") : null;
        const url = href ? new URL(href, BCN_BASE_URL).toString() : BCN_BASE_URL;
        if (!numero && !titulo) continue;
        out.push({ numero, titulo, tipo, fechaPublicacion, url });
      }
      return out;
    } finally {
      await context.close().catch(() => {});
    }
  });
}

export async function obtenerNorma(numero: string): Promise<BcnNorma | null> {
  return withRetry(async () => {
    const results = await buscarNormas(numero, { limite: 5 });
    const match = results.find((n) => n.numero.includes(numero)) || results[0];
    if (!match) throw new BcnNotFoundError();

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
