// ─── DT facade ───────────────────────────────────────────────────
// Picks the DT scraper implementation based on DT_SCRAPER env var.
//   DT_SCRAPER=playwright  -> real Playwright-driven scraper
//   anything else / unset  -> in-memory simulator (default)

import * as simulator from "./simulator";
import * as playwrightImpl from "./playwright-scraper";
import type { DtDictamen, DtScraper } from "./types";

export type { DtDictamen, DtScraper } from "./types";
export { DtUnavailableError, DtNotFoundError } from "./types";

let cached: DtScraper | null = null;

export function getDtScraper(): DtScraper {
  if (cached) return cached;
  const mode = (process.env.DT_SCRAPER || "simulator").toLowerCase();
  if (mode === "playwright") {
    cached = {
      buscarDictamenes: playwrightImpl.buscarDictamenes,
      obtenerDictamen: playwrightImpl.obtenerDictamen,
    };
  } else {
    cached = {
      buscarDictamenes: simulator.buscarDictamenes,
      obtenerDictamen: simulator.obtenerDictamen,
    };
  }
  return cached;
}

/** Reset the cached impl (used by tests). */
export function _resetDtScraper(): void {
  cached = null;
}

export const buscarDictamenes: DtScraper["buscarDictamenes"] = (q, opts) =>
  getDtScraper().buscarDictamenes(q, opts);
export const obtenerDictamen: DtScraper["obtenerDictamen"] = (ord) =>
  getDtScraper().obtenerDictamen(ord);
