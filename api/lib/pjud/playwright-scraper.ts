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
// placeholder is annotated with a `// TODO(scraper-selectors): ...`
// comment, and ALL selectors are centralised in the `SELECTORS`
// object below so swapping one is a one-line change.
//
// Browser/page lifecycle, retry, and screenshot-on-error scaffolding
// live in `api/jobs/lib/playwright-helpers.ts`. See docs/SCRAPERS.md
// for the workflow to verify selectors against the live site.

import type { Page } from "playwright";
import type {
  PjudCausaResult,
  PjudMovimiento,
} from "./client";
import {
  withBrowser,
  withRetries,
  captureDebugScreenshot,
} from "../../jobs/lib/playwright-helpers";

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

const MAX_RETRIES = 3;

// ─── Selectors (PLACEHOLDERS — must be verified) ─────────────────
// Centralised so swapping a selector is a one-line change. To update,
// see docs/SCRAPERS.md → "Para actualizar selectores".
export const SELECTORS = {
  // TODO(scraper-selectors): verificar contra DOM real de https://oficinajudicialvirtual.pjud.cl/ — tab/link "Consulta unificada de causas"
  consultaCausaTab: "a[href*='consultaCausa']",
  // TODO(scraper-selectors): verificar — input RIT en el formulario de consulta unificada
  ritInput: "input[name='rit']",
  // TODO(scraper-selectors): verificar — select de tribunal en consulta unificada
  tribunalSelect: "select[name='tribunal']",
  // TODO(scraper-selectors): verificar — botón submit del form de consulta
  submitButton: "button[type='submit'], input[type='submit']",
  // TODO(scraper-selectors): verificar — contenedor del listado de resultados
  resultsContainer: "#resultados, table.resultados",
  // TODO(scraper-selectors): verificar — fila individual de causa en el listado
  resultsRow: "tr.causa-row",
  // TODO(scraper-selectors): verificar — mensaje "sin resultados" cuando la causa no existe
  noResults: ".sin-resultados, .no-results",
  // TODO(scraper-selectors): verificar — iframe / contenedor del CAPTCHA si aparece
  captcha: "iframe[src*='captcha'], #captcha",
  // TODO(scraper-selectors): verificar — caratula de la causa en la vista detalle
  causaCaratula: ".caratula, td.caratula",
  // TODO(scraper-selectors): verificar — RUC (Rol Único de Causa)
  causaRuc: ".ruc, td.ruc",
  // TODO(scraper-selectors): verificar — nombre del tribunal en la vista detalle
  causaTribunal: ".tribunal, td.tribunal",
  // TODO(scraper-selectors): verificar — estado (Tramitación, Sentenciada, etc.)
  causaEstado: ".estado, td.estado",
  // TODO(scraper-selectors): verificar — etapa procesal (Discusión, Prueba, etc.)
  causaEtapa: ".etapa, td.etapa",
  // TODO(scraper-selectors): verificar — fecha de ingreso de la causa
  causaFechaIngreso: ".fecha-ingreso, td.fecha-ingreso",
  // TODO(scraper-selectors): verificar — items del listado de litigantes
  causaLitigantes: ".litigantes li, td.litigantes",
  // TODO(scraper-selectors): verificar — fila de movimiento en la cronología
  movimientoRow: "tr.movimiento-row",
  // TODO(scraper-selectors): verificar — celda fecha en una fila de movimiento
  movimientoFecha: ".fecha",
  // TODO(scraper-selectors): verificar — celda tipo en una fila de movimiento
  movimientoTipo: ".tipo",
  // TODO(scraper-selectors): verificar — celda descripción en una fila de movimiento
  movimientoDescripcion: ".descripcion",
  // TODO(scraper-selectors): verificar — celda folio (opcional)
  movimientoFolio: ".folio",
  // TODO(scraper-selectors): verificar — input RUT en consulta por RUT
  rutInput: "input[name='rut']",
} as const;

