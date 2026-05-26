import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { getRagPool } from "./queries/rag-pg";
import {
  causas, tareas, alertas, honorarios, jurisprudencias,
  documentosLegales, leykarinDenuncias, diarioOficialNormas,
} from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { rawComplete, type AnthropicTool, type AnthropicMessage, type AnthropicContent } from "./lib/anthropic";
import { rankDocumentosLegales, rankJurisprudencia } from "./lib/rag/retrieve-local";
import { hybridRetrieve, pgRowToRetrievedChunk } from "./lib/rag/pg-hybrid";
import { env } from "./lib/env";

// ─── TOOL DEFINITIONS ───────────────────────────────────────────

const agentTools: AnthropicTool[] = [
  {
    name: "buscar_normativa",
    description: "Busca artículos del Código del Trabajo y leyes laborales especiales chilenas. Usa esta herramienta cuando el usuario pregunte sobre normas, artículos, derechos laborales, obligaciones del empleador, etc.",
    input_schema: {
      type: "object",
      properties: {
        consulta: { type: "string", description: "Texto de búsqueda: artículo, tema o pregunta legal" },
      },
      required: ["consulta"],
    },
  },
  {
    name: "buscar_jurisprudencia",
    description: "Busca fallos y sentencias laborales chilenas relevantes. Usa esta herramienta cuando el usuario pregunte sobre jurisprudencia, fallos, sentencias o precedentes judiciales.",
    input_schema: {
      type: "object",
      properties: {
        consulta: { type: "string", description: "Tema, artículo o materia para buscar jurisprudencia" },
      },
      required: ["consulta"],
    },
  },
  {
    name: "listar_causas",
    description: "Lista las causas judiciales del estudio. Puede filtrar por estado. Usa esta herramienta cuando el usuario pida ver sus causas, causas activas, o buscar una causa específica.",
    input_schema: {
      type: "object",
      properties: {
        estado: { type: "string", enum: ["tramitacion", "notificacion", "prueba", "sentencia", "ejecucion", "concluida", "archivada"], description: "Filtrar por estado (opcional)" },
        busqueda: { type: "string", description: "Texto para buscar en RIT, carátula o tribunal (opcional)" },
        limite: { type: "number", description: "Número máximo de resultados (default 10)" },
      },
      required: [],
    },
  },
  {
    name: "listar_tareas",
    description: "Lista las tareas pendientes o en progreso. Usa esta herramienta cuando el usuario pregunte por tareas, cosas pendientes o qué tiene que hacer.",
    input_schema: {
      type: "object",
      properties: {
        estado: { type: "string", enum: ["pendiente", "en_progreso", "completada", "cancelada"], description: "Filtrar por estado (default: pendiente)" },
        limite: { type: "number", description: "Número máximo de resultados (default 10)" },
      },
      required: [],
    },
  },
  {
    name: "crear_tarea",
    description: "Crea una nueva tarea en el sistema. Usa esta herramienta cuando el usuario pida crear, agregar o agendar una tarea.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Título de la tarea" },
        descripcion: { type: "string", description: "Descripción detallada (opcional)" },
        prioridad: { type: "string", enum: ["baja", "media", "alta", "critica"], description: "Prioridad (default: media)" },
        fechaVencimiento: { type: "string", description: "Fecha de vencimiento en formato YYYY-MM-DD (opcional)" },
        tipo: { type: "string", enum: ["revision_documento", "preparar_escrito", "seguimiento_causa", "revisar_resolucion", "notificar_cliente", "agendar_audiencia", "investigar_norma", "checklist_despido", "checklist_finiquito", "revisar_diario_oficial", "otra"], description: "Tipo de tarea (default: otra)" },
        causaId: { type: "number", description: "ID de la causa asociada (opcional)" },
      },
      required: ["titulo"],
    },
  },
  {
    name: "listar_alertas",
    description: "Lista las alertas pendientes del sistema. Usa esta herramienta cuando el usuario pregunte por alertas, notificaciones o avisos.",
    input_schema: {
      type: "object",
      properties: {
        limite: { type: "number", description: "Número máximo de resultados (default 10)" },
      },
      required: [],
    },
  },
  {
    name: "plazos_vencidos",
    description: "Muestra tareas con plazos vencidos. Usa esta herramienta cuando el usuario pregunte por plazos vencidos, tareas atrasadas o cosas caducadas.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "calcular_indemnizacion",
    description: "Calcula la indemnización por despido según el Art. 163 del Código del Trabajo chileno. Usa esta herramienta cuando el usuario pida calcular indemnización, finiquito, o cuánto le corresponde a un trabajador.",
    input_schema: {
      type: "object",
      properties: {
        anios: { type: "number", description: "Años de servicio del trabajador" },
        meses: { type: "number", description: "Meses adicionales sobre los años completos (default 0)" },
        sueldo: { type: "number", description: "Remuneración mensual en CLP" },
        aviso_previo: { type: "boolean", description: "Si el empleador dio aviso previo de 30 días (default false)" },
      },
      required: ["anios", "sueldo"],
    },
  },
  {
    name: "estadisticas",
    description: "Muestra estadísticas generales del estudio: causas, tareas, alertas, cobranza. Usa esta herramienta cuando el usuario pida un resumen, dashboard, métricas o 'cómo vamos'.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "estado_cobranza",
    description: "Muestra el estado de honorarios y cobranza: facturado, pagado, por cobrar, morosos. Usa esta herramienta cuando el usuario pregunte por cobros, pagos, honorarios o plata.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "estado_leykarin",
    description: "Muestra el estado de las denuncias bajo Ley Karin (Ley 21.643). Usa esta herramienta cuando el usuario pregunte por denuncias de acoso laboral, acoso sexual, Ley Karin o violencia laboral.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "diario_oficial",
    description: "Lista las últimas normas publicadas en el Diario Oficial. Usa esta herramienta cuando el usuario pregunte por normas nuevas, decretos recientes o publicaciones del Diario Oficial.",
    input_schema: {
      type: "object",
      properties: {
        limite: { type: "number", description: "Número máximo de resultados (default 5)" },
      },
      required: [],
    },
  },
];

