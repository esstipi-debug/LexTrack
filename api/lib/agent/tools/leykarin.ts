import { getDb } from "../../../queries/connection";
import { leykarinDenuncias, leykarinActuaciones } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { generarActaRecepcion, generarInformeFinal, generarNotificacionMedidas } from "../../karin/documentos";
import type { ToolInput, AgentContext } from "../types";

export async function executeEstadoLeykarin(_input: ToolInput, ctx: AgentContext): Promise<string> {
  const db = getDb();
  const { userId } = ctx;
  const denuncias = await db.select().from(leykarinDenuncias).where(eq(leykarinDenuncias.userId, userId));
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

export async function executeGenerarDocumentoKarin(input: ToolInput, ctx: AgentContext): Promise<string> {
  const db = getDb();
  const { userId } = ctx;
  const tipo = String(input.tipo);
  const denunciaId = Number(input.denuncia_id);
  const datosStr = input.datos_adicionales ? String(input.datos_adicionales) : "{}";
  let datos: Record<string, any> = {};
  try { datos = JSON.parse(datosStr); } catch { /* ignore */ }

  const [denuncia] = await db.select().from(leykarinDenuncias).where(and(eq(leykarinDenuncias.id, denunciaId), eq(leykarinDenuncias.userId, userId)));
  if (!denuncia) return JSON.stringify({ error: `Denuncia ID ${denunciaId} no encontrada` });

  const actuacionesRows = await db.select().from(leykarinActuaciones).where(and(eq(leykarinActuaciones.denunciaId, denunciaId), eq(leykarinActuaciones.userId, userId)));

  let documento = "";
  const hoyStr = new Date().toISOString().split("T")[0];
  switch (tipo) {
    case "acta_recepcion":
      documento = generarActaRecepcion({
        folio: denuncia.codigo,
        fecha: String(denuncia.fechaRecepcion),
        hora: datos.hora || "09:00",
        empresa: datos.empresa || "Empresa",
        denuncianteNombre: denuncia.denunciante || "Anónimo",
        denuncianteRut: denuncia.rutDenunciante || "",
        denuncianteCargo: denuncia.cargoDenunciante || "",
        denunciadoNombre: denuncia.denunciado,
        denunciadoCargo: denuncia.cargoDenunciado || "",
        tipo: denuncia.tipo as any,
        descripcionHechos: denuncia.descripcionHechos,
        testigos: denuncia.testigos || undefined,
        canalDenuncia: denuncia.modo,
        receptor: datos.receptor || "Encargado/a de denuncias",
        receptorCargo: datos.receptorCargo || "Encargado/a de prevención",
      });
      break;
    case "informe_final":
      documento = generarInformeFinal({
        folio: denuncia.codigo,
        empresa: datos.empresa || "Empresa",
        fecha: hoyStr,
        investigador: datos.investigador || denuncia.investigador || "Investigador designado",
        investigadorCargo: datos.investigadorCargo || "Encargado/a de investigación",
        denuncianteNombre: denuncia.denunciante || "Anónimo",
        denunciadoNombre: denuncia.denunciado,
        tipo: denuncia.tipo as any,
        fechaRecepcion: String(denuncia.fechaRecepcion),
        fechaInicioInvestigacion: String(denuncia.fechaInicioInvestigacion || denuncia.fechaRecepcion),
        fechaCierre: datos.fechaCierre || hoyStr,
        descripcionHechos: denuncia.descripcionHechos,
        actuaciones: actuacionesRows.map(a => ({ fecha: String(a.fecha), tipo: a.tipo, descripcion: a.descripcion })),
        hechosAcreditados: datos.hechosAcreditados || "Por determinar",
        calificacionJuridica: datos.calificacionJuridica || "Por determinar",
        conclusion: datos.conclusion || "acreditado",
        medidasPropuestas: datos.medidasPropuestas || [],
      } as any);
      break;
    case "notificacion_medidas":
      documento = generarNotificacionMedidas({
        folio: denuncia.codigo,
        fecha: hoyStr,
        empresa: datos.empresa || "Empresa",
        representanteLegal: datos.representante || "Representante Legal",
        denuncianteNombre: denuncia.denunciante || "Trabajador/a",
        medidas: datos.medidas || [{ tipo: "separacion_espacial", descripcion: "Separación de espacios físicos" }],
      } as any);
      break;
    default:
      return JSON.stringify({ error: `Tipo de documento Karin no reconocido: ${tipo}` });
  }
  return JSON.stringify({ tipo, documento, denunciaId, advertencia: "Documento generado automáticamente. Requiere revisión profesional." });
}
