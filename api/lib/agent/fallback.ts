export interface FallbackResult {
  respuesta: string;
  fuentes: string[];
  herramientasUsadas: string[];
  tipo: "fallback";
}

export async function keywordFallback(mensaje: string): Promise<FallbackResult> {
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
