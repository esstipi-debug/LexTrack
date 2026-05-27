import { consultarCausa, buscarPorRut } from "../../pjud/client";
import type { ToolInput, AgentContext } from "../types";

export async function executeConsultarPjud(input: ToolInput, _ctx: AgentContext): Promise<string> {
  const rit = input.rit ? String(input.rit) : null;
  const rut = input.rut ? String(input.rut) : null;

  if (rut) {
    const results = await buscarPorRut(rut);
    return JSON.stringify({ tipo: "busqueda_rut", rut, resultados: results, total: results.length });
  }
  if (rit) {
    const result = await consultarCausa(rit);
    return JSON.stringify({ tipo: "consulta_rit", rit, resultado: result, encontrada: !!result });
  }
  return JSON.stringify({ error: "Debes proporcionar un RIT o RUT para consultar el PJUD" });
}
