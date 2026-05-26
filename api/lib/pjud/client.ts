// ─── PJUD Client ─────────────────────────────────────────────────
// Client for the Poder Judicial consultation system (consultaunificada.pjud.cl)
// TODO: Replace with real PJUD scraping (puppeteer/playwright)

export interface PjudCausaResult {
  rit: string;
  ruc: string;
  caratula: string;
  tribunal: string;
  estado: string;
  etapa: string;
  fechaIngreso: string;
  ultimoMovimiento: {
    fecha: string;
    tipo: string;
    descripcion: string;
  } | null;
  litigantes: string[];
}

export interface PjudMovimiento {
  fecha: string;
  tipo: string; // "resolucion", "actuacion", "audiencia", etc.
  descripcion: string;
  folio?: string;
}

// ─── Simulated data for development ──────────────────────────────

const TRIBUNALES = [
  "1er Juzgado de Letras del Trabajo de Santiago",
  "2do Juzgado de Letras del Trabajo de Santiago",
  "Juzgado de Letras del Trabajo de Valparaiso",
  "Juzgado de Letras del Trabajo de Concepcion",
  "Juzgado de Letras del Trabajo de Antofagasta",
  "Juzgado de Letras del Trabajo de Temuco",
  "Juzgado de Cobranza Laboral y Previsional de Santiago",
];

const ESTADOS_PJUD = [
  "Tramitacion",
  "En acuerdo",
  "Sentenciada",
  "Cumplimiento",
  "Archivada",
];

const ETAPAS_PJUD = [
  "Discusion",
  "Conciliacion",
  "Prueba",
  "Sentencia",
  "Ejecucion",
  "Recurso",
];

const TIPOS_MOVIMIENTO = [
  "resolucion",
  "actuacion",
  "audiencia",
  "notificacion",
  "escrito",
  "sentencia",
];

const CARATULAS_DEMO = [
  "GONZALEZ PEREZ, MARIA con EMPRESA ACME S.A.",
  "RODRIGUEZ SILVA, PEDRO con CONSTRUCTORA LOS ANDES LTDA.",
  "MARTINEZ FUENTES, CLAUDIA con SERVICIOS GLOBAL SPA",
  "LOPEZ HENRIQUEZ, JUAN con TRANSPORTES DEL SUR S.A.",
  "DIAZ CONTRERAS, ANA con COMERCIAL EL PACIFICO LTDA.",
  "SOTO VERGARA, CARLOS con MINERA CERRO BLANCO S.A.",
  "MUÑOZ ARAYA, PATRICIA con BANCO NACIONAL S.A.",
  "HERRERA LAGOS, DIEGO con SUPERMERCADOS UNIDOS S.A.",
];

