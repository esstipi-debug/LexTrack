import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  causas, tareas, alertas, honorarios, jurisprudencias,
  documentosLegales, leykarinDenuncias, diarioOficialNormas,
} from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { calcularInteresMora } from "./lib/cobranza/intereses";
import {
  generarEstadoCuenta,
  generarReporteCobranza,
  generarCartaCobranza,
} from "./lib/cobranza/reportes";

// ─── INTENCIÓN DEL AGENTE ────────────────────────────────────────
type Intencion = { tipo: string; confianza: number; params: Record<string, any> };

const patronesIntencion: { tipo: string; keywords: string[]; params?: string[]; peso: number }[] = [
  { tipo: "saludo", keywords: ["hola", "buenas", "hey", "que tal", "como estas", "buenos dias", "buenas tardes"], peso: 1 },
  { tipo: "ayuda", keywords: ["ayuda", "help", "que puedes hacer", "que haces", "funciones", "capacidades"], peso: 1 },
  { tipo: "crear_tarea", keywords: ["crea tarea", "nueva tarea", "agregar tarea", "generar tarea"], peso: 3 },
  { tipo: "buscar_causa", keywords: ["busca causa", "causa de", "donde esta la causa", "causa rit"], peso: 3 },
  { tipo: "listar_causas", keywords: ["mis causas", "lista causas", "causas activas", "ver causas"], peso: 2 },
  { tipo: "listar_tareas", keywords: ["mis tareas", "lista tareas", "tareas pendientes", "que tengo pendiente"], peso: 2 },
  { tipo: "listar_alertas", keywords: ["mis alertas", "alertas pendientes", "notificaciones"], peso: 2 },
  { tipo: "listar_vencidos", keywords: ["vencidos", "plazos vencidos", "atrasados", "caducados"], peso: 3 },
  { tipo: "listar_proximos", keywords: ["proximos plazos", "plazos proximos", "vence pronto"], peso: 3 },
  { tipo: "analizar_causa", keywords: ["analiza causa", "analisis de causa", "estado de causa"], peso: 3 },
  { tipo: "calcular_indemnizacion", keywords: ["calcula indemnizacion", "cuanto le corresponde", "indemnizacion por", "finiquito"], peso: 3 },
  { tipo: "estadisticas", keywords: ["estadisticas", "dashboard", "resumen", "como vamos", "metricas"], peso: 2 },
  { tipo: "estado_cobranza", keywords: ["cobranza", "honorarios", "pagos", "cuanto me deben", "morosos"], peso: 3 },
  { tipo: "estado_leykari", keywords: ["ley karin", "denuncias acoso", "acoso laboral"], peso: 3 },
  { tipo: "generar_documento", keywords: ["genera documento", "genera carta", "genera demanda", "carta de"], peso: 3 },
  { tipo: "consultar_rag", keywords: ["articulo", "codigo del trabajo", "norma", "ley chile", "derecho laboral"], peso: 2 },
  { tipo: "buscar_jurisprudencia", keywords: ["jurisprudencia", "fallo", "sentencia sobre", "tribunal"], peso: 3 },
  { tipo: "diario_oficial", keywords: ["diario oficial", "norma nueva", "decreto"], peso: 2 },
  { tipo: "checklist", keywords: ["checklist", "lista de verificacion", "pasos para"], peso: 2 },
  { tipo: "despedida", keywords: ["chao", "adios", "hasta luego", "nos vemos", "gracias"], peso: 1 },
];

