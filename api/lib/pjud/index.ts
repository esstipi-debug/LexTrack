// ─── PJUD facade ─────────────────────────────────────────────────
// Picks the scraper implementation based on the PJUD_SCRAPER env var.
//   PJUD_SCRAPER=playwright  -> real Playwright-driven scraper
//   anything else / unset    -> in-memory simulator (default)
//
// Consumers (router, sync.ts) should import from this module so the
// implementation can be swapped without touching call sites.
//
// Note: `playwright-scraper` is imported statically but is safe — it
// only imports the `playwright` package lazily inside `getBrowser()`,
// so the heavy native dependency is never loaded unless the flag
// `PJUD_SCRAPER=playwright` is set AND a scrape is actually executed.

import * as simulator from "./client";
import * as playwrightImpl from "./playwright-scraper";
import type { PjudCausaResult, PjudMovimiento } from "./client";

export type { PjudCausaResult, PjudMovimiento } from "./client";
export {
  PjudUnavailableError,
  PjudCaptchaError,
  PjudNotFoundError,
} from "./playwright-scraper";

export interface PjudScraper {
  consultarCausa(
    rit: string,
    tribunal?: string,
  ): Promise<PjudCausaResult | null>;
  obtenerMovimientos(
    rit: string,
    tribunal?: string,
  ): Promise<PjudMovimiento[]>;
  buscarPorRut(rut: string): Promise<PjudCausaResult[]>;
}

let cached: PjudScraper | null = null;

export function getPjudScraper(): PjudScraper {
  if (cached) return cached;
  const mode = (process.env.PJUD_SCRAPER || "simulator").toLowerCase();
  if (mode === "playwright") {
    cached = {
      consultarCausa: playwrightImpl.consultarCausa,
      obtenerMovimientos: playwrightImpl.obtenerMovimientos,
      buscarPorRut: playwrightImpl.buscarPorRut,
    };
  } else {
    cached = {
      consultarCausa: simulator.consultarCausa,
      obtenerMovimientos: simulator.obtenerMovimientos,
      buscarPorRut: simulator.buscarPorRut,
    };
  }
  return cached;
}

/** Reset the cached impl (used by tests). */
export function _resetPjudScraper(): void {
  cached = null;
}

// Re-exported function bindings so existing call sites
// (`import { consultarCausa } from "./lib/pjud"`) keep working.
export const consultarCausa: PjudScraper["consultarCausa"] = (rit, tribunal) =>
  getPjudScraper().consultarCausa(rit, tribunal);
export const obtenerMovimientos: PjudScraper["obtenerMovimientos"] = (
  rit,
  tribunal,
) => getPjudScraper().obtenerMovimientos(rit, tribunal);
export const buscarPorRut: PjudScraper["buscarPorRut"] = (rut) =>
  getPjudScraper().buscarPorRut(rut);
