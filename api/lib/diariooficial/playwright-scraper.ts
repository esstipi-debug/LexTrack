// ─── Diario Oficial — Playwright Scraper ─────────────────────────
// Implementación real contra https://www.diariooficial.interior.gob.cl/edicionelectronica/
//
// Selectores son PLACEHOLDERS. Deben verificarse contra el DOM real
// antes de activar la flag `DIARIO_OFICIAL_SCRAPER=playwright` en prod.
// Cada selector dudoso lleva una marca `// TODO(scraper-selectors): ...`.
//
// Browser/page lifecycle, retry, y screenshot-on-error viven en
// `api/jobs/lib/playwright-helpers.ts`. Ver `docs/SCRAPERS.md` para el
// workflow de verificación contra el sitio vivo.

import type { Page, ElementHandle } from "playwright";
import type {
  BuscarNormasOpts,
  DiarioOficialNorma,
} from "./types";
import {
  DiarioOficialNotFoundError,
  DiarioOficialUnavailableError,
} from "./types";
import {
  withBrowser,
  withRetries,
  captureDebugScreenshot,
} from "../../jobs/lib/playwright-helpers";

export {
  DiarioOficialNotFoundError,
  DiarioOficialUnavailableError,
} from "./types";

// ─── Config ──────────────────────────────────────────────────────

export const DIARIO_OFICIAL_BASE_URL =
  "https://www.diariooficial.interior.gob.cl/edicionelectronica/";

const MAX_RETRIES = 3;

// ─── Selectores (PLACEHOLDERS) ───────────────────────────────────
// Centralizados arriba para que actualizar un selector sea un edit de
// una línea. Ver `docs/SCRAPERS.md` → "Para actualizar selectores".
export const SELECTORS = {
  // TODO(scraper-selectors): verificar contra DOM real de https://www.diariooficial.interior.gob.cl/edicionelectronica/ — input de fecha
  fechaInput: "input[name='date'], #fecha",
  // TODO(scraper-selectors): verificar — botón submit del formulario de búsqueda
  submitButton: "button[type='submit'], input[type='submit']",
  // TODO(scraper-selectors): verificar — input de búsqueda libre
  searchInput: "input[name='q'], input[type='search']",
  // TODO(scraper-selectors): verificar — contenedor del listado de normas / edición del día
  resultsContainer: "#resultados, .normas-list, table.ediciones",
  // TODO(scraper-selectors): verificar — fila individual de norma en el listado
  normaRow: "tr.norma-row, li.norma, .norma-item",
  // TODO(scraper-selectors): verificar — celda tipo de norma (Ley, Decreto, etc.)
  normaTipo: ".tipo, td.tipo",
  // TODO(scraper-selectors): verificar — número de norma
  normaNumero: ".numero, td.numero",
  // TODO(scraper-selectors): verificar — título de la norma
  normaTitulo: ".titulo, td.titulo, a.titulo",
  // TODO(scraper-selectors): verificar — organismo emisor
  normaOrganismo: ".organismo, td.organismo",
  // TODO(scraper-selectors): verificar — materia (laboral, civil, etc.)
  normaMateria: ".materia, td.materia",
  // TODO(scraper-selectors): verificar — fecha de publicación
  normaFecha: ".fecha, td.fecha",
  // TODO(scraper-selectors): verificar — link al texto completo de la norma
  normaLink: "a[href*='/edicionelectronica/']",
  // TODO(scraper-selectors): verificar — mensaje "sin resultados"
  noResults: ".sin-resultados, .no-results",
} as const;

// ─── Backward-compat shim ────────────────────────────────────────
// `closeBrowser` used to terminate a long-lived browser singleton.
// Lifecycle now lives inside `withBrowser` (one browser per scrape),
// so this is a no-op kept for callers that still import it.
export async function closeBrowser(): Promise<void> {
  // no-op — browsers are now scoped per `withBrowser` call.
}

// ─── Page helpers ────────────────────────────────────────────────

async function textOf(
  row: ElementHandle | Page,
  selector: string,
): Promise<string> {
  const el = await row.$(selector);
  if (!el) return "";
  return ((await el.textContent()) || "").trim();
}

async function attrOf(
  row: ElementHandle | Page,
  selector: string,
  attr: string,
): Promise<string> {
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

/** Wraps the helper retry with Diario-Oficial-specific abort logic:
 *  NotFound errors bypass retries; transient errors retry up to
 *  MAX_RETRIES and finally surface as `DiarioOficialUnavailableError`. */
async function withDoRetry<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<T> {
  try {
    return await withRetries(fn, {
      label,
      retries: MAX_RETRIES,
      baseDelayMs: 500,
      shouldRetry: (err) => !(err instanceof DiarioOficialNotFoundError),
    });
  } catch (err) {
    if (err instanceof DiarioOficialNotFoundError) throw err;
    throw new DiarioOficialUnavailableError(
      `Diario Oficial scraper falló tras ${MAX_RETRIES} intentos`,
      err,
    );
  }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Devuelve las normas publicadas en la edición electrónica del Diario
 * Oficial para una fecha dada (default: hoy).
 */
export async function obtenerEdicionDelDia(
  fecha: Date = new Date(),
): Promise<DiarioOficialNorma[]> {
  return withDoRetry(
    () =>
      withBrowser(async ({ page }) => {
        try {
          const url = `${DIARIO_OFICIAL_BASE_URL}?date=${toIso(fecha)}`;
          await page.goto(url, { waitUntil: "domcontentloaded" });

          const noResults = await page.$(SELECTORS.noResults);
          if (noResults) return [];

          const container = await page.$(SELECTORS.resultsContainer);
          if (!container) return [];

          return await scrapeNormaRows(page);
        } catch (err) {
          await captureDebugScreenshot(page, "diariooficial-edicionDelDia");
          throw err;
        }
      }),
    "diariooficial.obtenerEdicionDelDia",
  );
}

/**
 * Busca normas por término libre. `opts.materia`, `fechaDesde` y
 * `fechaHasta` se aplican como filtros si los soporta el front.
 */
export async function buscarNormas(
  query: string,
  opts: BuscarNormasOpts = {},
): Promise<DiarioOficialNorma[]> {
  return withDoRetry(
    () =>
      withBrowser(async ({ page }) => {
        try {
          await page.goto(DIARIO_OFICIAL_BASE_URL, {
            waitUntil: "domcontentloaded",
          });
          await page.fill(SELECTORS.searchInput, query).catch(() => {});
          // TODO(scraper-selectors): verificar — date range fields
          if (opts.fechaDesde) {
            await page
              .fill(SELECTORS.fechaInput, toIso(opts.fechaDesde))
              .catch(() => {});
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
        } catch (err) {
          await captureDebugScreenshot(page, "diariooficial-buscarNormas");
          throw err;
        }
      }),
    "diariooficial.buscarNormas",
  );
}
