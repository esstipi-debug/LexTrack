/**
 * Calculadora de indemnizaciones laborales chilenas.
 *
 * Extraída del agent-router para ser reutilizable y testeable.
 *
 * Base legal:
 * - Art. 163 CT: 30 días por año, tope 330 días (11 años).
 * - Art. 172 CT: Base de cálculo = última remuneración mensual, tope 90 UF.
 * - Art. 169 a) CT: Aviso previo = 1 mes de remuneración si no se dio aviso.
 */

/** Valor UF referencial para cálculos (actualizar periódicamente). */
export const UF_VALUE = 37_200;

/** Tope de remuneración: 90 UF (Art. 172 CT). */
export const TOPE_REMUNERACION = 90 * UF_VALUE;

/** Tope máximo de días de indemnización: 330 días = 11 años × 30 (Art. 163 CT). */
export const TOPE_DIAS = 330;

export interface IndemnizacionInput {
  /** Años completos de servicio. */
  anios: number;
  /** Meses adicionales sobre los años completos (0-11). */
  meses?: number;
  /** Última remuneración mensual bruta en CLP. */
  sueldo: number;
  /** true si el empleador dio aviso previo con 30 días de anticipación. */
  avisoPrevioDado?: boolean;
}

export interface IndemnizacionResult {
  /** Años efectivamente computados (con redondeo de fracción >= 6 meses). */
  totalAniosComputados: number;
  /** Remuneración usada para el cálculo (después de aplicar tope 90 UF). */
  remuneracionCalculo: number;
  /** true si se aplicó el tope de 90 UF. */
  topeAplicado: boolean;
  /** Días de indemnización (30 × años, tope 330). */
  diasIndemnizacion: number;
  /** Monto indemnización por años de servicio (Art. 163 CT). */
  montoIndemnizacion: number;
  /** Monto aviso previo (Art. 169 a) CT). 0 si se dio aviso. */
  montoAvisoPrevio: number;
  /** Total = indemnización + aviso previo. */
  total: number;
}

/**
 * Calcula la indemnización por años de servicio según el Código del Trabajo.
 *
 * Reglas:
 * 1. La remuneración se topa en 90 UF (Art. 172 CT).
 * 2. Si los meses adicionales son >= 6, se redondea al año siguiente.
 * 3. El máximo son 11 años = 330 días (Art. 163 CT).
 * 4. Si no se dio aviso previo, se suma 1 mes de remuneración (Art. 169 a CT).
 */
export function calcularIndemnizacion(input: IndemnizacionInput): IndemnizacionResult {
  const { anios, meses = 0, sueldo, avisoPrevioDado = false } = input;

  const remuneracionCalculo = Math.min(sueldo, TOPE_REMUNERACION);
  const totalAniosComputados = anios + (meses >= 6 ? 1 : 0);
  const diasIndemnizacion = Math.min(totalAniosComputados * 30, TOPE_DIAS);
  const montoIndemnizacion = Math.round((diasIndemnizacion / 30) * remuneracionCalculo);
  const montoAvisoPrevio = avisoPrevioDado ? 0 : Math.round(remuneracionCalculo);
  const total = montoIndemnizacion + montoAvisoPrevio;

  return {
    totalAniosComputados,
    remuneracionCalculo,
    topeAplicado: sueldo > TOPE_REMUNERACION,
    diasIndemnizacion,
    montoIndemnizacion,
    montoAvisoPrevio,
    total,
  };
}
