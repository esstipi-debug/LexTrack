// ─── Diario Oficial types & errors ───────────────────────────────
// Shared DTO + typed errors for the Diario Oficial scrapers
// (simulator and playwright impls). Mirrors the consumer-facing
// fields of the `diarioOficialNormas` table in db/schema.ts.

export interface DiarioOficialNorma {
  /** Tipo de norma: "ley", "decreto", "resolucion", "circular", etc. */
  tipoNorma: string;
  /** Número/identificador de la norma (ej. "21.643"). */
  numero: string;
  /** Título oficial. */
  titulo: string;
  /** Fecha de publicación en ISO (YYYY-MM-DD). */
  fechaPublicacion: string;
  /** Organismo emisor (ministerio, servicio). */
  organismo: string;
  /** Materia general (laboral, civil, etc.). */
  materia: string;
  /** URL del PDF / detalle en diariooficial.interior.gob.cl. */
  url: string;
  /** Texto completo opcional (cuando se solicita scrape pesado). */
  texto?: string;
}

export class DiarioOficialUnavailableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "DiarioOficialUnavailableError";
  }
}

export class DiarioOficialNotFoundError extends Error {
  constructor(message = "Norma no encontrada en el Diario Oficial") {
    super(message);
    this.name = "DiarioOficialNotFoundError";
  }
}

export interface BuscarNormasOpts {
  materia?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  limit?: number;
}