function extraerParams(mensaje: string): Record<string, any> {
  const params: Record<string, any> = {};
  const lower = mensaje.toLowerCase();

  const aniosMatch = mensaje.match(/(\d+)\s*(años?|año)/i);
  const mesesMatch = mensaje.match(/(\d+)\s*(meses?|mes)/i);
  if (aniosMatch) params.anios = parseInt(aniosMatch[1]);
  if (mesesMatch) params.meses = parseInt(mesesMatch[1]);

  const sueldoMatch = mensaje.match(/\$?([\d.]+)\s*(mil|millon|millones)?/i);
  if (sueldoMatch) {
    const raw = sueldoMatch[0].replace(/[.$]/g, "").toLowerCase();
    if (raw.includes("mil")) params.sueldo = parseInt(sueldoMatch[1].replace(/\./g, "")) * 1000;
    else if (raw.includes("millon")) params.sueldo = parseInt(sueldoMatch[1].replace(/\./g, "")) * 1000000;
    else params.sueldo = parseInt(sueldoMatch[1].replace(/\./g, ""));
  }

  const ritMatch = mensaje.match(/([CLcl]-\d[\d\-\.]*|\d[\d\.]*-\d)/i);
  if (ritMatch) params.rit = ritMatch[1];

  const fechaMatch = mensaje.match(/(mañana|hoy|pasado mañana|\d{1,2}\/\d{1,2})/i);
  if (fechaMatch) {
    const f = fechaMatch[1].toLowerCase();
    if (f === "mañana") { const d = new Date(); d.setDate(d.getDate() + 1); params.fecha = d.toISOString().split("T")[0]; }
    else if (f === "hoy") params.fecha = new Date().toISOString().split("T")[0];
    else params.fecha = f;
  }

  params.aviso_previo = lower.includes("aviso previo") || lower.includes("dieron aviso");

  if (lower.includes("carta de despido")) params.tipo_doc = "carta_aviso_despido";
  else if (lower.includes("demanda")) params.tipo_doc = "demanda_indemnizacion";
  else if (lower.includes("notificacion")) params.tipo_doc = "notificacion_cliente";

  return params;
}

function clasificarIntencion(mensaje: string): Intencion {
  const lower = mensaje.toLowerCase().trim();
  const params = extraerParams(mensaje);
  let mejor: Intencion | null = null;
  let mejorPuntaje = 0;

  for (const patron of patronesIntencion) {
    let puntaje = 0;
    for (const kw of patron.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        puntaje += patron.peso;
        if (lower.startsWith(kw.toLowerCase())) puntaje += 1;
      }
    }
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = { tipo: patron.tipo, confianza: Math.min(puntaje / 5, 1), params };
    }
  }

  if (!mejor || mejor.confianza < 0.3) {
    if (lower.includes("?") || lower.includes("derecho") || lower.includes("legal") || lower.includes("trabajo")) {
      return { tipo: "consultar_rag", confianza: 0.5, params };
    }
    return { tipo: "desconocido", confianza: 0, params };
  }
  return mejor;
}

// ─── EJECUTORES ──────────────────────────────────────────────────
async function ejecutarCalcularIndemnizacion(params: Record<string, any>) {
  const UF_VALUE = 37200;
  const TOPE_REMUNERACION = 90 * UF_VALUE;
  const TOPE_DIAS = 330;

  const anios = params.anios || 0;
  const meses = params.meses || 0;
  const remuneracion = params.sueldo || 0;
  const avisoPrevioDado = params.aviso_previo;

  if (!anios || !remuneracion) {
    return {
      mensaje: `Necesito mas datos para calcular. Por favor indícame:\n• Años de servicio\n• Remuneración mensual\n• Meses adicionales (opcional)`,
      tarjeta: null,
      sugerencias: ["5 años, sueldo 800.000", "3 años y 6 meses, sueldo 1.200.000", "10 años, sueldo 500.000"],
    };
  }

  const remCalc = Math.min(remuneracion, TOPE_REMUNERACION);
  const totalAnios = anios + (meses >= 6 ? 1 : 0);
  const diasIndemnizacion = Math.min(totalAnios * 30, TOPE_DIAS);
  const montoIndemnizacion = (diasIndemnizacion / 30) * remCalc;
  const montoAvisoPrevio = avisoPrevioDado ? 0 : remCalc;
  const proporcionalVacaciones = (remCalc / 30) * 1.25;
  const proporcionalFeriado = (remCalc / 30);
  const total = montoIndemnizacion + montoAvisoPrevio + proporcionalVacaciones + proporcionalFeriado;

  return {
    mensaje: `Cálculo de indemnización (Art. 163 CT):`,
    tarjeta: {
      tipo: "calculo_indemnizacion",
      datos: {
        aniosServicio: anios,
        mesesAdicionales: meses,
        totalAniosComputados: totalAnios,
        remuneracionOriginal: remuneracion,
        remuneracionCalculo: remCalc,
        topeAplicado: remuneracion > TOPE_REMUNERACION,
        diasIndemnizacion,
        montoIndemnizacion: Math.round(montoIndemnizacion),
        montoAvisoPrevio: Math.round(montoAvisoPrevio),
        proporcionalVacaciones: Math.round(proporcionalVacaciones),
        proporcionalFeriado: Math.round(proporcionalFeriado),
        total: Math.round(total),
        articuloBase: "Art. 163 CT",
        formula: `${totalAnios} años × 30 días = ${diasIndemnizacion} días × $${Math.round(remCalc / 30)}/día`,
      },
    },
    sugerencias: ["Generar carta de despido", "Generar demanda", "Guardar cálculo"],
  };
}

