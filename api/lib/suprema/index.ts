// ─── Corte Suprema facade ────────────────────────────────────────
// Selecciona la implementación según `SUPREMA_SCRAPER`:
//   SUPREMA_SCRAPER=playwright -> scraper real
//   otro / no seteada          -> simulador (default)

import * as simulator from "./simulator";
import * as playwrightImpl from "./playwright-scraper";
import type { BuscarFallosOpts, FalloSuprema } from "./types";

export type { BuscarFallosOpts, FalloSuprema } from "./types";
export { SupremaNotFoundError, SupremaUnavailableError } from "./types";

export interface SupremaScraper {
  buscarFallos(
    query: string,
    opts?: BuscarFallosOpts,
  ): Promise<FalloSuprema[]>;
  obtenerFallo(rol: string): Promise<FalloSuprema>;
}

let cached: SupremaScraper | null = null;

export function getSupremaScraper(): SupremaScraper {
  if (cached) return cached;
  const mode = (process.env.SUPREMA_SCRAPER || "simulator").toLowerCase();
  if (mode === "playwright") {
    cached = {
      buscarFallos: playwrightImpl.buscarFallos,
      obtenerFallo: playwrightImpl.obtenerFallo,
    };
  } else {
    cached = {
      buscarFallos: simulator.buscarFallos,
      obtenerFallo: simulator.obtenerFallo,
    };
  }
  return cached;
}

/** Reset the cached impl (used by tests). */
export function _resetSupremaScraper(): void {
  cached = null;
}

export const buscarFallos: SupremaScraper["buscarFallos"] = (query, opts) =>
  getSupremaScraper().buscarFallos(query, opts);
export const obtenerFallo: SupremaScraper["obtenerFallo"] = (rol) =>
  getSupremaScraper().obtenerFallo(rol);
