// ─── BCN facade ──────────────────────────────────────────────────
// Picks the BCN scraper implementation based on BCN_SCRAPER env var.
//   BCN_SCRAPER=playwright  -> real Playwright-driven scraper
//   anything else / unset   -> in-memory simulator (default)

import * as simulator from "./simulator";
import * as playwrightImpl from "./playwright-scraper";
import type { BcnNorma, BcnScraper } from "./types";

export type { BcnNorma, BcnScraper } from "./types";
export { BcnUnavailableError, BcnNotFoundError } from "./types";

let cached: BcnScraper | null = null;

export function getBcnScraper(): BcnScraper {
  if (cached) return cached;
  const mode = (process.env.BCN_SCRAPER || "simulator").toLowerCase();
  if (mode === "playwright") {
    cached = {
      buscarNormas: playwrightImpl.buscarNormas,
      obtenerNorma: playwrightImpl.obtenerNorma,
    };
  } else {
    cached = {
      buscarNormas: simulator.buscarNormas,
      obtenerNorma: simulator.obtenerNorma,
    };
  }
  return cached;
}

/** Reset the cached impl (used by tests). */
export function _resetBcnScraper(): void {
  cached = null;
}

export const buscarNormas: BcnScraper["buscarNormas"] = (q, opts) =>
  getBcnScraper().buscarNormas(q, opts);
export const obtenerNorma: BcnScraper["obtenerNorma"] = (n) =>
  getBcnScraper().obtenerNorma(n);
