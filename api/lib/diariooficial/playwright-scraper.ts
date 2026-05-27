// ─── Diario Oficial — Playwright Scraper ─────────────────────────
// Implementación real contra https://www.diariooficial.interior.gob.cl/edicionelectronica/
//
// Selectores son PLACEHOLDERS. Deben verificarse contra el DOM real
// antes de activar la flag `DIARIO_OFICIAL_SCRAPER=playwright` en prod.
// Cada selector dudoso lleva una marca `// TODO: verify against diariooficial.interior.gob.cl`.

import type { Browser, BrowserContext, Page } from "playwright";
import type {
  BuscarNormasOpts,
  DiarioOficialNorma,
} from "./types";
import {
  DiarioOficialNotFoundError,
  DiarioOficialUnavailableError,
} from "./types";

export {
  DiarioOficialNotFoundError,
  DiarioOficialUnavailableError,
} from "./types";

// ─── Config ──────────────────────────────────────────────────────

export const DIARIO_OFICIAL_BASE_URL =
  "https://www.diariooficial.interior.gob.cl/edicionelectronica/";

const NAV_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

// ─── Selectores (PLACEHOLDERS) ───────────────────────────────────
export const SELECTORS = {
  // TODO: verify against diariooficial.interior.gob.cl
  fechaInput: "input[name='date'], #fecha",
  // TODO: verify against diariooficial.interior.gob.cl
  submitButton: "button[type='submit'], input[type='submit']",
  // TODO: verify against diariooficial.interior.gob.cl
  searchInput: "input[name='q'], input[type='search']",
  // TODO: verify against diariooficial.interior.gob.cl
  resultsContainer: "#resultados, .normas-list, table.ediciones",
  // TODO: verify against diariooficial.interior.gob.cl
  normaRow: "tr.norma-row, li.norma, .norma-item",
  // TODO: verify against diariooficial.interior.gob.cl
  normaTipo: ".tipo, td.tipo",
  // TODO: verify against diariooficial.interior.gob.cl
  normaNumero: ".numero, td.numero",
  // TODO: verify against diariooficial.interior.gob.cl
  normaTitulo: ".titulo, td.titulo, a.titulo",
  // TODO: verify against diariooficial.interior.gob.cl
  normaOrganismo: ".organismo, td.organismo",
  // TODO: verify against diariooficial.interior.gob.cl
  normaMateria: ".materia, td.materia",
  // TODO: verify against diariooficial.interior.gob.cl
  normaFecha: ".fecha, td.fecha",
  // TODO: verify against diariooficial.interior.gob.cl
  normaLink: "a[href*='/edicionelectronica/']",
  // TODO: verify against diariooficial.interior.gob.cl
  noResults: ".sin-resultados, .no-results",
} as const;

// ─── Browser singleton ───────────────────────────────────────────

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
      if (err instanceof DiarioOficialNotFoundError) throw err;
      lastErr = err;
      if (attempt < maxRetries - 1) {
        const delay = baseMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw new DiarioOficialUnavailableError(
    `Diario Oficial scraper falló tras ${maxRetries} intentos`,
    lastErr,
  );
}

// ─── Page helpers ────────────────────────────────────────────────

async function newPage(): Promise<{ page: Page; context: BrowserContext }> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
  page.setDefaultTimeout(NAV_TIMEOUT_MS);
  return { page, context };
}

async function textOf(row: any, selector: string): Promise<string> {
  const el = await row.$(selector);
  if (!el) return "";
  return ((await el.textContent()) || "").trim();
}

async function attrOf(row: any, selector: string, attr: string): Promise<string> {
  const el = await row.$(selector);
  if (!el) return "";
  return ((await el.getAttribute(attr)) || "").trim();
}

function toIso(d: Date): string {
  return d.toISOString().split("T")[0];
}

async function scrapeNormaRows(page: Page): Promise<DiarioOficialNorma[]> {
  const rows = await page.$$(SELECTORS.normaRow);
  const out: DiarioOficialNorma[] = [];
  for (const row of rows) {
    const titulo = await textOf(row, SELECTORS.normaTitulo);
    if (!titulo) continue;
    const url = await attrOf(row, SELECTORS.normaLink, "href");
    out.push({
      tipoNorma: (await textOf(row, SELECTORS.normaTipo)) || "ley",
      numero: await textOf(row, SELECTORS.normaNumero),
      titulo,
      fechaPublicacion: await textOf(row, SELECTORS.normaFecha),
      organismo: await textOf(row, SELECTORS.normaOrganismo),
      materia: (await textOf(row, SELECTORS.normaMateria)) || "otra",
      url: url.startsWith("http") ? url : `${DIARIO_OFICIAL_BASE_URL}${url}`,
    });
  }
  return out;
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Devuelve las normas publicadas en la edición electrónica del Diario
 * Oficial para una fecha dada (default: hoy).
 */
export async function obtenerEdicionDelDia(
  fecha: Date = new Date(),
): Promise<DiarioOficialNorma[]> {
  return withRetry(async () => {
    const { page, context } = await newPage();
    try {
      const url = `${DIARIO_OFICIAL_BASE_URL}?date=${toIso(fecha)}`;
      await page.goto(url, { waitUntil: "domcontentloaded" });

      const noResults = await page.$(SELECTORS.noResults);
      if (noResults) return [];

      const container = await page.$(SELECTORS.resultsContainer);
      if (!container) return [];

      return await scrapeNormaRows(page);
    } finally {
      await context.close().catch(() => {});
    }
  });
}

/**
 * Busca normas por término libre. `opts.materia`, `fechaDesde` y
 * `fechaHasta` se aplican como filtros si los soporta el front.
 */
export async function buscarNormas(
  query: string,
  opts: BuscarNormasOpts = {},
): Promise<DiarioOficialNorma[]> {
  return withRetry(async () => {
    const { page, context } = await newPage();
    try {
      await page.goto(DIARIO_OFICIAL_BASE_URL, { waitUntil: "domcontentloaded" });
      await page.fill(SELECTORS.searchInput, query).catch(() => {});
      // TODO: verify against diariooficial.interior.gob.cl — date range fields
      if (opts.fechaDesde) {
        await page.fill(SELECTORS.fechaInput, toIso(opts.fechaDesde)).catch(() => {});
      }
      await page.click(SELECTORS.submitButton).catch(() => {});
      await page.waitForLoadState("domcontentloaded");

      const noResults = await page.$(SELECTORS.noResults);
      if (noResults) return [];

      const container = await page.$(SELECTORS.resultsContainer);
      if (!container) return [];

      let normas = await scrapeNormaRows(page);
      if (opts.materia) {
        normas = normas.filter((n) => n.materia === opts.materia);
      }
      if (opts.limit) normas = normas.slice(0, opts.limit);
      return normas;
    } finally {
      await context.close().catch(() => {});
    }
  });
}
