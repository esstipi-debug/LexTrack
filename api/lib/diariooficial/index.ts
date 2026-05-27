// ─── Diario Oficial facade ───────────────────────────────────────
// Selecciona la implementación según `DIARIO_OFICIAL_SCRAPER`:
//   DIARIO_OFICIAL_SCRAPER=playwright -> scraper real
//   otro / no seteada                 -> simulador (default)

import * as simulator from "./simulator";
import * as playwrightImpl from "./playwright-scraper";
import type { BuscarNormasOpts, DiarioOficialNorma } from "./types";

export type { BuscarNormasOpts, DiarioOficialNorma } from "./types";
export {
  DiarioOficialNotFoundError,
  DiarioOficialUnavailableError,
} from "./types";

export interface DiarioOficialScraper {
  obtenerEdicionDelDia(fecha?: Date): Promise<DiarioOficialNorma[]>;
  buscarNormas(
    query: string,
    opts?: BuscarNormasOpts,
  ): Promise<DiarioOficialNorma[]>;
}

let cached: DiarioOficialScraper | null = null;

export function getDiarioOficialScraper(): DiarioOficialScraper {
  if (cached) return cached;
  const mode = (process.env.DIARIO_OFICIAL_SCRAPER || "simulator").toLowerCase();
  if (mode === "playwright") {
    cached = {
      obtenerEdicionDelDia: playwrightImpl.obtenerEdicionDelDia,
      buscarNormas: playwrightImpl.buscarNormas,
    };
  } else {
    cached = {
      obtenerEdicionDelDia: simulator.obtenerEdicionDelDia,
      buscarNormas: simulator.buscarNormas,
    };
  }
  return cached;
}

/** Reset the cached impl (used by tests). */
export function _resetDiarioOficialScraper(): void {
  cached = null;
}

export const obtenerEdicionDelDia: DiarioOficialScraper["obtenerEdicionDelDia"] = (
  fecha,
) => getDiarioOficialScraper().obtenerEdicionDelDia(fecha);
export const buscarNormas: DiarioOficialScraper["buscarNormas"] = (query, opts) =>
  getDiarioOficialScraper().buscarNormas(query, opts);
