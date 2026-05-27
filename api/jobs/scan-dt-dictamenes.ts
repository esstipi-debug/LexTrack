// ─── Direccion del Trabajo dictamenes scan job (STUB) ─────────────
// Weekly job that will scan dt.gob.cl for new dictamenes once the
// api/lib/dt facade lands. For now this is a no-op stub so the cron
// registry can already wire it up.

export interface DtScanResult {
  dictamenesNuevos: number;
  alertasCreadas: number;
  errores: number;
}

import { createLogger } from "../lib/logger";

const log = createLogger("jobs/scan-dt-dictamenes");

export async function scanDtDictamenes(): Promise<DtScanResult> {
  log.info("DT scan not yet wired — stub running");
  // TODO: wire to api/lib/dt facade when it lands. Pseudocode:
  //   const dictamenes = await obtenerDictamenesRecientes();
  //   dedupe vs db, insert nuevos, fan-out alertas per user.
  return { dictamenesNuevos: 0, alertasCreadas: 0, errores: 0 };
}