// ─── TOOL EXECUTORS ─────────────────────────────────────────────

async function ejecutarTool(name: string, input: Record<string, unknown>): Promise<string> {
  const db = getDb();

  switch (name) {
    case "buscar_normativa": {
      const consulta = String(input.consulta ?? "");
      const pool = getRagPool();
      const canHybrid = Boolean(pool && env.voyageApiKey?.trim());

      if (canHybrid && pool) {
        try {
          const cnt = await pool.query<{ c: string }>("SELECT COUNT(*)::text AS c FROM rag_chunks");
          const n = parseInt(cnt.rows[0]?.c ?? "0", 10);
          if (n > 0) {
            const rows = await hybridRetrieve(pool, consulta);
            if (rows.length > 0) {
              const chunks = rows.map(pgRowToRetrievedChunk);
              return JSON.stringify({
                pipeline: "pg_hybrid",
                resultados: chunks.map((c) => ({
                  fuente: c.source === "jurisprudencia" ? `Fallo: ${c.rol || c.caratula}` : `${c.norma} — ${c.articulo || c.titulo}`,
                  contenido: c.contenido.slice(0, 2000),
                  norma: c.norma,
                  articulo: c.articulo,
                })),
                total: chunks.length,
              });
            }
          }
        } catch { /* fallback a MySQL */ }
      }

      const docs = await db.select().from(documentosLegales).where(sql`${documentosLegales.estaActiva} = 1`);
      const scored = rankDocumentosLegales(consulta, docs, 5);
      return JSON.stringify({
        pipeline: "mysql_lexical",
        resultados: scored.map((d) => ({
          fuente: `${d.norma} — ${d.articulo || d.titulo}`,
          contenido: d.contenido.slice(0, 2000),
          norma: d.norma,
          articulo: d.articulo,
          score: d.score,
        })),
        total: scored.length,
      });
    }

    case "buscar_jurisprudencia": {
      const consulta = String(input.consulta ?? "");
      const juris = await db.select().from(jurisprudencias).where(sql`${jurisprudencias.estaActiva} = 1`);
      const scored = rankJurisprudencia(consulta, juris, 5);
      return JSON.stringify({
        resultados: scored.map((j) => ({
          caratula: j.caratula,
          tribunal: j.tribunal,
          tipo: j.tipo,
          fecha: j.fechaSentencia,
          rit: j.rit,
          extracto: (j.extracto || j.contenido).slice(0, 1500),
          normasAplicadas: j.normasAplicadas,
        })),
        total: scored.length,
      });
    }

    case "listar_causas": {
      const limite = Number(input.limite) || 10;
      const busqueda = input.busqueda ? String(input.busqueda) : null;
      const estado = input.estado ? String(input.estado) : null;

      const conditions = [];
      if (estado) conditions.push(eq(causas.estado, estado as any));
      if (busqueda) {
        conditions.push(sql`(${causas.rit} LIKE ${`%${busqueda}%`} OR ${causas.caratula} LIKE ${`%${busqueda}%`} OR ${causas.tribunal} LIKE ${`%${busqueda}%`})`);
      }

      const results = conditions.length > 0
        ? await db.select().from(causas).where(and(...conditions)).orderBy(desc(causas.createdAt)).limit(limite)
        : await db.select().from(causas).orderBy(desc(causas.createdAt)).limit(limite);

      return JSON.stringify({
        causas: results.map((c) => ({
          id: c.id, rit: c.rit, caratula: c.caratula, tribunal: c.tribunal,
          estado: c.estado, materia: c.materia, fechaIngreso: c.fechaIngreso,
        })),
        total: results.length,
      });
    }

    case "listar_tareas": {
      const estado = input.estado ? String(input.estado) : "pendiente";
      const limite = Number(input.limite) || 10;
      const results = await db.select().from(tareas)
        .where(eq(tareas.estado, estado as any))
        .orderBy(tareas.fechaVencimiento)
        .limit(limite);
      return JSON.stringify({
        tareas: results.map((t) => ({
          id: t.id, titulo: t.titulo, estado: t.estado, prioridad: t.prioridad,
          vencimiento: t.fechaVencimiento, tipo: t.tipo, descripcion: t.descripcion?.slice(0, 200),
        })),
        total: results.length,
      });
    }

    case "crear_tarea": {
      const titulo = String(input.titulo);
      const values: Record<string, unknown> = {
        titulo,
        descripcion: input.descripcion ? String(input.descripcion) : null,
        prioridad: (input.prioridad as any) || "media",
        tipo: (input.tipo as any) || "otra",
      };
      if (input.fechaVencimiento) values.fechaVencimiento = new Date(String(input.fechaVencimiento));
      if (input.causaId) values.causaId = Number(input.causaId);
      const result = await db.insert(tareas).values(values as any);
      return JSON.stringify({ ok: true, mensaje: `Tarea "${titulo}" creada exitosamente`, id: Number(result[0].insertId) });
    }

    case "listar_alertas": {
      const limite = Number(input.limite) || 10;
      const results = await db.select().from(alertas)
        .where(eq(alertas.estado, "pendiente"))
        .orderBy(desc(alertas.prioridad))
        .limit(limite);
      return JSON.stringify({
        alertas: results.map((a) => ({
          id: a.id, titulo: a.titulo, tipo: a.tipo, prioridad: a.prioridad,
          fechaVencimiento: a.fechaVencimiento,
        })),
        total: results.length,
      });
    }

    case "plazos_vencidos": {
      const hoy = new Date().toISOString().split("T")[0];
      const vencidos = await db.select().from(tareas)
        .where(and(
          sql`${tareas.estado} IN ('pendiente', 'en_progreso')`,
          sql`${tareas.fechaVencimiento} < ${hoy}`
        ))
        .limit(20);
      return JSON.stringify({
        vencidos: vencidos.map((t) => ({
          id: t.id, titulo: t.titulo, vencimiento: t.fechaVencimiento, prioridad: t.prioridad,
        })),
        total: vencidos.length,
        fechaHoy: hoy,
      });
    }

    case "calcular_indemnizacion": {
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

    case "estadisticas": {
      const [allCausas, allTareas, allAlertas, allHonorarios] = await Promise.all([
        db.select().from(causas),
        db.select().from(tareas),
        db.select().from(alertas),
        db.select().from(honorarios),
      ]);
      const causasActivas = allCausas.filter((c) => c.estado !== "concluida" && c.estado !== "archivada").length;
      const tareasPendientes = allTareas.filter((t) => t.estado === "pendiente").length;
      const alertasPendientes = allAlertas.filter((a) => a.estado === "pendiente").length;
      const totalFacturado = allHonorarios.reduce((s, h) => s + h.monto, 0);
      const totalPagado = allHonorarios.reduce((s, h) => s + (h.montoPagado || 0), 0);

      return JSON.stringify({
        causas: { total: allCausas.length, activas: causasActivas },
        tareas: { total: allTareas.length, pendientes: tareasPendientes },
        alertas: { total: allAlertas.length, pendientes: alertasPendientes },
        cobranza: { facturado: totalFacturado, pagado: totalPagado, porCobrar: totalFacturado - totalPagado },
      });
    }

    case "estado_cobranza": {
      const all = await db.select().from(honorarios);
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

    case "estado_leykarin": {
      const denuncias = await db.select().from(leykarinDenuncias);
      const porEstado: Record<string, number> = {};
      for (const d of denuncias) {
        porEstado[d.estado] = (porEstado[d.estado] || 0) + 1;
      }
      const activas = denuncias.filter((d) => d.estado !== "archivada" && d.estado !== "concluida");
      const hoy = new Date();
      const urgentes = activas.filter((d) => {
        if (!d.fechaPlazo) return false;
        const plazo = new Date(d.fechaPlazo);
        const diff = (plazo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 5 && diff >= 0;
      });

      return JSON.stringify({
        total: denuncias.length,
        activas: activas.length,
        porEstado,
        urgentes: urgentes.map((d) => ({
          codigo: d.codigo, tipo: d.tipo, estado: d.estado,
          fechaPlazo: d.fechaPlazo, diasRestantes: d.fechaPlazo ? Math.ceil((new Date(d.fechaPlazo).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)) : null,
        })),
        denuncias: activas.slice(0, 10).map((d) => ({
          codigo: d.codigo, tipo: d.tipo, estado: d.estado,
          denunciado: d.denunciado, fechaRecepcion: d.fechaRecepcion,
          prioridad: d.prioridad, investigador: d.investigador,
        })),
      });
    }

    case "diario_oficial": {
      const limite = Number(input.limite) || 5;
      const normas = await db.select().from(diarioOficialNormas)
        .orderBy(desc(diarioOficialNormas.fechaPublicacion))
        .limit(limite);
      return JSON.stringify({
        normas: normas.map((n) => ({
          titulo: n.titulo, tipo: n.tipo, organismo: n.organismo,
          fecha: n.fechaPublicacion, materia: n.materia, numero: n.numeroNorma,
        })),
        total: normas.length,
      });
    }

    default:
      return JSON.stringify({ error: `Herramienta desconocida: ${name}` });
  }
}

// ─── AGENT LOOP ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres LexTrack AI, un agente asistente legal especializado en derecho laboral chileno. Trabajas para un estudio de abogados.

REGLAS:
1. Responde siempre en español chileno formal pero cercano.
2. Cuando el usuario haga preguntas legales, USA la herramienta buscar_normativa o buscar_jurisprudencia para fundamentar tu respuesta con fuentes reales. NUNCA inventes artículos o fallos.
3. Cita siempre las fuentes: [Art. N CT], [Art. N Ley X], [Rol N° X / tribunal].
4. Si la herramienta no retorna resultados relevantes, dilo honestamente y sugiere reformular.
5. Puedes usar múltiples herramientas en una respuesta si es necesario.
6. Para tareas de gestión (causas, tareas, alertas, honorarios), usa las herramientas correspondientes.
7. Cuando el usuario pida crear algo (tarea, alerta), usa la herramienta crear_tarea.
8. Si necesitas calcular indemnización, pide los datos faltantes antes de usar la herramienta.
9. Al dar cifras de indemnización, siempre menciona que es un cálculo estimativo y que debe verificarse.
10. No generes documentos legales completos directamente; para eso existe el módulo Generador.

CAPACIDADES:
- Consulta normativa (Código del Trabajo, leyes especiales)
- Búsqueda de jurisprudencia
- Gestión de causas, tareas, alertas
- Cálculo de indemnizaciones (Art. 163 CT)
- Estado de cobranza y honorarios
- Estado de denuncias Ley Karin
- Monitoreo de Diario Oficial
- Estadísticas del estudio`;

const MAX_TOOL_ROUNDS = 5;

export const agentRouter = createRouter({
  chat: publicQuery
    .input(z.object({
      mensaje: z.string().min(1),
      sessionId: z.string().optional(),
      historial: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const { mensaje, historial } = input;

      if (!env.anthropicApiKey) {
        return fallbackKeywordAgent(mensaje);
      }

      const messages: AnthropicMessage[] = [];

      if (historial && historial.length > 0) {
        const recent = historial.slice(-10);
        for (const h of recent) {
          messages.push({ role: h.role, content: h.content });
        }
      }

      messages.push({ role: "user", content: mensaje });

      let toolsUsed: { name: string; input: Record<string, unknown>; result: string }[] = [];
      let finalText = "";

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await rawComplete({
          system: SYSTEM_PROMPT,
          messages,
          maxTokens: 4096,
          tools: agentTools,
        });

        if (response.stop_reason === "end_turn" || response.stop_reason === "max_tokens") {
          const textBlock = response.content.find((c) => c.type === "text") as { type: "text"; text: string } | undefined;
          finalText = textBlock?.text ?? "";
          break;
        }

        if (response.stop_reason === "tool_use") {
          messages.push({ role: "assistant", content: response.content });

          const toolResults: AnthropicContent[] = [];

          for (const block of response.content) {
            if (block.type === "tool_use") {
              const toolInput = block.input as Record<string, unknown>;
              let result: string;
              try {
                result = await ejecutarTool(block.name, toolInput);
              } catch (e: any) {
                result = JSON.stringify({ error: `Error ejecutando ${block.name}: ${e.message ?? "desconocido"}` });
              }
              toolsUsed.push({ name: block.name, input: toolInput, result });
              toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
            }
          }

          messages.push({ role: "user", content: toolResults });
        }
      }

      const fuentes: string[] = [];
      for (const tu of toolsUsed) {
        if (tu.name === "buscar_normativa" || tu.name === "buscar_jurisprudencia") {
          try {
            const parsed = JSON.parse(tu.result);
            if (parsed.resultados) {
              for (const r of parsed.resultados) {
                if (r.fuente) fuentes.push(r.fuente);
                else if (r.caratula && r.tribunal) fuentes.push(`${r.caratula} — ${r.tribunal}`);
              }
            }
          } catch { /* ignore */ }
        }
      }

      return {
        respuesta: finalText,
        fuentes: [...new Set(fuentes)],
        herramientasUsadas: toolsUsed.map((t) => t.name),
        tipo: "agent",
      };
    }),
});

// ─── FALLBACK (sin API key) ─────────────────────────────────────

async function fallbackKeywordAgent(mensaje: string) {
  const lower = mensaje.toLowerCase().trim();

  if (["hola", "buenas", "hey", "buenos dias", "buenas tardes"].some((k) => lower.includes(k))) {
    return {
      respuesta: "Hola! Soy **LexTrack AI**, tu agente legal asistente.\n\nPuedo ayudarte con:\n- Consultas sobre el Código del Trabajo\n- Buscar jurisprudencia\n- Gestionar causas, tareas y alertas\n- Calcular indemnizaciones\n- Estado de cobranza\n- Ley Karin\n\nEscribe tu consulta o pregunta.",
      fuentes: [],
      herramientasUsadas: [],
      tipo: "fallback",
    };
  }

  if (lower.includes("ayuda") || lower.includes("que puedes hacer")) {
    return {
      respuesta: "Soy **LexTrack AI**. Mis capacidades:\n\n**Consulta legal:**\n- \"Art. 163 Código del Trabajo\"\n- \"Despido indirecto requisitos\"\n\n**Gestión:**\n- \"Mis causas\" / \"Tareas pendientes\"\n- \"Crea tarea para revisar causa mañana\"\n\n**Cálculos:**\n- \"Calcula indemnización 5 años, sueldo 800.000\"\n\n**Reportes:**\n- \"Estadísticas\" / \"Estado cobranza\" / \"Ley Karin\"",
      fuentes: [],
      herramientasUsadas: [],
      tipo: "fallback",
    };
  }

  return {
    respuesta: "Para usar el asistente con todas sus capacidades (búsqueda semántica, análisis legal, generación de respuestas), se necesita configurar la API key de Anthropic.\n\nMientras tanto, puedes usar las otras secciones de LexTrack para gestionar causas, tareas y documentos.",
    fuentes: [],
    herramientasUsadas: [],
    tipo: "fallback",
  };
}
