import { getDb } from "../../../queries/connection";
import { honorarios } from "@db/schema";
import { eq } from "drizzle-orm";
import type { ToolInput, AgentContext } from "../types";

export async function executeEstadoCobranza(_input: ToolInput, ctx: AgentContext): Promise<string> {
  const db = getDb();
  const { userId } = ctx;
  const all = await db.select().from(honorarios).where(eq(honorarios.userId, userId));
  const pendientes = all.filter((h) => h.estado === "pendiente" || h.estado === "pagado_parcial" || h.estado === "vencido" || h.estado === "moroso");
  const totalFacturado = all.reduce((s, h) => s + h.monto, 0);
  const totalPagado = all.reduce((s, h) => s + (h.montoPagado || 0), 0);
  const morosos = all.filter((h) => h.estado === "moroso" || h.estado === "vencido");

  return JSON.stringify({
    resumen: { totalFacturado, totalPagado, porCobrar: totalFacturado - totalPagado, cantidadPendientes: pendientes.length },
    morosos: morosos.map((h) => ({
      id: h.id, cliente: h.cliente, concepto: h.concepto,
      monto: h.monto, pagado: h.montoPagado, estado: h.estado,
      vencimiento: h.fechaVencimiento,
    })),
  });
}

export async function executeCalcularIndemnizacion(input: ToolInput, _ctx: AgentContext): Promise<string> {
  const UF_VALUE = 37200;
  const TOPE_REMUNERACION = 90 * UF_VALUE;
  const TOPE_ANIOS = 11;

  const anios = Number(input.anios) || 0;
  const meses = Number(input.meses) || 0;
  const sueldo = Number(input.sueldo) || 0;
  const avisoPrevio = Boolean(input.aviso_previo);

  const remCalc = Math.min(sueldo, TOPE_REMUNERACION);
  const totalAnios = Math.min(anios + (meses >= 6 ? 1 : 0), TOPE_ANIOS);
  const diasIndemnizacion = totalAnios * 30;
  const montoIndemnizacion = (diasIndemnizacion / 30) * remCalc;
  const montoAvisoPrevio = avisoPrevio ? 0 : remCalc;
  const vacacionesProporcional = Math.round((remCalc / 30) * 1.25 * (meses || 1));
  const total = montoIndemnizacion + montoAvisoPrevio + vacacionesProporcional;

  return JSON.stringify({
    inputRecibido: { anios, meses, sueldo, avisoPrevio },
    calculo: {
      remuneracionCalculo: remCalc,
      topeAplicado: sueldo > TOPE_REMUNERACION,
      totalAniosComputados: totalAnios,
      diasIndemnizacion,
      montoIndemnizacion: Math.round(montoIndemnizacion),
      montoAvisoPrevio: Math.round(montoAvisoPrevio),
      vacacionesProporcional,
      totalEstimado: Math.round(total),
    },
    baseNormativa: "Art. 163 inc. 2° CT (tope 11 años), Art. 172 CT (base de cálculo), Art. 169 letra a) CT (aviso previo)",
  });
}

