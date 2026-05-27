// ─── BCN (Biblioteca del Congreso Nacional) — Types & Errors ─────
// DTOs and typed errors for the BCN LeyChile scraper. Mirrored from
// the PJUD / DT pattern so a facade in ./index.ts can swap between
// the simulator and the Playwright impl without leaking concretes.

export interface BcnNorma {
  /** Número de la norma, ej "21.643" o "20.940". */
  numero: string;
  /** Título de la norma. */
  titulo: string;
  /** Tipo: "ley", "decreto", "código", "DFL", etc. */
  tipo: string;
  /** Fecha de publicación en formato ISO (YYYY-MM-DD). */
  fechaPublicacion: string;
  /** URL canónica a la norma en bcn.cl/leychile. */
  url: string;
  /** Texto completo de la norma, si está disponible. */
  texto?: string;
}

export class BcnUnavailableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "BcnUnavailableError";
  }
}

export class BcnNotFoundError extends Error {
  constructor(message = "Norma no encontrada en LeyChile (BCN)") {
    super(message);
    this.name = "BcnNotFoundError";
  }
}

export interface BcnScraper {
  buscarNormas(query: string, opts?: { limite?: number }): Promise<BcnNorma[]>;
  obtenerNorma(numero: string): Promise<BcnNorma | null>;
}
