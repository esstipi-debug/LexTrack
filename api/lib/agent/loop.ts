import { rawComplete, type AnthropicTool, type AnthropicMessage, type AnthropicContent } from "../anthropic";
import { dispatchTool } from "./executor";
import type { AgentContext } from "./types";

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

export interface AgentLoopResult {
  respuesta: string;
  fuentes: string[];
  herramientasUsadas: string[];
  tipo: "agent";
}

export async function runAgentLoop(
  messages: AnthropicMessage[],
  tools: AnthropicTool[],
  ctx: AgentContext,
): Promise<AgentLoopResult> {
  let toolsUsed: { name: string; input: Record<string, unknown>; result: string }[] = [];
  let finalText = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await rawComplete({
      system: SYSTEM_PROMPT,
      messages,
      maxTokens: 4096,
      tools,
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
          let isError = false;
          try {
            result = await dispatchTool(block.name, toolInput, ctx);
            // dispatchTool returns {error: ...} JSON for unknown tool names; mark as error.
            try {
              const parsed = JSON.parse(result);
              if (parsed && typeof parsed === "object" && "error" in parsed && Object.keys(parsed).length <= 2) {
                isError = true;
              }
            } catch { /* not JSON, ignore */ }
          } catch (e: any) {
            result = JSON.stringify({ error: `Error ejecutando ${block.name}: ${e.message ?? "desconocido"}` });
            isError = true;
          }
          toolsUsed.push({ name: block.name, input: toolInput, result });
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result, is_error: isError });
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
}