export async function executeCalcularPlazos(input: ToolInput, _ctx: AgentContext): Promise<string> {
  const tipoPlazo = String(input.tipo_plazo);
  const fechaInicio = input.fecha_inicio ? new Date(String(input.fecha_inicio)) : new Date();
  const fechaInicioStr = fechaInicio.toISOString().split("T")[0];

  interface PlazoInfo {
    dias: number;
    tipo_dias: "hábiles" | "corridos";
    norma: string;
    descripcion: string;
    advertencias?: string[];
  }

  const PLAZOS: Record<string, PlazoInfo> = {
    demanda_despido_injustificado: {
      dias: 60,
      tipo_dias: "hábiles",
      norma: "Art. 168 inc. 1° CT",
      descripcion: "Plazo para demandar por despido injustificado, indebido o improcedente ante el Juzgado de Letras del Trabajo competente",
      advertencias: ["Este plazo se suspende cuando el trabajador interpone reclamo ante la Inspección del Trabajo (Art. 168 inc. 2° CT)", "El plazo se cuenta desde la separación efectiva del trabajador"],
    },
    demanda_despido_indirecto: {
      dias: 60,
      tipo_dias: "hábiles",
      norma: "Art. 171 CT",
      descripcion: "Plazo para demandar despido indirecto (autodespido) por incumplimiento grave del empleador",
      advertencias: ["El trabajador debe comunicar por escrito al empleador su decisión de poner término al contrato", "Causales: Art. 160 N° 1, 5 o 7 CT"],
    },
    recurso_nulidad: {
      dias: 10,
      tipo_dias: "hábiles",
      norma: "Art. 479 CT",
      descripcion: "Plazo para deducir recurso de nulidad ante la Corte de Apelaciones contra sentencia definitiva laboral",
      advertencias: ["Plazo fatal e improrrogable", "Se cuenta desde la notificación de la sentencia", "Debe señalarse causal específica (Art. 477 o 478 CT)"],
    },
    recurso_apelacion: {
      dias: 5,
      tipo_dias: "hábiles",
      norma: "Art. 476 CT",
      descripcion: "Plazo para apelar resoluciones laborales apelables (interlocutorias que pongan término al juicio, medidas cautelares)",
      advertencias: ["Solo procede contra resoluciones expresamente señaladas en el Art. 476 CT", "La sentencia definitiva NO es apelable en juicio laboral (solo recurso de nulidad)"],
    },
    recurso_unificacion: {
      dias: 15,
      tipo_dias: "hábiles",
      norma: "Art. 483-A CT",
      descripcion: "Plazo para interponer recurso de unificación de jurisprudencia ante la Corte Suprema",
      advertencias: ["Se cuenta desde la notificación de la sentencia que resuelve el recurso de nulidad", "Requiere sentencias contradictorias sobre la misma materia de derecho"],
    },
    contestacion_demanda: {
      dias: 5,
      tipo_dias: "hábiles",
      norma: "Art. 452 N° 3 CT",
      descripcion: "Plazo para contestar la demanda antes de la audiencia preparatoria",
      advertencias: ["Debe contestarse por escrito con al menos 5 días de anticipación a la audiencia preparatoria"],
    },
    comparendo_conciliacion: {
      dias: 5,
      tipo_dias: "hábiles",
      norma: "Art. 497 CT (procedimiento monitorio)",
      descripcion: "Plazo para la audiencia de conciliación en procedimiento monitorio desde notificación",
      advertencias: ["En procedimiento de aplicación general, la conciliación es parte de la audiencia preparatoria"],
    },
    investigacion_leykarin: {
      dias: 30,
      tipo_dias: "corridos",
      norma: "Art. 211-C CT (Ley 21.643)",
      descripcion: "Plazo máximo para concluir la investigación de una denuncia Ley Karin",
      advertencias: ["Se cuenta desde la recepción de la denuncia", "Prorrogable por causa justificada y documentada", "Si no se cumple, los antecedentes deben remitirse a la Dirección del Trabajo"],
    },
    medidas_cautelares_karin: {
      dias: 3,
      tipo_dias: "corridos",
      norma: "Art. 211-B inc. 3° CT (Ley 21.643)",
      descripcion: "Plazo para adoptar medidas de resguardo respecto de la presunta víctima",
      advertencias: ["Medidas deben considerar proporcionalidad y enfoque de género", "Incluye: separación espacial, cambio turnos, reasignación funciones"],
    },
    aviso_despido: {
      dias: 30,
      tipo_dias: "corridos",
      norma: "Art. 161 inc. 2° CT",
      descripcion: "Plazo de aviso previo al trabajador antes del despido por necesidades de la empresa",
      advertencias: ["Si no se da aviso previo, debe pagarse indemnización sustitutiva (1 mes de remuneración)", "La carta debe enviarse con copia a la Inspección del Trabajo"],
    },
    envio_finiquito: {
      dias: 10,
      tipo_dias: "hábiles",
      norma: "Art. 177 CT",
      descripcion: "Plazo para poner a disposición del trabajador el finiquito y el pago correspondiente",
      advertencias: ["Se cuenta desde la separación del trabajador", "El finiquito debe ratificarse ante ministro de fe (Inspector del Trabajo, Notario, o Presidente del Sindicato)"],
    },
    cobro_prestaciones: {
      dias: 60,
      tipo_dias: "hábiles",
      norma: "Art. 510 inc. 3° CT (antes de reforma: 6 meses)",
      descripcion: "Plazo para demandar el cobro de prestaciones laborales adeudadas (remuneraciones, gratificaciones, etc.)",
      advertencias: ["El plazo general de prescripción de derechos laborales es de 2 años (Art. 510 CT)", "Este plazo de 60 días hábiles se aplica post-término de la relación laboral para acciones derivadas del despido"],
    },
    tutela_laboral: {
      dias: 60,
      tipo_dias: "hábiles",
      norma: "Art. 486 inc. 4° CT",
      descripcion: "Plazo para interponer denuncia de tutela laboral por vulneración de derechos fundamentales",
      advertencias: ["Se cuenta desde la ocurrencia de la vulneración", "Si es con ocasión del despido, el plazo se cuenta desde la separación", "La acción de tutela es incompatible con la acción del Art. 168 CT (debe elegirse una)"],
    },
    denuncia_practica_antisindical: {
      dias: 60,
      tipo_dias: "hábiles",
      norma: "Art. 292 CT",
      descripcion: "Plazo para denunciar prácticas antisindicales ante el Juzgado de Letras del Trabajo",
      advertencias: ["Se cuenta desde la ocurrencia del hecho", "También puede denunciarse ante la Inspección del Trabajo"],
    },
    prescripcion_derechos_laborales: {
      dias: 730,
      tipo_dias: "corridos",
      norma: "Art. 510 CT",
      descripcion: "Plazo de prescripción general de los derechos laborales (2 años)",
      advertencias: ["Se cuenta desde que se hacen exigibles", "Prescripción de cotizaciones previsionales: 5 años (DL 3.500)"],
    },
  };

  const plazo = PLAZOS[tipoPlazo];
  if (!plazo) {
    return JSON.stringify({ error: `Tipo de plazo "${tipoPlazo}" no reconocido`, tiposDisponibles: Object.keys(PLAZOS) });
  }

  let fechaVencimiento: Date;
  if (plazo.tipo_dias === "corridos") {
    fechaVencimiento = new Date(fechaInicio);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + plazo.dias);
  } else {
    let diasContados = 0;
    fechaVencimiento = new Date(fechaInicio);
    while (diasContados < plazo.dias) {
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 1);
      const dow = fechaVencimiento.getDay();
      if (dow !== 0 && dow !== 6) diasContados++;
    }
  }

  const hoy = new Date();
  const diasRestantes = Math.ceil((fechaVencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

  return JSON.stringify({
    tipoPlazo,
    plazo: {
      dias: plazo.dias,
      tipoDias: plazo.tipo_dias,
      norma: plazo.norma,
      descripcion: plazo.descripcion,
    },
    calculo: {
      fechaInicio: fechaInicioStr,
      fechaVencimiento: fechaVencimiento.toISOString().split("T")[0],
      diasRestantesDesdeHoy: diasRestantes,
      vencido: diasRestantes < 0,
      urgente: diasRestantes >= 0 && diasRestantes <= 5,
    },
    advertencias: plazo.advertencias || [],
    nota: plazo.tipo_dias === "hábiles"
      ? "Cálculo no considera feriados legales. Verificar con calendario judicial vigente."
      : "Plazo en días corridos incluye sábados, domingos y feriados.",
  });
}
