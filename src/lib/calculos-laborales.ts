/**
 * Calculadoras laborales chilenas (cálculos puros, frontend).
 *
 * Convenciones:
 * - Sueldo mensual en CLP (sin decimales en el output: redondeamos).
 * - "Día" = sueldo / 30, criterio habitual en finiquitos.
 * - Todos los montos retornados están redondeados a CLP entero.
 *
 * Aviso: estos cálculos son orientativos. No reemplazan asesoría legal.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function diasEntre(desde: Date, hasta: Date): number {
  const diff = hasta.getTime() - desde.getTime();
  if (diff <= 0) return 0;
  return Math.floor(diff / MS_PER_DAY);
}

/**
 * Feriado proporcional (Art. 73 CT).
 * Días de feriado = (días trabajados / 365) * 15 días hábiles.
 * Valor día = sueldo / 30.
 */
export function feriadoProporcional(args: {
  fechaInicio: Date;
  fechaTermino: Date;
  sueldoMensual: number;
}): { dias: number; monto: number } {
  const diasTrabajados = diasEntre(args.fechaInicio, args.fechaTermino);
  const dias = (diasTrabajados / 365) * 15;
  const monto = (args.sueldoMensual / 30) * dias;
  return {
    dias: Math.round(dias * 100) / 100,
    monto: Math.max(0, Math.round(monto)),
  };
}

/**
 * Indemnización sustitutiva del aviso previo (Art. 162 CT).
 * Cuando no se da el mes de aviso, corresponde un sueldo mensual completo.
 */
export function avisoPrevio(sueldoMensual: number): number {
  return Math.max(0, Math.round(sueldoMensual));
}

/**
 * Vacaciones pendientes (días acumulados ya devengados pero no tomados).
 * Valor día = sueldo / 30.
 */
export function vacacionesPendientes(args: {
  diasPendientes: number;
  sueldoMensual: number;
}): number {
  if (args.diasPendientes <= 0 || args.sueldoMensual <= 0) return 0;
  return Math.round((args.sueldoMensual / 30) * args.diasPendientes);
}

/**
 * Indemnización por años de servicio (Art. 163 CT).
 * 1 mes de remuneración por cada año trabajado y fracción superior a 6 meses,
 * con tope de 11 años. La base mensual puede tener tope (90 UF, históricamente).
 */
export function indemnizacionAnosServicio(args: {
  fechaInicio: Date;
  fechaTermino: Date;
  sueldoMensual: number;
  tope?: number;
}): { anos: number; monto: number } {
  const ms = args.fechaTermino.getTime() - args.fechaInicio.getTime();
  if (ms <= 0 || args.sueldoMensual <= 0) {
    return { anos: 0, monto: 0 };
  }
  const anos = Math.min(Math.ceil(ms / (MS_PER_DAY * 365)), 11);
  const base =
    args.tope && args.tope > 0 ? Math.min(args.sueldoMensual, args.tope) : args.sueldoMensual;
  return { anos, monto: Math.round(anos * base) };
}

export type MotivoFiniquito =
  | "renuncia"
  | "despido_injustificado"
  | "mutuo_acuerdo"
  | "necesidades_empresa";

export interface FiniquitoArgs {
  fechaInicio: Date;
  fechaTermino: Date;
  sueldoMensual: number;
  diasVacacionesPendientes: number;
  motivo: MotivoFiniquito;
  topeIndemnizacion?: number;
}

export interface FiniquitoConcepto {
  nombre: string;
  monto: number;
  detalle?: string;
}

export interface FiniquitoResult {
  conceptos: FiniquitoConcepto[];
  total: number;
}

/**
 * Calcula el finiquito completo según motivo de término.
 *
 * Conceptos por motivo:
 * - renuncia: vacaciones pendientes + feriado proporcional.
 * - mutuo_acuerdo: vacaciones pendientes + feriado proporcional.
 * - despido_injustificado: + indemnización años de servicio + aviso previo.
 * - necesidades_empresa: + indemnización años de servicio + aviso previo.
 */
export function calcularFiniquito(args: FiniquitoArgs): FiniquitoResult {
  const conceptos: FiniquitoConcepto[] = [];

  const vacacionesMonto = vacacionesPendientes({
    diasPendientes: args.diasVacacionesPendientes,
    sueldoMensual: args.sueldoMensual,
  });
  if (vacacionesMonto > 0) {
    conceptos.push({
      nombre: "Vacaciones pendientes",
      monto: vacacionesMonto,
      detalle: `${args.diasVacacionesPendientes} día(s) acumulado(s)`,
    });
  }

  const feriado = feriadoProporcional({
    fechaInicio: args.fechaInicio,
    fechaTermino: args.fechaTermino,
    sueldoMensual: args.sueldoMensual,
  });
  if (feriado.monto > 0) {
    conceptos.push({
      nombre: "Feriado proporcional",
      monto: feriado.monto,
      detalle: `${feriado.dias} día(s) proporcional(es)`,
    });
  }

  const incluyeIndemnizaciones =
    args.motivo === "despido_injustificado" || args.motivo === "necesidades_empresa";

  if (incluyeIndemnizaciones) {
    const indem = indemnizacionAnosServicio({
      fechaInicio: args.fechaInicio,
      fechaTermino: args.fechaTermino,
      sueldoMensual: args.sueldoMensual,
      tope: args.topeIndemnizacion,
    });
    if (indem.monto > 0) {
      conceptos.push({
        nombre: "Indemnización por años de servicio",
        monto: indem.monto,
        detalle: `${indem.anos} año(s) (tope 11)`,
      });
    }

    const aviso = avisoPrevio(args.sueldoMensual);
    if (aviso > 0) {
      conceptos.push({
        nombre: "Indemnización sustitutiva aviso previo",
        monto: aviso,
        detalle: "1 mes de remuneración",
      });
    }
  }

  const total = conceptos.reduce((acc, c) => acc + c.monto, 0);
  return { conceptos, total };
}

/** Formatea un monto a CLP usando Intl.NumberFormat. */
export function formatCLP(monto: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Math.round(monto));
}
