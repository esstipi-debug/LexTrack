import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { getRagPool } from "./queries/rag-pg";
import {
  causas, tareas, alertas, honorarios, jurisprudencias,
  documentosLegales, leykarinDenuncias, diarioOficialNormas,
  cronologia, notas,
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
  {
    name: "generar_documento",
    description: "Genera un documento legal (carta de despido, demanda, notificación, finiquito, recurso, etc.). Usa esta herramienta cuando el usuario pida generar, redactar o crear un documento, carta, demanda o escrito legal. Si faltan datos, pide los datos necesarios antes de llamar esta herramienta.",
    input_schema: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          enum: ["carta_aviso_despido", "demanda_indemnizacion", "finiquito", "carta_amonestacion", "recurso_nulidad", "recurso_apelacion", "carta_renuncia", "acta_comparendo"],
          description: "Tipo de documento a generar",
        },
        trabajador: { type: "string", description: "Nombre completo del trabajador" },
        rut_trabajador: { type: "string", description: "RUT del trabajador" },
        empresa: { type: "string", description: "Razón social de la empresa" },
        rut_empresa: { type: "string", description: "RUT de la empresa" },
        fecha_ingreso: { type: "string", description: "Fecha de ingreso del trabajador (YYYY-MM-DD)" },
        fecha_termino: { type: "string", description: "Fecha de término (YYYY-MM-DD)" },
        remuneracion: { type: "number", description: "Remuneración mensual en CLP" },
        anios_servicio: { type: "number", description: "Años de servicio" },
        causal: { type: "string", description: "Causal de despido o motivo legal" },
        hechos: { type: "string", description: "Descripción de los hechos relevantes" },
        representante: { type: "string", description: "Nombre del representante legal o abogado" },
        tribunal: { type: "string", description: "Tribunal competente (para demandas/recursos)" },
        rit: { type: "string", description: "RIT de la causa (para recursos)" },
        datos_adicionales: { type: "string", description: "Cualquier dato adicional relevante para el documento" },
      },
      required: ["tipo"],
    },
  },
  {
    name: "calcular_plazos",
    description: "Calcula plazos procesales laborales según el Código del Trabajo y Código de Procedimiento Civil chileno. Usa esta herramienta cuando el usuario pregunte por plazos, cuántos días tiene, cuándo vence algo, o necesite calcular un plazo judicial.",
    input_schema: {
      type: "object",
      properties: {
        tipo_plazo: {
          type: "string",
          enum: [
            "demanda_despido_injustificado",
            "demanda_despido_indirecto",
            "recurso_nulidad",
            "recurso_apelacion",
            "recurso_unificacion",
            "contestacion_demanda",
            "comparendo_conciliacion",
            "investigacion_leykarin",
            "medidas_cautelares_karin",
            "aviso_despido",
            "envio_finiquito",
            "cobro_prestaciones",
            "tutela_laboral",
            "denuncia_practica_antisindical",
            "prescripcion_derechos_laborales",
          ],
          description: "Tipo de plazo a calcular",
        },
        fecha_inicio: { type: "string", description: "Fecha desde la cual calcular el plazo (YYYY-MM-DD). Si no se proporciona, se usa hoy." },
        descripcion: { type: "string", description: "Descripción adicional del contexto (opcional)" },
      },
      required: ["tipo_plazo"],
    },
  },
  {
    name: "analizar_causa",
    description: "Analiza una causa judicial del estudio: evalúa riesgo, identifica plazos próximos, sugiere acciones, y resume el estado procesal. Usa esta herramienta cuando el usuario pida analizar, evaluar o revisar una causa específica.",
    input_schema: {
      type: "object",
      properties: {
        causa_id: { type: "number", description: "ID de la causa a analizar" },
        rit: { type: "string", description: "RIT de la causa (alternativa al ID)" },
        profundidad: { type: "string", enum: ["resumen", "completo"], description: "Nivel de detalle del análisis (default: completo)" },
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

    case "generar_documento": {
      const tipo = String(input.tipo);
      const hoy = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
      const trabajador = String(input.trabajador ?? "[NOMBRE TRABAJADOR]");
      const rutTrab = String(input.rut_trabajador ?? "[RUT]");
      const empresa = String(input.empresa ?? "[EMPRESA]");
      const rutEmp = String(input.rut_empresa ?? "[RUT EMPRESA]");
      const representante = String(input.representante ?? "[REPRESENTANTE LEGAL]");
      const remuneracion = Number(input.remuneracion) || 0;
      const anios = Number(input.anios_servicio) || 0;
      const fechaIngreso = String(input.fecha_ingreso ?? "[FECHA INGRESO]");
      const fechaTermino = String(input.fecha_termino ?? "[FECHA TÉRMINO]");
      const causal = String(input.causal ?? "");
      const hechos = String(input.hechos ?? "");
      const tribunal = String(input.tribunal ?? "[TRIBUNAL]");
      const rit = String(input.rit ?? "[RIT]");
      const datosAdicionales = String(input.datos_adicionales ?? "");

      const UF = 37200;
      const remCalc = Math.min(remuneracion, 90 * UF);
      const totalAnios = Math.min(anios, 11);
      const indemnizacion = totalAnios * remCalc;
      const avisoPrevio = remCalc;
      const fmtCLP = (n: number) => `$${n.toLocaleString("es-CL")}`;

      let documento = "";

      switch (tipo) {
        case "carta_aviso_despido":
          documento = `# CARTA DE AVISO DE TÉRMINO DE CONTRATO DE TRABAJO

**Fecha:** ${hoy}

**Señor(a):** ${trabajador}
**RUT:** ${rutTrab}
**Presente**

**De:** ${empresa} (RUT: ${rutEmp})

**REF:** Comunicación de término de relación laboral conforme al Art. 162 del Código del Trabajo.

---

Por medio de la presente, y de conformidad con lo dispuesto en los artículos 159, 160 y/o 161 del Código del Trabajo, se comunica a usted que su contrato de trabajo terminará con fecha **${fechaTermino}**.

## CAUSAL INVOCADA

${causal || "Necesidades de la empresa, Art. 161 inciso 1° del Código del Trabajo."}

## HECHOS QUE FUNDAMENTAN LA CAUSAL

${hechos || "[Describir circunstancias fácticas que configuran la causal invocada]"}

## INDEMNIZACIONES OFRECIDAS

| Concepto | Monto |
|----------|-------|
| Indemnización por años de servicio (Art. 163 CT) | ${remuneracion ? fmtCLP(indemnizacion) : "[CALCULAR]"} |
| Indemnización sustitutiva del aviso previo (Art. 161 inc. 2° CT) | ${remuneracion ? fmtCLP(avisoPrevio) : "[CALCULAR]"} |
| Feriado proporcional (Art. 73 CT) | [CALCULAR según días pendientes] |
| Remuneraciones adeudadas | [Si aplica] |
| **TOTAL ESTIMADO** | ${remuneracion ? fmtCLP(indemnizacion + avisoPrevio) : "[CALCULAR]"} |

## DATOS DEL CONTRATO

- Fecha de ingreso: ${fechaIngreso}
- Fecha de término: ${fechaTermino}
- Antigüedad: ${anios ? `${anios} años` : "[CALCULAR]"}
- Última remuneración: ${remuneracion ? fmtCLP(remuneracion) : "[MONTO]"}

## INFORMACIÓN AL TRABAJADOR

Se le informa que tiene derecho a:
1. **Firmar bajo protesta** conforme al Art. 169 letra a) del CT, reservándose el derecho a reclamar judicialmente.
2. **Reclamar judicialmente** dentro del plazo de **60 días hábiles** desde la separación (Art. 168 CT).
3. **Cobrar el seguro de cesantía** si corresponde (Ley 19.728).

---

**${representante}**
Representante Legal — ${empresa}

cc: Inspección del Trabajo competente (Art. 162 inc. 6° CT)
${datosAdicionales ? `\nNota: ${datosAdicionales}` : ""}

---
*Documento generado por LexTrack. Sujeto a revisión profesional.*`;
          break;

        case "demanda_indemnizacion":
          documento = `# DEMANDA DE INDEMNIZACIÓN POR DESPIDO INJUSTIFICADO, INDEBIDO O IMPROCEDENTE

**Tribunal:** ${tribunal}
**RIT:** ${rit}
**Materia:** Despido injustificado — Cobro de prestaciones laborales

---

## EN LO PRINCIPAL: Demanda de despido injustificado y cobro de indemnizaciones.
## PRIMER OTROSÍ: Acompaña documentos.
## SEGUNDO OTROSÍ: Patrocinio y poder.

---

**S.J.L. DEL TRABAJO**

**${trabajador}**, RUT ${rutTrab}, trabajador, domiciliado en [DOMICILIO], a US. respetuosamente digo:

## I. PARTES

**Demandante:** ${trabajador}, RUT ${rutTrab}
**Demandado:** ${empresa}, RUT ${rutEmp}, representada legalmente por ${representante}, domiciliada en [DOMICILIO EMPRESA]

## II. RELACIÓN LABORAL

El demandante prestó servicios para la demandada desde el **${fechaIngreso}** hasta el **${fechaTermino}**, desempeñándose como [CARGO]. Su última remuneración mensual ascendía a ${remuneracion ? fmtCLP(remuneracion) : "[MONTO]"}.

## III. HECHOS

${hechos || `1. Con fecha ${fechaTermino}, la demandada procedió a poner término a la relación laboral invocando la causal del Art. 161 del Código del Trabajo.
2. La causal invocada carece de fundamento fáctico suficiente, toda vez que [DESCRIBIR POR QUÉ NO SE CONFIGURA LA CAUSAL].
3. En subsidio, la demandada no cumplió con las formalidades del Art. 162 del CT [si aplica].`}

## IV. DERECHO

1. **Art. 168 CT**: El trabajador cuyo contrato termine por aplicación injustificada de las causales de los Arts. 159, 160 o 161 CT tiene derecho a las indemnizaciones establecidas en los Arts. 162 a 163 CT, con los incrementos del Art. 168.
2. **Art. 163 CT**: Indemnización por años de servicio equivalente a 30 días de última remuneración por cada año y fracción superior a 6 meses, con tope de 11 años (330 días).
3. **Art. 172 CT**: Para los efectos del cálculo, la última remuneración comprende toda cantidad que estuviere percibiendo el trabajador.
4. **Art. 168 inc. 3° CT**: Las indemnizaciones se incrementarán en un 30% si se declara injustificado (Art. 161), 50% si se declara injustificado (Art. 159/160), u 80% si no se invocó causal o no se cumplieron formalidades.

## V. PRESTACIONES DEMANDADAS

| Concepto | Base de cálculo | Monto |
|----------|----------------|-------|
| Indemnización por años de servicio (${anios} años) | ${remuneracion ? fmtCLP(remCalc) : "[MONTO]"} × ${totalAnios} | ${remuneracion ? fmtCLP(indemnizacion) : "[CALCULAR]"} |
| Indemnización sustitutiva aviso previo | ${remuneracion ? fmtCLP(remCalc) : "[MONTO]"} | ${remuneracion ? fmtCLP(avisoPrevio) : "[CALCULAR]"} |
| Recargo 30% Art. 168 (si Art. 161) | — | ${remuneracion ? fmtCLP(Math.round(indemnizacion * 0.3)) : "[CALCULAR]"} |
| Feriado proporcional | — | [CALCULAR] |
| Remuneraciones adeudadas | — | [Si aplica] |
| Cotizaciones previsionales impagas | — | [Si aplica, Art. 162 inc. 5°] |
| **TOTAL** | | ${remuneracion ? fmtCLP(Math.round(indemnizacion + avisoPrevio + indemnizacion * 0.3)) : "[CALCULAR]"} |

## VI. PETITORIO

**POR TANTO**, en mérito de lo expuesto, normas legales citadas y demás pertinentes:

**RUEGO A US.:** tener por interpuesta demanda de despido injustificado en contra de **${empresa}**, representada por **${representante}**, y en definitiva declarar:

1. Que el despido ha sido **injustificado** (o indebido/improcedente).
2. Condenar a la demandada al pago de las indemnizaciones señaladas en el punto V, con los recargos del Art. 168 CT.
3. Condenar al pago de las cotizaciones previsionales adeudadas, si las hubiere.
4. Condenar al pago de intereses y reajustes conforme al Art. 63 CT.
5. Condenar en costas.

---

**PRIMER OTROSÍ:** Acompaño los siguientes documentos:
1. Contrato de trabajo
2. Liquidaciones de sueldo (últimos 3 meses)
3. Carta de despido
4. [Otros documentos relevantes]

**SEGUNDO OTROSÍ:** Designo abogado patrocinante y confiero poder a don/doña [ABOGADO], RUT [RUT ABOGADO].

${datosAdicionales ? `\n---\nAntecedentes adicionales: ${datosAdicionales}` : ""}

---
*Documento generado por LexTrack. REQUIERE revisión profesional antes de presentación.*`;
          break;

        case "finiquito":
          documento = `# FINIQUITO DE TRABAJO

**Fecha:** ${hoy}

---

En Santiago de Chile, a ${hoy}, entre **${empresa}**, RUT ${rutEmp}, representada por **${representante}**, en adelante "el Empleador", y **${trabajador}**, RUT ${rutTrab}, en adelante "el Trabajador", se celebra el siguiente finiquito:

## PRIMERO: ANTECEDENTES

El Trabajador prestó servicios para el Empleador desde el **${fechaIngreso}** hasta el **${fechaTermino}**, en calidad de [CARGO].

## SEGUNDO: CAUSAL DE TÉRMINO

El contrato de trabajo terminó por la causal del **${causal || "Art. 161 inc. 1° del Código del Trabajo (necesidades de la empresa)"}**.

## TERCERO: PRESTACIONES

El Empleador paga al Trabajador las siguientes sumas:

| Concepto | Monto |
|----------|-------|
| Remuneración proporcional (días trabajados mes actual) | [CALCULAR] |
| Indemnización por años de servicio (Art. 163 CT) | ${remuneracion ? fmtCLP(indemnizacion) : "[CALCULAR]"} |
| Indemnización sustitutiva aviso previo (Art. 161 CT) | ${remuneracion ? fmtCLP(avisoPrevio) : "[CALCULAR]"} |
| Feriado legal proporcional (Art. 73 CT) | [CALCULAR] |
| Gratificación proporcional (Art. 47 CT) | [Si aplica] |
| Otros: [detallar] | [MONTO] |
| **TOTAL BRUTO** | ${remuneracion ? fmtCLP(indemnizacion + avisoPrevio) + " + otros" : "[CALCULAR]"} |
| Descuentos legales (impuestos, cotizaciones) | [CALCULAR] |
| **TOTAL LÍQUIDO** | [CALCULAR] |

## CUARTO: DECLARACIONES

El Trabajador declara que con el pago de las sumas indicadas, el Empleador ha cumplido íntegramente con todas sus obligaciones laborales, previsionales y de seguridad social, declarándose total y completamente pagado de todo concepto.

## QUINTO: RESERVA DE DERECHOS

${datosAdicionales?.includes("protesta") ? "El Trabajador firma el presente finiquito haciendo expresa reserva de sus derechos conforme al Art. 169 letra a) del Código del Trabajo." : "El Trabajador no formula reserva alguna respecto de las prestaciones recibidas."}

## SEXTO: RATIFICACIÓN

El presente finiquito se ratificará ante la Inspección del Trabajo / Notario Público / Presidente del Sindicato, conforme al Art. 177 del Código del Trabajo.

---

| | |
|---|---|
| **EL EMPLEADOR** | **EL TRABAJADOR** |
| ${representante} | ${trabajador} |
| RUT: ${rutEmp} | RUT: ${rutTrab} |
| | |
| _________________________ | _________________________ |
| Firma | Firma |

**MINISTRO DE FE:**

_________________________
[Nombre y cargo del ministro de fe]

---
*Documento generado por LexTrack. REQUIERE ratificación conforme al Art. 177 CT.*`;
          break;

        case "carta_amonestacion":
          documento = `# CARTA DE AMONESTACIÓN

**Fecha:** ${hoy}

**Señor(a):** ${trabajador}
**RUT:** ${rutTrab}
**Cargo:** [CARGO]
**Presente**

**De:** ${empresa} (RUT: ${rutEmp})

---

Por medio de la presente se le comunica que, conforme al Reglamento Interno de Orden, Higiene y Seguridad de la empresa, se ha resuelto aplicar a usted una **amonestación ${causal?.includes("grave") ? "grave" : "escrita"}** por los siguientes hechos:

## HECHOS

${hechos || "[Describir conducta específica, fecha, hora, lugar y circunstancias]"}

## NORMA INFRINGIDA

${causal || "[Indicar artículo del Reglamento Interno, obligación contractual o norma legal infringida]"}

## ADVERTENCIA

Se le informa que de reiterarse esta conducta, la empresa podrá aplicar sanciones más graves, incluyendo el término de la relación laboral conforme a las causales del Art. 160 del Código del Trabajo.

Usted tiene derecho a responder por escrito a la presente comunicación dentro de [PLAZO según Reglamento Interno].

---

**${representante}**
Representante Legal — ${empresa}

**Recepción del trabajador:**

Nombre: ${trabajador}
Fecha: ___/___/______
Firma: _________________________

cc: Carpeta personal del trabajador
${datosAdicionales ? `\nObservaciones: ${datosAdicionales}` : ""}

---
*Documento generado por LexTrack. Sujeto a revisión profesional.*`;
          break;

        case "recurso_nulidad":
          documento = `# RECURSO DE NULIDAD LABORAL

**Tribunal:** Ilustrísima Corte de Apelaciones de [CIUDAD]
**Ingreso Corte:** [POR ASIGNAR]
**RIT origen:** ${rit}
**Tribunal origen:** ${tribunal}

---

## EN LO PRINCIPAL: Deduce recurso de nulidad.
## OTROSÍ: Patrocinio y poder.

---

**ILUSTRÍSIMA CORTE DE APELACIONES**

**${trabajador}**, RUT ${rutTrab}, representado por su abogado **${representante}**, en los autos RIT ${rit} del ${tribunal}, a US. Ilustrísima respetuosamente digo:

Que, dentro del plazo legal de **10 días hábiles** contados desde la notificación de la sentencia definitiva (Art. 479 CT), vengo en deducir **recurso de nulidad** en contra de la sentencia de fecha [FECHA SENTENCIA], por las siguientes causales:

## I. CAUSAL INVOCADA

${causal || `**Art. 477 del Código del Trabajo** — La sentencia ha sido dictada con infracción de ley que ha influido sustancialmente en lo dispositivo del fallo.

**Norma infringida:** [Indicar artículo específico]

**En subsidio, Art. 478 letra [X] CT:** [Causal subsidiaria si aplica]`}

## II. HECHOS

${hechos || "[Describir los hechos establecidos en la sentencia que se impugnan y la forma en que se configura la causal de nulidad]"}

## III. INFLUENCIA EN LO DISPOSITIVO

[Explicar cómo la infracción de ley influyó sustancialmente en la parte resolutiva de la sentencia]

## IV. PETITORIO

**POR TANTO**, de conformidad con los Arts. 477, 478 y 479 del Código del Trabajo:

**RUEGO A US. ILUSTRÍSIMA:**
1. Tener por deducido recurso de nulidad en contra de la sentencia de fecha [FECHA].
2. Declarar la nulidad de la sentencia recurrida.
3. Dictar sentencia de reemplazo que [INDICAR LO SOLICITADO], o en subsidio, determinar el estado en que ha de quedar el proceso y ordenar la remisión del mismo al tribunal no inhabilitado que corresponda.

---

${datosAdicionales ? `Antecedentes adicionales: ${datosAdicionales}\n\n---` : ""}
*Documento generado por LexTrack. REQUIERE revisión profesional obligatoria antes de presentación. Plazo fatal: 10 días hábiles desde notificación (Art. 479 CT).*`;
          break;

        case "recurso_apelacion":
          documento = `# RECURSO DE APELACIÓN

**RIT:** ${rit}
**Tribunal:** ${tribunal}

---

**S.J.L. DEL TRABAJO**

En los autos RIT **${rit}**, **${trabajador}** (RUT ${rutTrab}), representado por **${representante}**, a US. respetuosamente digo:

Que, dentro del plazo legal de **5 días hábiles** (Art. 476 CT), vengo en apelar de la resolución de fecha [FECHA RESOLUCIÓN], por causar agravio a mi representado.

## AGRAVIO

${hechos || "[Explicar el agravio causado por la resolución apelada y los fundamentos de la apelación]"}

## PETICIONES CONCRETAS

${causal || "Se solicita revocar la resolución apelada y en su lugar [INDICAR LO SOLICITADO]."}

**POR TANTO**, ruego a US. tener por interpuesto recurso de apelación, concederlo y elevar los antecedentes al tribunal superior.

---
*Nota: En materia laboral, la apelación procede solo contra resoluciones expresamente señaladas en el Art. 476 CT (sentencias interlocutorias que pongan término al juicio o hagan imposible su continuación, y las que se pronuncien sobre medidas cautelares).*

${datosAdicionales ? `\nAntecedentes: ${datosAdicionales}` : ""}

---
*Documento generado por LexTrack. REQUIERE revisión profesional.*`;
          break;

        case "carta_renuncia":
          documento = `# CARTA DE RENUNCIA VOLUNTARIA

**Fecha:** ${hoy}

**Señor(a):** ${representante || "[REPRESENTANTE EMPRESA]"}
**${empresa}**
**Presente**

---

De mi consideración:

Por medio de la presente, yo **${trabajador}**, RUT ${rutTrab}, comunico a usted mi renuncia voluntaria al cargo que desempeño en ${empresa}, con efectividad a contar del **${fechaTermino || "[FECHA]"}**.

${hechos ? `Motivo: ${hechos}` : ""}

Solicito se sirva proceder con el finiquito correspondiente conforme al Art. 177 del Código del Trabajo, dentro del plazo de 10 días hábiles contados desde la separación efectiva.

Agradezco la oportunidad laboral brindada durante ${anios ? `${anios} años` : "el tiempo"} de servicio.

---

**${trabajador}**
RUT: ${rutTrab}

Firma: _________________________

---

**Recepción del empleador:**
Nombre: _________________________
Fecha: ___/___/______
Firma: _________________________

---
*Documento generado por LexTrack.*`;
          break;

        case "acta_comparendo":
          documento = `# ACTA DE COMPARENDO DE CONCILIACIÓN

**RIT:** ${rit}
**Tribunal:** ${tribunal}
**Fecha:** ${hoy}

---

En ${tribunal}, siendo las [HORA] horas del día ${hoy}, se lleva a efecto la audiencia de conciliación en los autos RIT ${rit}, compareciendo:

**Demandante:** ${trabajador}, RUT ${rutTrab}, representado por [ABOGADO DEMANDANTE].
**Demandado:** ${empresa}, RUT ${rutEmp}, representado por ${representante}.

---

## PROPOSICIÓN DE BASES DE CONCILIACIÓN

El tribunal propone las siguientes bases de arreglo:

${hechos || "[Describir las bases de conciliación propuestas]"}

## RESULTADO

${causal || "[ ] Las partes ACEPTAN las bases propuestas.\n[ ] Las partes NO logran acuerdo. Se cita a audiencia de juicio."}

## ACUERDO (si aplica)

${datosAdicionales || "[Describir los términos del acuerdo alcanzado, montos, plazos de pago, etc.]"}

---

Firma demandante: _________________________
Firma demandado: _________________________
Firma juez: _________________________

---
*Documento generado por LexTrack. Formato referencial.*`;
          break;

        default:
          documento = `Tipo de documento "${tipo}" no reconocido. Tipos disponibles: carta_aviso_despido, demanda_indemnizacion, finiquito, carta_amonestacion, recurso_nulidad, recurso_apelacion, carta_renuncia, acta_comparendo.`;
      }

      return JSON.stringify({
        tipo,
        documento,
        advertencia: "Este documento es un borrador generado automáticamente. REQUIERE revisión y ajuste por un abogado antes de su uso. No constituye asesoría legal.",
        datosUsados: { trabajador, empresa, remuneracion, anios, causal: causal || null },
      });
    }

    case "calcular_plazos": {
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

    case "analizar_causa": {
      const causaId = input.causa_id ? Number(input.causa_id) : null;
      const ritBuscar = input.rit ? String(input.rit) : null;

      let causa: typeof causas.$inferSelect | null = null;

      if (causaId) {
        const r = await db.select().from(causas).where(eq(causas.id, causaId)).limit(1);
        causa = r[0] || null;
      } else if (ritBuscar) {
        const r = await db.select().from(causas).where(sql`${causas.rit} LIKE ${`%${ritBuscar}%`}`).limit(1);
        causa = r[0] || null;
      }

      if (!causa) {
        const recientes = await db.select().from(causas).orderBy(desc(causas.createdAt)).limit(5);
        return JSON.stringify({
          error: "No se encontró la causa especificada",
          sugerencia: "Indica el ID o RIT de la causa",
          causasDisponibles: recientes.map((c) => ({ id: c.id, rit: c.rit, caratula: c.caratula })),
        });
      }

      const [tareasRelacionadas, alertasRelacionadas, historialCrono, notasCausa] = await Promise.all([
        db.select().from(tareas).where(eq(tareas.causaId, causa.id)),
        db.select().from(alertas).where(eq(alertas.causaId, causa.id)),
        db.select().from(cronologia).where(eq(cronologia.causaId, causa.id)).orderBy(desc(cronologia.fecha)).limit(10),
        db.select().from(notas).where(eq(notas.causaId, causa.id)).orderBy(desc(notas.createdAt)).limit(5),
      ]);

      const hoy = new Date();
      const tareasPendientes = tareasRelacionadas.filter((t) => t.estado === "pendiente" || t.estado === "en_progreso");
      const tareasVencidas = tareasPendientes.filter((t) => t.fechaVencimiento && new Date(t.fechaVencimiento) < hoy);
      const alertasPendientes = alertasRelacionadas.filter((a) => a.estado === "pendiente");

      let nivelRiesgo: "bajo" | "medio" | "alto" | "critico" = "bajo";
      const factoresRiesgo: string[] = [];

      if (tareasVencidas.length > 0) {
        nivelRiesgo = "alto";
        factoresRiesgo.push(`${tareasVencidas.length} tarea(s) con plazo vencido`);
      }
      if (alertasPendientes.length > 3) {
        nivelRiesgo = nivelRiesgo === "alto" ? "critico" : "alto";
        factoresRiesgo.push(`${alertasPendientes.length} alertas pendientes sin atender`);
      }
      if (causa.estado === "prueba" || causa.estado === "sentencia") {
        if (nivelRiesgo === "bajo") nivelRiesgo = "medio";
        factoresRiesgo.push(`Causa en etapa ${causa.estado} — requiere atención activa`);
      }
      if (!causa.fechaUltimoMovimiento) {
        factoresRiesgo.push("Sin fecha de último movimiento registrada");
      } else {
        const diasSinMov = Math.ceil((hoy.getTime() - new Date(causa.fechaUltimoMovimiento).getTime()) / (1000 * 60 * 60 * 24));
        if (diasSinMov > 30) {
          if (nivelRiesgo === "bajo") nivelRiesgo = "medio";
          factoresRiesgo.push(`${diasSinMov} días sin movimiento — posible abandono de procedimiento`);
        }
      }
      if (tareasPendientes.length === 0 && causa.estado !== "concluida" && causa.estado !== "archivada") {
        factoresRiesgo.push("No hay tareas pendientes asociadas a una causa activa — posible falta de seguimiento");
      }

      return JSON.stringify({
        causa: {
          id: causa.id,
          rit: causa.rit,
          ruc: causa.ruc,
          caratula: causa.caratula,
          tribunal: causa.tribunal,
          estado: causa.estado,
          etapa: causa.etapa,
          materia: causa.materia,
          fechaIngreso: causa.fechaIngreso,
          fechaUltimoMovimiento: causa.fechaUltimoMovimiento,
        },
        analisis: {
          nivelRiesgo,
          factoresRiesgo,
          tareasPendientes: tareasPendientes.length,
          tareasVencidas: tareasVencidas.length,
          alertasPendientes: alertasPendientes.length,
        },
        tareas: tareasPendientes.map((t) => ({
          id: t.id, titulo: t.titulo, vencimiento: t.fechaVencimiento,
          prioridad: t.prioridad, vencida: t.fechaVencimiento ? new Date(t.fechaVencimiento) < hoy : false,
        })),
        ultimoMovimiento: historialCrono.slice(0, 5).map((c) => ({
          fecha: c.fecha, tipo: c.tipo, titulo: c.titulo, descripcion: c.descripcion?.slice(0, 200),
        })),
        notas: notasCausa.map((n) => ({
          tipo: n.tipo, contenido: n.contenido.slice(0, 300), fecha: n.createdAt,
        })),
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
10. Cuando el usuario pida generar un documento (carta, demanda, finiquito, recurso), usa generar_documento. Siempre advierte que requiere revisión profesional.
11. Para preguntas sobre plazos o vencimientos, usa calcular_plazos. Siempre advierte sobre feriados no considerados en el cálculo.
12. Para analizar una causa específica, usa analizar_causa. Combina con buscar_normativa si necesitas fundamentar recomendaciones.

CAPACIDADES:
- Consulta normativa (Código del Trabajo, leyes especiales)
- Búsqueda de jurisprudencia
- Gestión de causas, tareas, alertas
- Cálculo de indemnizaciones (Art. 163 CT)
- Generación de documentos legales (cartas, demandas, finiquitos, recursos)
- Cálculo de plazos procesales (15 tipos de plazos laborales)
- Análisis de riesgo por causa (tareas vencidas, alertas, inactividad)
- Estado de cobranza y honorarios
- Estado de denuncias Ley Karin
- Monitoreo de Diario Oficial
- Estadísticas del estudio`;

const MAX_TOOL_ROUNDS = 5;

export const agentRouter = createRouter({
  chat: authedQuery
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
