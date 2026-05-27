import { executeBuscarNormativa, executeBuscarJurisprudencia } from "./tools/normativa";
import { executeListarCausas, executeAnalizarCausa, executeSincronizarCausa } from "./tools/causas";
import { executeListarTareas, executeCrearTarea, executePlazosVencidos } from "./tools/tareas";
import { executeListarAlertas } from "./tools/alertas";
import { executeEstadoCobranza, executeCalcularIndemnizacion, executeCalcularPlazos } from "./tools/honorarios";
import { executeEstadoLeykarin, executeGenerarDocumentoKarin } from "./tools/leykarin";
import { executeConsultarPjud } from "./tools/pjud";
import { executeEstadisticas } from "./tools/estadisticas";
import { executeGenerarDocumento } from "./tools/documentos";
import { executeDiarioOficial, executeBuscarDictamenDt, executeBuscarLeyBcn, executeBuscarFalloSuprema } from "./tools/scrapers";
import type { ToolInput, ToolResult, AgentContext } from "./types";

export async function dispatchTool(name: string, input: ToolInput, ctx: AgentContext): Promise<ToolResult> {
  switch (name) {
    case "buscar_normativa":
      return executeBuscarNormativa(input, ctx);
    case "buscar_jurisprudencia":
      return executeBuscarJurisprudencia(input, ctx);
    case "listar_causas":
      return executeListarCausas(input, ctx);
    case "analizar_causa":
      return executeAnalizarCausa(input, ctx);
    case "sincronizar_causa":
      return executeSincronizarCausa(input, ctx);
    case "listar_tareas":
      return executeListarTareas(input, ctx);
    case "crear_tarea":
      return executeCrearTarea(input, ctx);
    case "plazos_vencidos":
      return executePlazosVencidos(input, ctx);
    case "listar_alertas":
      return executeListarAlertas(input, ctx);
    case "estado_cobranza":
      return executeEstadoCobranza(input, ctx);
    case "calcular_indemnizacion":
      return executeCalcularIndemnizacion(input, ctx);
    case "calcular_plazos":
      return executeCalcularPlazos(input, ctx);
    case "estado_leykarin":
      return executeEstadoLeykarin(input, ctx);
    case "generar_documento_karin":
      return executeGenerarDocumentoKarin(input, ctx);
    case "consultar_pjud":
      return executeConsultarPjud(input, ctx);
    case "estadisticas":
      return executeEstadisticas(input, ctx);
    case "generar_documento":
      return executeGenerarDocumento(input, ctx);
    case "diario_oficial":
      return executeDiarioOficial(input, ctx);
    case "buscar_dictamen_dt":
      return executeBuscarDictamenDt(input, ctx);
    case "buscar_ley_bcn":
      return executeBuscarLeyBcn(input, ctx);
    case "buscar_fallo_suprema":
      return executeBuscarFalloSuprema(input, ctx);
    default:
      return JSON.stringify({ error: `Herramienta desconocida: ${name}` });
  }
}
