// ─── Corte Suprema — Playwright Scraper ──────────────────────────
// Implementación real contra el buscador de jurisprudencia de la
// Corte Suprema chilena.
//
// Selectores son PLACEHOLDERS. Deben verificarse contra el DOM real
// antes de activar la flag `SUPREMA_SCRAPER=playwright` en prod.
// Cada selector dudoso lleva `// TODO: verify against suprema.pjud.cl`.

import type { Browser, BrowserContext, Page } from "playwright";
import type { BuscarFallosOpts, FalloSuprema } from "./types";
import { SupremaNotFoundError, SupremaUnavailableError } from "./types";

export { SupremaNotFoundError, SupremaUnavailableError } from "./types";

// ─── Config ──────────────────────────────────────────────────────

// TODO: verify URL — el buscador unificado vive bajo suprema.pjud.cl,
// pero la ruta exacta (SITSUPPORWEB vs buscador.pjud.cl) hay que
// confirmarla manualmente antes de activar este scraper.
export const SUPREMA_BASE_URL = "https://suprema.pjud.cl/";

const NAV_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

// ─── Selectores (PLACEHOLDERS) ───────────────────────────────────
export const SELECTORS = {
  // TODO: verify against suprema.pjud.cl
  searchInput: "input[name='q'], input[type='search'], #buscar",
  // TODO: verify against suprema.pjud.cl
  materiaSelect: "select[name='materia'], #materia",
  // TODO: verify against suprema.pjud.cl
  fechaDesdeInput: "input[name='fechaDesde'], #fechaDesde",
  // TODO: verify against suprema.pjud.cl
  fechaHastaInput: "input[name='fechaHasta'], #fechaHasta",
  // TODO: verify against suprema.pjud.cl
  submitButton: "button[type='submit'], input[type='submit']",
  // TODO: verify against suprema.pjud.cl
  resultsContainer: "#resultados, .fallos-list, table.fallos",
  // TODO: verify against suprema.pjud.cl
  falloRow: "tr.fallo-row, li.fallo, .fallo-item",
  // TODO: verify against suprema.pjud.cl
  falloRol: ".rol, td.rol",
  // TODO: verify against suprema.pjud.cl
  falloFecha: ".fecha, td.fecha",
  // TODO: verify against suprema.pjud.cl
  falloSala: ".sala, td.sala",
  // TODO: verify against suprema.pjud.cl
  falloMateria: ".materia, td.materia",
  // TODO: verify against suprema.pjud.cl
  falloCaratula: ".caratula, td.caratula, a.caratula",
  // TODO: verify against suprema.pjud.cl
  falloMinistro: ".ministro-redactor, .redactor",
  // TODO: verify against suprema.pjud.cl
  falloResumen: ".resumen, .extracto, td.extracto",
  // TODO: verify against suprema.pjud.cl
  falloLink: "a[href*='rol=']",
  // TODO: verify against suprema.pjud.cl
  noResults: ".sin-resultados, .no-results",
  // ─── Detalle del fallo ─────────────────────────────────────────
  // TODO: verify against suprema.pjud.cl
  detalleRol: "#detalle-rol, .detalle .rol",
  // TODO: verify against suprema.pjud.cl
  detalleTexto: "#texto-completo, .texto-fallo",
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
      if (err instanceof SupremaNotFoundError) throw err;
      lastErr = err;
      if (attempt < maxRetries - 1) {
        const delay = baseMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw new SupremaUnavailableError(
    `Corte Suprema scraper falló tras ${maxRetries} intentos`,
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

async function scrapeFalloRows(page: Page): Promise<FalloSuprema[]> {
  const rows = await page.$$(SELECTORS.falloRow);
  const out: FalloSuprema[] = [];
  for (const row of rows) {
    const caratula = await textOf(row, SELECTORS.falloCaratula);
    if (!caratula) continue;
    const url = await attrOf(row, SELECTORS.falloLink, "href");
    out.push({
      rol: await textOf(row, SELECTORS.falloRol),
      fechaSentencia: await textOf(row, SELECTORS.falloFecha),
      sala: await textOf(row, SELECTORS.falloSala),
      materia: (await textOf(row, SELECTORS.falloMateria)) || "otra",
      caratula,
      ministroRedactor: (await textOf(row, SELECTORS.falloMinistro)) || undefined,
      resumen: await textOf(row, SELECTORS.falloResumen),
      url: url.startsWith("http") ? url : `${SUPREMA_BASE_URL}${url}`,
    });
  }
  return out;
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Busca fallos de la Corte Suprema por término libre. `opts.materia`,
 * `fechaDesde` y `fechaHasta` se aplican como filtros si los soporta el front.
 */
export async function buscarFallos(
  query: string,
  opts: BuscarFallosOpts = {},
): Promise<FalloSuprema[]> {
  return withRetry(async () => {
    const { page, context } = await newPage();
    try {
      await page.goto(SUPREMA_BASE_URL, { waitUntil: "domcontentloaded" });
      await page.fill(SELECTORS.searchInput, query).catch(() => {});
      if (opts.materia) {
        await page.selectOption(SELECTORS.materiaSelect, opts.materia).catch(() => {});
      }
      if (opts.fechaDesde) {
        await page.fill(SELECTORS.fechaDesdeInput, toIso(opts.fechaDesde)).catch(() => {});
      }
      if (opts.fechaHasta) {
        await page.fill(SELECTORS.fechaHastaInput, toIso(opts.fechaHasta)).catch(() => {});
      }
      await page.click(SELECTORS.submitButton).catch(() => {});
      await page.waitForLoadState("domcontentloaded");

      const noResults = await page.$(SELECTORS.noResults);
      if (noResults) return [];

      const container = await page.$(SELECTORS.resultsContainer);
      if (!container) return [];

      let fallos = await scrapeFalloRows(page);
      if (opts.limit) fallos = fallos.slice(0, opts.limit);
      return fallos;
    } finally {
      await context.close().catch(() => {});
    }
  });
}

/**
 * Obtiene el detalle de un fallo a partir de su rol (ej. "12345-2024").
 */
export async function obtenerFallo(rol: string): Promise<FalloSuprema> {
  return withRetry(async () => {
    const { page, context } = await newPage();
    try {
      const url = `${SUPREMA_BASE_URL}SITSUPPORWEB/InicioAplicacion.do?rol=${encodeURIComponent(rol)}`;
      await page.goto(url, { waitUntil: "domcontentloaded" });

      const rolEl = await page.$(SELECTORS.detalleRol);
      if (!rolEl) throw new SupremaNotFoundError(`Fallo ${rol} no encontrado`);

      const texto = await textOf(page as any, SELECTORS.detalleTexto);
      const caratula = await textOf(page as any, SELECTORS.falloCaratula);

      return {
        rol,
        fechaSentencia: await textOf(page as any, SELECTORS.falloFecha),
        sala: await textOf(page as any, SELECTORS.falloSala),
        materia: (await textOf(page as any, SELECTORS.falloMateria)) || "otra",
        caratula,
        ministroRedactor: (await textOf(page as any, SELECTORS.falloMinistro)) || undefined,
        resumen: await textOf(page as any, SELECTORS.falloResumen),
        url,
        textoCompleto: texto || undefined,
      };
    } finally {
      await context.close().catch(() => {});
    }
  });
}
