// ─── PJUD Playwright Scraper ─────────────────────────────────────
// Real implementation that drives a headless Chromium browser against
// https://oficinajudicialvirtual.pjud.cl to consult causas.
//
// NOTE: This implementation mirrors the public surface of `./client`
// (the simulator) so it can be swapped behind a feature flag without
// touching the router or sync layer.
//
// Selectors here are PLACEHOLDERS. They follow naming conventions
// observed on PJUD's public UI but MUST be verified against the live
// site before turning the feature flag on in production. Each
// placeholder is annotated with a `// TODO: verify selector against
// real PJUD` comment.

import type { Browser, BrowserContext, Page } from "playwright";
import type {
  PjudCausaResult,
  PjudMovimiento,
} from "./client";

// ─── Errors ──────────────────────────────────────────────────────

export class PjudUnavailableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "PjudUnavailableError";
  }
}

export class PjudCaptchaError extends Error {
  constructor(message = "PJUD requested a CAPTCHA challenge") {
    super(message);
    this.name = "PjudCaptchaError";
  }
}

export class PjudNotFoundError extends Error {
  constructor(message = "Causa no encontrada en el Poder Judicial") {
    super(message);
    this.name = "PjudNotFoundError";
  }
}

// ─── Config ──────────────────────────────────────────────────────

export const PJUD_BASE_URL =
  "https://oficinajudicialvirtual.pjud.cl/indexN.htm";

const NAV_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

// ─── Selectors (PLACEHOLDERS — must be verified) ─────────────────
// Centralised so swapping a selector is a one-line change.
export const SELECTORS = {
  // TODO: verify selector against real PJUD
  consultaCausaTab: "a[href*='consultaCausa']",
  // TODO: verify selector against real PJUD
  ritInput: "input[name='rit']",
  // TODO: verify selector against real PJUD
  tribunalSelect: "select[name='tribunal']",
  // TODO: verify selector against real PJUD
  submitButton: "button[type='submit'], input[type='submit']",
  // TODO: verify selector against real PJUD
  resultsContainer: "#resultados, table.resultados",
  // TODO: verify selector against real PJUD
  resultsRow: "tr.causa-row",
  // TODO: verify selector against real PJUD
  noResults: ".sin-resultados, .no-results",
  // TODO: verify selector against real PJUD
  captcha: "iframe[src*='captcha'], #captcha",
  // TODO: verify selector against real PJUD
  causaCaratula: ".caratula, td.caratula",
  // TODO: verify selector against real PJUD
  causaRuc: ".ruc, td.ruc",
  // TODO: verify selector against real PJUD
  causaTribunal: ".tribunal, td.tribunal",
  // TODO: verify selector against real PJUD
  causaEstado: ".estado, td.estado",
  // TODO: verify selector against real PJUD
  causaEtapa: ".etapa, td.etapa",
  // TODO: verify selector against real PJUD
  causaFechaIngreso: ".fecha-ingreso, td.fecha-ingreso",
  // TODO: verify selector against real PJUD
  causaLitigantes: ".litigantes li, td.litigantes",
  // TODO: verify selector against real PJUD
  movimientoRow: "tr.movimiento-row",
  // TODO: verify selector against real PJUD
  movimientoFecha: ".fecha",
  // TODO: verify selector against real PJUD
  movimientoTipo: ".tipo",
  // TODO: verify selector against real PJUD
  movimientoDescripcion: ".descripcion",
  // TODO: verify selector against real PJUD
  movimientoFolio: ".folio",
  // TODO: verify selector against real PJUD
  rutInput: "input[name='rut']",
} as const;