async function ejecutarEstadisticas() {
  const db = getDb();
  const totalCausas = await db.select().from(causas);
  const causasActivas = totalCausas.filter(c => c.estado !== "concluida" && c.estado !== "archivada");
  const totalTareas = await db.select().from(tareas);
  const tareasPendientes = totalTareas.filter(t => t.estado === "pendiente");
  const totalAlertas = await db.select().from(alertas);
  const alertasPendientes = totalAlertas.filter(a => a.estado === "pendiente");
  const totalHonorarios = await db.select().from(honorarios);
  const totalFacturado = totalHonorarios.reduce((acc, h) => acc + h.monto, 0);
  const totalPagado = totalHonorarios.reduce((acc, h) => acc + (h.montoPagado || 0), 0);

  return {
    mensaje: `**Resumen del Estudio:**`,
    tarjeta: {
      tipo: "estadisticas",
      datos: {
        causas: { total: totalCausas.length, activas: causasActivas.length },
        tareas: { total: totalTareas.length, pendientes: tareasPendientes.length },
        alertas: { total: totalAlertas.length, pendientes: alertasPendientes.length },
        cobranza: { facturado: totalFacturado, pagado: totalPagado, porCobrar: totalFacturado - totalPagado },
      },
    },
    sugerencias: ["Ver causas activas", "Ver tareas pendientes", "Ver estado cobranza"],
  };
}

async function ejecutarAyuda() {
  return {
    mensaje: `**Soy LexTrack AI**, tu agente legal asistente especializado en derecho laboral chileno. Esto es lo que puedo hacer:\n\n**Crear y gestionar:**\n• "Crea tarea para revisar causa C-123 mañana"\n• "Crea alerta de plazo para la causa del señor González"\n\n**Buscar y analizar:**\n• "Busca causas de González" / "Dónde está la causa C-123"\n• "Analiza la causa del señor Pérez y dime qué falta"\n\n**Cálculos:**\n• "Calcula indemnización para 5 años, sueldo 800.000"\n• "Finiquito para 3 años y 6 meses, sueldo 1.200.000"\n\n**Cobranza y Honorarios:**\n• "Estado de cobranza" / "Cuánto me deben"\n• "Genera reporte de cobranza"\n• "Genera carta de cobranza para honorario #5"\n• "Calcula intereses moratorios"\n• "Estado de cuenta de cliente González"\n\n**Consulta normativa (RAG):**\n• "Artículo 163 código del trabajo"\n• "Derechos del trabajador despedido"\n• "Desconexion digital"\n• "Ley Karin"\n\n**Análisis:**\n• "Estadísticas del estudio" / "Cómo vamos"\n• "Plazos vencidos" / "Próximos plazos"`,
    sugerencias: ["Mis tareas", "Estadísticas", "Plazos vencidos", "Calcular indemnización", "Reporte cobranza"],
  };
}

