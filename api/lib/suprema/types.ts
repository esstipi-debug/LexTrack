// ─── Corte Suprema types & errors ────────────────────────────────
// Shared DTO + typed errors para los scrapers de fallos de la
// Corte Suprema (simulator y playwright). El shape refleja un
// fallo publicado por suprema.pjud.cl / buscador de jurisprudencia.

export interface FalloSuprema {
  /** Rol de la causa en la Corte Suprema (ej. "12345-2024"). */
  rol: string;
  /** Fecha de la sentencia en ISO (YYYY-MM-DD). */
  fechaSentencia: string;
  /** Sala que conoció el recurso (ej. "Cuarta Sala"). */
  sala: string;
  /** Materia general (laboral, civil, penal, etc.). */
  materia: string;
  /** Carátula completa de la causa. */
  caratula: string;
  /** Ministro redactor del fallo (opcional). */
  ministroRedactor?: string;
  /** Resumen / extracto del fallo. */
  resumen: string;
  /** URL al detalle/PDF del fallo en suprema.pjud.cl. */
  url: string;
  /** Texto completo opcional (scrape pesado). */
  textoCompleto?: string;
}

export class SupremaUnavailableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "SupremaUnavailableError";
  }
}

export class SupremaNotFoundError extends Error {
  constructor(message = "Fallo no encontrado en la Corte Suprema") {
    super(message);
    this.name = "SupremaNotFoundError";
  }
}

export interface BuscarFallosOpts {
  materia?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  limit?: number;
}
