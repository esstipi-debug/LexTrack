// Chilean legal interest rates for overdue payments
// Tasa maxima convencional (TMC) - simplified for labor context

export interface InteresCalculo {
  montoPendiente: number;
  diasMora: number;
  tasaMensual: number; // default: 1.5% mensual (tasa legal)
  interesCalculado: number;
  totalConInteres: number;
  baseNormativa: string;
}

/**
 * Calcula intereses por mora segun legislacion chilena.
 *
 * Tasa legal por defecto: 1.5% mensual (Art. 1559 CC).
 * En materia laboral el Art. 63 CT establece que las sumas adeudadas
 * se reajustan y devengan interes maximo convencional desde que se
 * hicieron exigibles.
 */
export function calcularInteresMora(params: {
  monto: number;
  montoPagado: number;
  fechaVencimiento: string | Date;
  tasaMensual?: number; // default 1.5% (tasa legal chilena Art. 1559 CC)
}): InteresCalculo {
  const { monto, montoPagado, tasaMensual = 1.5 } = params;

  const montoPendiente = monto - (montoPagado || 0);

  const fechaVenc =
    typeof params.fechaVencimiento === "string"
      ? new Date(params.fechaVencimiento)
      : params.fechaVencimiento;

  const hoy = new Date();
  const diffMs = hoy.getTime() - fechaVenc.getTime();
  const diasMora = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  // Interes simple: (montoPendiente * tasaMensual/100) * (diasMora / 30)
  const interesCalculado =
    diasMora > 0
      ? Math.round((montoPendiente * (tasaMensual / 100) * diasMora) / 30)
      : 0;

  const totalConInteres = montoPendiente + interesCalculado;

  return {
    montoPendiente,
    diasMora,
    tasaMensual,
    interesCalculado,
    totalConInteres,
    baseNormativa:
      "Art. 63 CT (reajustes e intereses), Art. 1559 CC (interes legal)",
  };
}