const DESCRIPCIONES_MOVIMIENTO = [
  "Resolucion: Tengase presente. Proveyendo escrito de fs. 45",
  "Actuacion: Se lleva a efecto audiencia preparatoria",
  "Resolucion: Citese a las partes a audiencia de juicio para el dia 15/03/2026",
  "Notificacion: Notifiquese al demandado por cedula",
  "Escrito: Demandante acompaña documentos",
  "Resolucion: Recibese la causa a prueba",
  "Actuacion: Se lleva a efecto audiencia de juicio",
  "Sentencia: Se dicta sentencia definitiva",
  "Resolucion: Se tiene por interpuesto recurso de nulidad",
  "Notificacion: Notificacion personal al demandante",
  "Resolucion: Archivese",
  "Actuacion: Comparendo de conciliacion",
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRuc(rit: string): string {
  const year = rit.match(/(\d{4})/)?.[1] || "2025";
  const seq = Math.floor(Math.random() * 900000 + 100000);
  return `${year}-${seq}-L`;
}

function generateFecha(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

function generateMovimientos(count: number): PjudMovimiento[] {
  const movimientos: PjudMovimiento[] = [];
  for (let i = 0; i < count; i++) {
    movimientos.push({
      fecha: generateFecha(i * 15 + Math.floor(Math.random() * 10)),
      tipo: randomItem(TIPOS_MOVIMIENTO),
      descripcion: randomItem(DESCRIPCIONES_MOVIMIENTO),
      folio: String(count - i),
    });
  }
  return movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function simulateDelay(): Promise<void> {
  // Simulate network latency (200-600ms)
  const ms = 200 + Math.floor(Math.random() * 400);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Consulta una causa en el PJUD por RIT y opcionalmente tribunal.
 * TODO: Replace with real PJUD scraping (puppeteer/playwright)
 */
export async function consultarCausa(
  rit: string,
  tribunal?: string,
): Promise<PjudCausaResult | null> {
  await simulateDelay();

  // Validate RIT format (e.g., "O-1234-2025", "T-567-2024")
  const ritPattern = /^[A-Za-z]-\d{1,6}-\d{4}$/;
  if (!ritPattern.test(rit)) {
    return null;
  }

  const selectedTribunal = tribunal || randomItem(TRIBUNALES);
  const caratula = randomItem(CARATULAS_DEMO);
  const estado = randomItem(ESTADOS_PJUD);
  const etapa = randomItem(ETAPAS_PJUD);
  const ruc = generateRuc(rit);
  const fechaIngreso = generateFecha(Math.floor(Math.random() * 365) + 30);
  const litigantes = caratula.split(" con ").map((s) => s.trim());

  const movimientos = generateMovimientos(3);
  const ultimoMovimiento =
    movimientos.length > 0
      ? {
          fecha: movimientos[0].fecha,
          tipo: movimientos[0].tipo,
          descripcion: movimientos[0].descripcion,
        }
      : null;

  return {
    rit,
    ruc,
    caratula,
    tribunal: selectedTribunal,
    estado,
    etapa,
    fechaIngreso,
    ultimoMovimiento,
    litigantes,
  };
}

/**
 * Obtiene los movimientos (cronologia) de una causa en el PJUD.
 * TODO: Replace with real PJUD scraping (puppeteer/playwright)
 */
export async function obtenerMovimientos(
  rit: string,
  _tribunal?: string,
): Promise<PjudMovimiento[]> {
  await simulateDelay();

  const ritPattern = /^[A-Za-z]-\d{1,6}-\d{4}$/;
  if (!ritPattern.test(rit)) {
    return [];
  }

  const count = Math.floor(Math.random() * 8) + 3;
  return generateMovimientos(count);
}

/**
 * Busca causas asociadas a un RUT en el PJUD.
 * TODO: Replace with real PJUD scraping (puppeteer/playwright)
 */
export async function buscarPorRut(
  rut: string,
): Promise<PjudCausaResult[]> {
  await simulateDelay();

  // Validate RUT format (e.g., "12.345.678-9" or "12345678-9")
  const rutClean = rut.replace(/\./g, "");
  const rutPattern = /^\d{7,8}-[\dkK]$/;
  if (!rutPattern.test(rutClean)) {
    return [];
  }

  // Simulate 1-4 results for any valid RUT
  const count = Math.floor(Math.random() * 4) + 1;
  const results: PjudCausaResult[] = [];

  for (let i = 0; i < count; i++) {
    const year = 2024 + Math.floor(Math.random() * 2);
    const seq = Math.floor(Math.random() * 9000) + 1000;
    const prefix = randomItem(["O", "T", "C", "M"]);
    const rit = `${prefix}-${seq}-${year}`;
    const tribunal = randomItem(TRIBUNALES);
    const caratula = randomItem(CARATULAS_DEMO);
    const estado = randomItem(ESTADOS_PJUD);
    const etapa = randomItem(ETAPAS_PJUD);
    const ruc = generateRuc(rit);
    const fechaIngreso = generateFecha(Math.floor(Math.random() * 365) + 30);
    const litigantes = caratula.split(" con ").map((s) => s.trim());

    const movimientos = generateMovimientos(2);
    const ultimoMovimiento =
      movimientos.length > 0
        ? {
            fecha: movimientos[0].fecha,
            tipo: movimientos[0].tipo,
            descripcion: movimientos[0].descripcion,
          }
        : null;

    results.push({
      rit,
      ruc,
      caratula,
      tribunal,
      estado,
      etapa,
      fechaIngreso,
      ultimoMovimiento,
      litigantes,
    });
  }

  return results;
}