// ─── ROUTER ───────────────────────────────────────────────────────
export const agentRouter = createRouter({
  chat: publicQuery
    .input(z.object({ mensaje: z.string().min(1), sessionId: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { mensaje } = input;
      const intencion = clasificarIntencion(mensaje);
      let resultado: any;
      const db = getDb();

      switch (intencion.tipo) {
        case "saludo":
          resultado = { mensaje: `Hola! Soy **LexTrack AI**, tu agente legal asistente. Escribe "ayuda" para ver todo lo que puedo hacer.`, sugerencias: ["Ver mis tareas", "Estadísticas", "Plazos vencidos", "Calcular indemnización"] };
          break;
        case "ayuda":
          resultado = await ejecutarAyuda();
          break;
        case "crear_tarea":
          resultado = { mensaje: `Para crear una tarea, ve a la página de Tareas y usa el botón "Nueva Tarea".`, sugerencias: ["Ir a Tareas", "Ver causas", "Volver al inicio"] };
          break;
        case "listar_causas": {
          const results = await db.select().from(causas).orderBy(desc(causas.createdAt)).limit(10);
          resultado = { mensaje: results.length > 0 ? `Tienes ${results.length} causa(s):` : `No hay causas registradas.`, tarjetas: results.map(c => ({ tipo: "causa", id: c.id, rit: c.rit, caratula: c.caratula, tribunal: c.tribunal, estado: c.estado })), sugerencias: ["Crear nueva causa", "Buscar causa"] };
          break;
        }
        case "listar_tareas": {
          const results = await db.select().from(tareas).where(sql`${tareas.estado} IN ('pendiente', 'en_progreso')`).orderBy(tareas.fechaVencimiento).limit(10);
          resultado = { mensaje: results.length > 0 ? `Tienes ${results.length} tarea(s) pendiente(s):` : `No tienes tareas pendientes.`, tarjetas: results.map(t => ({ tipo: "tarea", id: t.id, titulo: t.titulo, vencimiento: t.fechaVencimiento, prioridad: t.prioridad, estado: t.estado })), sugerencias: ["Crear nueva tarea", "Ver calendario"] };
          break;
        }
        case "listar_alertas": {
          const results = await db.select().from(alertas).where(eq(alertas.estado, "pendiente")).orderBy(desc(alertas.prioridad)).limit(10);
          resultado = { mensaje: results.length > 0 ? `Tienes ${results.length} alerta(s) pendiente(s):` : `No tienes alertas pendientes.`, tarjetas: results.map(a => ({ tipo: "alerta", id: a.id, titulo: a.titulo, prioridad: a.prioridad })), sugerencias: ["Marcar todas leídas", "Crear alerta"] };
          break;
        }
        case "listar_vencidos": {
          const hoy = new Date().toISOString().split("T")[0];
          const vencidos = await db.select().from(tareas).where(and(sql`${tareas.estado} IN ('pendiente', 'en_progreso')`, sql`${tareas.fechaVencimiento} < ${hoy}`)).limit(10);
          resultado = { mensaje: vencidos.length > 0 ? `⚠️ Tienes ${vencidos.length} plazo(s) vencido(s):` : `No tienes plazos vencidos. Todo al día!`, tarjetas: vencidos.map(t => ({ tipo: "tarea_vencida", id: t.id, titulo: t.titulo, vencimiento: t.fechaVencimiento })), sugerencias: ["Ver próximos plazos", "Crear alerta"] };
          break;
        }
        case "calcular_indemnizacion":
        case "calcular_finiquito":
          resultado = await ejecutarCalcularIndemnizacion(intencion.params);
          break;
        case "estadisticas":
          resultado = await ejecutarEstadisticas();
          break;
        case "estado_cobranza": {
          const all = await db.select().from(honorarios);
          const pendientes = all.filter(h => h.estado === "pendiente" || h.estado === "pagado_parcial");
          const totalPendiente = pendientes.reduce((acc, h) => acc + (h.monto - (h.montoPagado || 0)), 0);
          resultado = { mensaje: totalPendiente > 0 ? `**Estado de cobranza:**\n\n• Total facturado: $${all.reduce((a, h) => a + h.monto, 0).toLocaleString("es-CL")}\n• Total pagado: $${all.reduce((a, h) => a + (h.montoPagado || 0), 0).toLocaleString("es-CL")}\n• Por cobrar: $${totalPendiente.toLocaleString("es-CL")}` : `No hay saldos pendientes.`, sugerencias: ["Ver todos los honorarios", "Generar reporte"] };
          break;
        }
        case "estado_leykari": {
          const denuncias = await db.select().from(leykarinDenuncias);
          resultado = { mensaje: denuncias.length > 0 ? `**Estado Ley Karin:**\n\n• Total denuncias: ${denuncias.length}` : `No hay denuncias registradas bajo Ley Karin.`, sugerencias: ["Ver denuncias", "Nueva denuncia"] };
          break;
        }
        case "consultar_rag": {
          const docs = await db.select().from(documentosLegales).where(sql`${documentosLegales.estaActiva} = 1`);
          const queryWords = mensaje.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const scored = docs.map(d => {
            let score = 0;
            for (const w of queryWords) {
              if (d.titulo?.toLowerCase().includes(w)) score += 10;
              if (d.articulo?.toLowerCase().includes(w)) score += 8;
              if (d.etiquetas?.toLowerCase().includes(w)) score += 5;
              const matches = (d.contenido.toLowerCase().match(new RegExp(w, "g")) || []).length;
              score += matches * 1.5;
            }
            return { ...d, score };
          }).filter(d => d.score > 0.5).sort((a, b) => b.score - a.score).slice(0, 3);

          if (scored.length === 0) {
            resultado = { mensaje: `No encontré normativa específica sobre eso. Te recomiendo consultar en www.leychile.cl.`, sugerencias: ["Buscar en jurisprudencia"] };
          } else {
            const respuesta = scored.map((d, i) => {
              const contenido = d.contenido.length > 400 ? d.contenido.substring(0, 400) + "..." : d.contenido;
              return `${i + 1}. **${d.articulo || d.titulo}** (${d.norma})\n${contenido}`;
            }).join("\n\n");
            resultado = { mensaje: `Según mi base normativa:\n\n${respuesta}\n\n---\n*Esta información es orientativa. Verifica siempre las fuentes oficiales.*`, tarjeta: { tipo: "rag_response", fuentes: scored.map(d => `${d.norma} — ${d.articulo || d.titulo}`) }, sugerencias: ["Ver artículo completo", "Generar documento"] };
          }
          break;
        }
        case "buscar_jurisprudencia": {
          const juris = await db.select().from(jurisprudencias).where(sql`${jurisprudencias.estaActiva} = 1`).limit(50);
          const q = mensaje.replace(/^(busca|buscar)\s+(jurisprudencia|fallo|sentencia)\s*/i, "").trim();
          const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const scored = juris.map(j => {
            let score = 0;
            const text = `${j.caratula || ""} ${j.contenido} ${j.extracto || ""}`.toLowerCase();
            for (const w of words) if (text.includes(w)) score += 1;
            return { ...j, score };
          }).filter(j => j.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
          resultado = { mensaje: scored.length > 0 ? `Encontré ${scored.length} fallo(s) relevante(s):` : `No encontré jurisprudencia sobre "${q}".`, tarjetas: scored.map(j => ({ tipo: "jurisprudencia", id: j.id, caratula: j.caratula, tribunal: j.tribunal, tipoJuris: j.tipo, fecha: j.fechaSentencia })), sugerencias: scored.length > 0 ? ["Ver fallo completo"] : ["Buscar con otros términos"] };
          break;
        }
        case "diario_oficial": {
          const normas = await db.select().from(diarioOficialNormas).orderBy(desc(diarioOficialNormas.fechaPublicacion)).limit(5);
          resultado = { mensaje: `**Últimas normas en el Diario Oficial:**`, tarjetas: normas.map(n => ({ tipo: "diario_oficial", id: n.id, titulo: n.titulo, organismo: n.organismo, fecha: n.fechaPublicacion })), sugerencias: ["Ver todas las normas"] };
          break;
        }
        case "despedida":
          resultado = { mensaje: `Hasta luego! Estoy aquí cuando me necesites.`, sugerencias: [] };
          break;
        default:
          resultado = { mensaje: `No estoy seguro de entender. Escribe "ayuda" para ver todo lo que puedo hacer.`, sugerencias: ["Ver ayuda", "Estadísticas"] };
      }

      return { intencion: intencion.tipo, confianza: intencion.confianza, ...resultado };
    }),

  // ─── Tool: generar_reporte_cobranza ──────────────────────────────
  // Genera reportes de cobranza: estado de cuenta por cliente, reporte general, o carta de cobranza.
  generarReporteCobranza: publicQuery
    .input(
      z.object({
        tipo: z.enum(["estado_cuenta", "reporte_general", "carta_cobranza"]),
        cliente: z.string().optional(),
        honorarioId: z.number().optional(),
        numeroCarta: z.number().min(1).max(3).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      switch (input.tipo) {
        case "estado_cuenta": {
          if (!input.cliente) {
            return { ok: false, mensaje: "Se requiere el nombre del cliente." };
          }
          const rows = await db
            .select()
            .from(honorarios)
            .where(eq(honorarios.cliente, input.cliente))
            .orderBy(desc(honorarios.createdAt));
          if (rows.length === 0) {
            return {
              ok: false,
              mensaje: `No se encontraron honorarios para el cliente "${input.cliente}".`,
            };
          }
          const markdown = generarEstadoCuenta(input.cliente, rows);
          return { ok: true, tipo: "estado_cuenta", markdown };
        }
        case "reporte_general": {
          const todos = await db.select().from(honorarios);
          const reporte = generarReporteCobranza(todos);
          return { ok: true, tipo: "reporte_general", ...reporte };
        }
        case "carta_cobranza": {
          if (!input.honorarioId) {
            return { ok: false, mensaje: "Se requiere el ID del honorario." };
          }
          const rows = await db
            .select()
            .from(honorarios)
            .where(eq(honorarios.id, input.honorarioId))
            .limit(1);
          if (rows.length === 0) {
            return { ok: false, mensaje: "Honorario no encontrado." };
          }
          const numero = input.numeroCarta || 1;
          const markdown = generarCartaCobranza(rows[0], numero);
          return { ok: true, tipo: "carta_cobranza", numeroCarta: numero, markdown };
        }
        default:
          return { ok: false, mensaje: "Tipo de reporte no reconocido." };
      }
    }),

  // ─── Tool: calcular_intereses ────────────────────────────────────
  // Calcula intereses por mora sobre honorarios vencidos segun tasa legal chilena.
  calcularIntereses: publicQuery
    .input(z.object({ honorarioId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(honorarios)
        .where(eq(honorarios.id, input.honorarioId))
        .limit(1);
      if (rows.length === 0) {
        return { ok: false, mensaje: "Honorario no encontrado." };
      }
      const h = rows[0];
      if (!h.fechaVencimiento) {
        return {
          ok: true,
          honorarioId: h.id,
          cliente: h.cliente,
          interes: null,
          mensaje: "Sin fecha de vencimiento definida, no se calculan intereses.",
        };
      }
      const interes = calcularInteresMora({
        monto: h.monto,
        montoPagado: h.montoPagado || 0,
        fechaVencimiento: h.fechaVencimiento,
      });
      return {
        ok: true,
        honorarioId: h.id,
        cliente: h.cliente,
        concepto: h.concepto,
        interes,
      };
    }),
});
