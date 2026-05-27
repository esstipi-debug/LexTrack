import type { AnthropicTool } from "./types";

export const TOOL_DEFINITIONS: AnthropicTool[] = [
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
  {
    name: "consultar_pjud",
    description: "Consulta el estado de una causa en el Poder Judicial de Chile (PJUD). Busca por RIT (ej: T-123-2025) o por RUT del litigante. Usa esta herramienta cuando el usuario pida consultar, buscar o verificar una causa en el Poder Judicial.",
    input_schema: {
      type: "object",
      properties: {
        rit: { type: "string", description: "RIT de la causa (ej: T-123-2025)" },
        rut: { type: "string", description: "RUT del litigante (ej: 12.345.678-9)" },
      },
      required: [],
    },
  },
  {
    name: "sincronizar_causa",
    description: "Sincroniza una causa del estudio con los datos actuales del Poder Judicial. Detecta cambios de estado y nuevos movimientos. Usa esta herramienta cuando el usuario pida sincronizar, actualizar o verificar el estado de una causa contra el PJUD.",
    input_schema: {
      type: "object",
      properties: {
        causa_id: { type: "number", description: "ID de la causa en LexTrack a sincronizar" },
      },
      required: ["causa_id"],
    },
  },
  {
    name: "buscar_dictamen_dt",
    description: "Busca dictámenes (ordinarios) de la Dirección del Trabajo de Chile sobre interpretación de normas laborales. Usa esta herramienta cuando el usuario pregunte por dictámenes DT, criterios de la Dirección del Trabajo, ordinarios, o cómo interpreta la DT alguna materia laboral.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Tema, materia o número de ordinario a buscar (ej: 'jornada de trabajo', 'feriado proporcional', 'acoso laboral')" },
      },
      required: ["query"],
    },
  },
  {
    name: "buscar_ley_bcn",
    description: "Busca leyes, decretos y normas chilenas en LeyChile de la Biblioteca del Congreso Nacional (BCN). Usa esta herramienta cuando el usuario pida buscar una ley por número, tema o nombre (ej: 'Ley 21.643', 'Ley Karin', 'reducción jornada', 'seguro cesantía').",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Número de ley, nombre o tema de la norma a buscar" },
      },
      required: ["query"],
    },
  },
  {
    name: "buscar_fallo_suprema",
    description: "Busca fallos recientes de la Corte Suprema de Chile (jurisprudencia de la Tercera y Cuarta Sala, especialmente recursos de unificación laboral). Usa esta herramienta cuando el usuario pida buscar fallos de la Suprema, recursos de unificación, sentencias del máximo tribunal o jurisprudencia reciente de la Corte Suprema.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Tema, materia o término libre para buscar fallos" },
        materia: { type: "string", description: "Materia opcional (ej: laboral, civil, penal, previsional)" },
      },
      required: ["query"],
    },
  },
  {
    name: "generar_documento_karin",
    description: "Genera documentos Ley Karin: acta de recepción de denuncia, informe final de investigación, o notificación de medidas cautelares. Usa esta herramienta cuando el usuario pida generar documentos relacionados con denuncias de acoso laboral, sexual o violencia en el trabajo.",
    input_schema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["acta_recepcion", "informe_final", "notificacion_medidas"], description: "Tipo de documento Ley Karin" },
        denuncia_id: { type: "number", description: "ID de la denuncia Ley Karin" },
        datos_adicionales: { type: "string", description: "Datos extra en JSON (empresa, investigador, medidas, conclusiones)" },
      },
      required: ["tipo", "denuncia_id"],
    },
  },
];
