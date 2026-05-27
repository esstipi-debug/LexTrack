// ─── Dirección del Trabajo (DT) — Types & Errors ─────────────────
// DTOs and typed errors for the DT dictámenes scraper. Mirrored from
// the PJUD module pattern so a facade in ./index.ts can swap between
// the simulator and the Playwright impl without leaking concretes.

export interface DtDictamen {
  /** Número de ordinario, ej "1234/45" o "4523/2024". */
  ordinario: string;
  /** Fecha del dictamen en formato ISO (YYYY-MM-DD). */
  fecha: string;
  /** Materia / tema principal del dictamen. */
  materia: string;
  /** Sumario o extracto resolutivo del dictamen. */
  sumario: string;
  /** URL canónica al dictamen en dt.gob.cl. */
  url: string;
  /** Texto completo del dictamen, si está disponible. */
  texto?: string;
}

export class DtUnavailableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "DtUnavailableError";
  }
}

export class DtNotFoundError extends Error {
  constructor(message = "Dictamen no encontrado en la Dirección del Trabajo") {
    super(message);
    this.name = "DtNotFoundError";
  }
}

export interface DtScraper {
  buscarDictamenes(query: string, opts?: { limite?: number }): Promise<DtDictamen[]>;
  obtenerDictamen(ordinario: string): Promise<DtDictamen | null>;
}