// ─── Browser singleton ───────────────────────────────────────────

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      // Imported dynamically so the module can be tree-shaken when the
      // simulator is selected and so tests can mock `playwright`.
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
    // swallow — best effort
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
      // Don't retry on logical errors — only on transient ones.
      if (
        err instanceof PjudNotFoundError ||
        err instanceof PjudCaptchaError
      ) {
        throw err;
      }
      lastErr = err;
      if (attempt < maxRetries - 1) {
        const delay = baseMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw new PjudUnavailableError(
    `PJUD scraper failed after ${maxRetries} attempts`,
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

async function checkCaptcha(page: Page): Promise<void> {
  const captcha = await page.$(SELECTORS.captcha);
  if (captcha) throw new PjudCaptchaError();
}

async function textOrEmpty(page: Page, selector: string): Promise<string> {
  const el = await page.$(selector);
  if (!el) return "";
  return ((await el.textContent()) || "").trim();
}

async function textsOf(page: Page, selector: string): Promise<string[]> {
  const els = await page.$$(selector);
  const out: string[] = [];
  for (const el of els) {
    const t = (await el.textContent()) || "";
    out.push(t.trim());
  }
  return out;
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Consulta una causa en el PJUD por RIT.
 * Real implementation that scrapes oficinajudicialvirtual.pjud.cl.
 */
export async function consultarCausa(
  rit: string,
  tribunal?: string,
): Promise<PjudCausaResult | null> {
  return withRetry(async () => {
    const { page, context } = await newPage();
    try {
      await page.goto(PJUD_BASE_URL, { waitUntil: "domcontentloaded" });
      await checkCaptcha(page);

      // TODO: verify selector against real PJUD — tab/link to "Consulta de causas"
      await page.click(SELECTORS.consultaCausaTab).catch(() => {
        /* tab may already be active */
      });

      await page.fill(SELECTORS.ritInput, rit);
      if (tribunal) {
        await page
          .selectOption(SELECTORS.tribunalSelect, { label: tribunal })
          .catch(() => {
            /* tribunal select may not exist on all flows */
          });
      }
      await page.click(SELECTORS.submitButton);
      await page.waitForLoadState("domcontentloaded");
      await checkCaptcha(page);

      const noResults = await page.$(SELECTORS.noResults);
      if (noResults) throw new PjudNotFoundError();

      const container = await page.$(SELECTORS.resultsContainer);
      if (!container) throw new PjudNotFoundError();

      const caratula = await textOrEmpty(page, SELECTORS.causaCaratula);
      if (!caratula) throw new PjudNotFoundError();

      const ruc = await textOrEmpty(page, SELECTORS.causaRuc);
      const tribunalText =
        (await textOrEmpty(page, SELECTORS.causaTribunal)) ||
        tribunal ||
        "";
      const estado = await textOrEmpty(page, SELECTORS.causaEstado);
      const etapa = await textOrEmpty(page, SELECTORS.causaEtapa);
      const fechaIngreso = await textOrEmpty(
        page,
        SELECTORS.causaFechaIngreso,
      );
      const litigantes = await textsOf(page, SELECTORS.causaLitigantes);

      const movimientos = await scrapeMovimientos(page);
      const ultimoMovimiento =
        movimientos.length > 0
          ? {
              fecha: movimientos[0].fecha,
              tipo: movimientos[0].tipo,
              descripcion: movimientos[0].descripcion,
            }
          : null;

      const result: PjudCausaResult = {
        rit,
        ruc,
        caratula,
        tribunal: tribunalText,
        estado,
        etapa,
        fechaIngreso,
        ultimoMovimiento,
        litigantes,
      };
      return result;
    } finally {
      await context.close().catch(() => {});
    }
  });
}

async function scrapeMovimientos(page: Page): Promise<PjudMovimiento[]> {
  const rows = await page.$$(SELECTORS.movimientoRow);
  const out: PjudMovimiento[] = [];
  for (const row of rows) {
    const fechaEl = await row.$(SELECTORS.movimientoFecha);
    const tipoEl = await row.$(SELECTORS.movimientoTipo);
    const descEl = await row.$(SELECTORS.movimientoDescripcion);
    const folioEl = await row.$(SELECTORS.movimientoFolio);
    out.push({
      fecha: ((await fechaEl?.textContent()) || "").trim(),
      tipo: ((await tipoEl?.textContent()) || "").trim(),
      descripcion: ((await descEl?.textContent()) || "").trim(),
      folio: folioEl
        ? ((await folioEl.textContent()) || "").trim() || undefined
        : undefined,
    });
  }
  return out.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/**
 * Obtiene los movimientos (cronologia) de una causa.
 * Reuses the same consulta page to scrape the movimientos table.
 */
export async function obtenerMovimientos(
  rit: string,
  tribunal?: string,
): Promise<PjudMovimiento[]> {
  return withRetry(async () => {
    const { page, context } = await newPage();
    try {
      await page.goto(PJUD_BASE_URL, { waitUntil: "domcontentloaded" });
      await checkCaptcha(page);
      await page.click(SELECTORS.consultaCausaTab).catch(() => {});
      await page.fill(SELECTORS.ritInput, rit);
      if (tribunal) {
        await page
          .selectOption(SELECTORS.tribunalSelect, { label: tribunal })
          .catch(() => {});
      }
      await page.click(SELECTORS.submitButton);
      await page.waitForLoadState("domcontentloaded");
      await checkCaptcha(page);

      const noResults = await page.$(SELECTORS.noResults);
      if (noResults) return [];

      return await scrapeMovimientos(page);
    } finally {
      await context.close().catch(() => {});
    }
  });
}

/**
 * Busca causas asociadas a un RUT en el PJUD.
 */
export async function buscarPorRut(rut: string): Promise<PjudCausaResult[]> {
  return withRetry(async () => {
    const { page, context } = await newPage();
    try {
      await page.goto(PJUD_BASE_URL, { waitUntil: "domcontentloaded" });
      await checkCaptcha(page);
      // TODO: verify selector against real PJUD — tab to "Consulta por RUT"
      await page.click(SELECTORS.consultaCausaTab).catch(() => {});
      await page.fill(SELECTORS.rutInput, rut);
      await page.click(SELECTORS.submitButton);
      await page.waitForLoadState("domcontentloaded");
      await checkCaptcha(page);

      const noResults = await page.$(SELECTORS.noResults);
      if (noResults) return [];

      const rows = await page.$$(SELECTORS.resultsRow);
      const results: PjudCausaResult[] = [];
      for (const row of rows) {
        const caratulaEl = await row.$(SELECTORS.causaCaratula);
        const caratula = ((await caratulaEl?.textContent()) || "").trim();
        if (!caratula) continue;
        const ritEl = await row.$(SELECTORS.ritInput);
        const ritText = ((await ritEl?.textContent()) || "").trim();
        const ruc = ((await (await row.$(SELECTORS.causaRuc))?.textContent()) || "").trim();
        const tribunal = ((await (await row.$(SELECTORS.causaTribunal))?.textContent()) || "").trim();
        const estado = ((await (await row.$(SELECTORS.causaEstado))?.textContent()) || "").trim();
        const etapa = ((await (await row.$(SELECTORS.causaEtapa))?.textContent()) || "").trim();
        const fechaIngreso = ((await (await row.$(SELECTORS.causaFechaIngreso))?.textContent()) || "").trim();
        results.push({
          rit: ritText,
          ruc,
          caratula,
          tribunal,
          estado,
          etapa,
          fechaIngreso,
          ultimoMovimiento: null,
          litigantes: caratula.split(" con ").map((s) => s.trim()),
        });
      }
      return results;
    } finally {
      await context.close().catch(() => {});
    }
  });
}

/**
 * Convenience wrapper. Sync logic lives in ./sync; this is here to
 * mirror the task's described surface (`sincronizarCausa(rol)`) but
 * is just a thin re-export for callers that want to operate directly
 * on a RIT without touching the DB.
 */
export async function sincronizarCausa(
  rit: string,
  tribunal?: string,
): Promise<{
  causa: PjudCausaResult | null;
  movimientos: PjudMovimiento[];
}> {
  const causa = await consultarCausa(rit, tribunal);
  const movimientos = causa
    ? await obtenerMovimientos(rit, tribunal)
    : [];
  return { causa, movimientos };
}