// ─── Backward-compat shim ────────────────────────────────────────
// `closeBrowser` used to terminate a long-lived browser singleton.
// Lifecycle now lives inside `withBrowser` (one browser per scrape),
// so this is a no-op kept for callers that still import it.
export async function closeBrowser(): Promise<void> {
  // no-op — browsers are now scoped per `withBrowser` call.
}

// ─── Page helpers ────────────────────────────────────────────────

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

/** Wraps the helper retry with PJUD-specific abort logic: logical
 *  errors (NotFound, Captcha) are NOT retried — they're surfaced
 *  immediately. Transient errors are retried with exponential backoff
 *  and finally re-thrown as `PjudUnavailableError`. */
async function withPjudRetry<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<T> {
  try {
    return await withRetries(fn, {
      label,
      retries: MAX_RETRIES,
      baseDelayMs: 500,
      shouldRetry: (err) =>
        !(err instanceof PjudNotFoundError) &&
        !(err instanceof PjudCaptchaError),
    });
  } catch (err) {
    if (err instanceof PjudNotFoundError || err instanceof PjudCaptchaError) {
      throw err;
    }
    throw new PjudUnavailableError(
      `PJUD scraper failed after ${MAX_RETRIES} attempts`,
      err,
    );
  }
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

// ─── Public API ──────────────────────────────────────────────────

/**
 * Consulta una causa en el PJUD por RIT.
 * Real implementation that scrapes oficinajudicialvirtual.pjud.cl.
 */
export async function consultarCausa(
  rit: string,
  tribunal?: string,
): Promise<PjudCausaResult | null> {
  return withPjudRetry(
    () =>
      withBrowser(async ({ page }) => {
        try {
          await page.goto(PJUD_BASE_URL, { waitUntil: "domcontentloaded" });
          await checkCaptcha(page);

          // Tab may already be active — swallow the click failure.
          await page.click(SELECTORS.consultaCausaTab).catch(() => {});

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
        } catch (err) {
          await captureDebugScreenshot(page, "pjud-consultarCausa");
          throw err;
        }
      }),
    "pjud.consultarCausa",
  );
}

/**
 * Obtiene los movimientos (cronologia) de una causa.
 * Reuses the same consulta page to scrape the movimientos table.
 */
export async function obtenerMovimientos(
  rit: string,
  tribunal?: string,
): Promise<PjudMovimiento[]> {
  return withPjudRetry(
    () =>
      withBrowser(async ({ page }) => {
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
        } catch (err) {
          await captureDebugScreenshot(page, "pjud-obtenerMovimientos");
          throw err;
        }
      }),
    "pjud.obtenerMovimientos",
  );
}

/**
 * Busca causas asociadas a un RUT en el PJUD.
 */
export async function buscarPorRut(rut: string): Promise<PjudCausaResult[]> {
  return withPjudRetry(
    () =>
      withBrowser(async ({ page }) => {
        try {
          await page.goto(PJUD_BASE_URL, { waitUntil: "domcontentloaded" });
          await checkCaptcha(page);
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
            const ruc = (
              (await (await row.$(SELECTORS.causaRuc))?.textContent()) || ""
            ).trim();
            const tribunal = (
              (await (await row.$(SELECTORS.causaTribunal))?.textContent()) ||
              ""
            ).trim();
            const estado = (
              (await (await row.$(SELECTORS.causaEstado))?.textContent()) || ""
            ).trim();
            const etapa = (
              (await (await row.$(SELECTORS.causaEtapa))?.textContent()) || ""
            ).trim();
            const fechaIngreso = (
              (await (
                await row.$(SELECTORS.causaFechaIngreso)
              )?.textContent()) || ""
            ).trim();
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
        } catch (err) {
          await captureDebugScreenshot(page, "pjud-buscarPorRut");
          throw err;
        }
      }),
    "pjud.buscarPorRut",
  );
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
