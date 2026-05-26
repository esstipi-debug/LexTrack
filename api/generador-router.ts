import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { documentosLegales } from "@db/schema";
import { sql } from "drizzle-orm";

function scoreDocument(query: string, doc: { titulo: string; contenido: string; etiquetas: string | null }): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (queryWords.length === 0) return 0;
  let score = 0;
  for (const word of queryWords) {
    if (doc.titulo.toLowerCase().includes(word)) score += 10;
    const contentMatches = (doc.contenido.toLowerCase().match(new RegExp(word, "g")) || []).length;
    score += contentMatches * 2;
    if (doc.etiquetas?.toLowerCase().includes(word)) score += 5;
  }
  return score;
}

async function recuperarContexto(tema: string): Promise<string[]> {
  const db = getDb();
  const docs = await db.select().from(documentosLegales).where(sql`${documentosLegales.estaActiva} = 1`);
  const scored = docs
    .map(d => ({ ...d, score: scoreDocument(tema, d) }))
    .filter(d => d.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return scored.map(d => `[${d.norma} - ${d.articulo || d.titulo}]: ${d.contenido.substring(0, 400)}`);
}

export const generadorRouter = createRouter({
  templates: publicQuery.query(() => {
    return [
      { id: "carta_aviso_despido", nombre: "Carta de Aviso de Despido", descripcion: "Carta de notificación de término con indemnizaciones detalladas", icono: "mail", articulos: ["Art. 161 CT", "Art. 162 CT", "Art. 168 CT"] },
      { id: "notificacion_cliente", nombre: "Notificación a Cliente", descripcion: "Email automático sobre cambios en causa judicial", icono: "bell", articulos: [] },
      { id: "demanda_indemnizacion", nombre: "Demanda de Indemnización", descripcion: "Borrador de demanda laboral con cálculos automáticos", icono: "file-text", articulos: ["Art. 163 CT", "Art. 164 CT", "Art. 488 CT"] },
      { id: "recordatorio_plazo", nombre: "Recordatorio de Plazo", descripcion: "Alerta con checklist de acciones requeridas", icono: "clock", articulos: [] },
    ];
  }),

  generar: publicQuery
    .input(z.object({
      templateId: z.string(),
      datos: z.record(z.string(), z.any()),
      causaId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { datos } = input;
      const ctx = await recuperarContexto(input.templateId);

      switch (input.templateId) {
        case "carta_aviso_despido":
          return {
            titulo: "CARTA DE AVISO DE DESPIDO",
            contenido: `CARTA DE AVISO DE TERMINO DE CONTRATO DE TRABAJO

Santiago, ${datos.fecha || new Date().toLocaleDateString("es-CL")}

Senor(a) ${datos.trabajador || "[NOMBRE TRABAJADOR]"}
RUT: ${datos.rut_trabajador || "[RUT]"}
Presente

De: ${datos.empresa || "[NOMBRE EMPRESA]"}
RUT: ${datos.rut_empresa || "[RUT EMPRESA]"}

Ref.: Carta de aviso de termino de relacion laboral

Por medio de la presente, y de conformidad con lo dispuesto en el Art. 161 del Codigo del Trabajo, se comunica a usted que su contrato de trabajo terminara el dia ${datos.fecha_termino || "[FECHA]"}.

CAUSAL INVOCADA:
${datos.causal || "Necesidades de la empresa (Art. 159 inc. 6° Codigo del Trabajo)."}

INDEMNIZACIONES:
- Indemnizacion por anos de servicio (Art. 163 CT): $${datos.indemnizacion || "[CALCULAR]"}
- Indemnizacion sustitutiva del aviso previo (Art. 161 CT): $${datos.aviso_previo || "[CALCULAR]"}
- Proporcional de vacaciones (Art. 72 CT): $${datos.vacaciones || "[CALCULAR]"}
- Proporcional de feriado legal (Art. 73 CT): $${datos.feriado || "[CALCULAR]"}

Usted tiene derecho a firmar bajo protesta (Art. 168 CT).

Atentamente,

_________________________
${datos.representante || "[NOMBRE REPRESENTANTE]"}
Representante Legal

cc: Inspeccion del Trabajo
     Sindicato (si existe)`,
            contexto: ctx,
          };

        case "demanda_indemnizacion":
          return {
            titulo: "DEMANDA DE INDEMNIZACION POR DESPIDO INJUSTIFICADO",
            contenido: `DEMANDA DE INDEMNIZACION POR DESPIDO INJUSTIFICADO

RIT: ${datos.rit || "[POR ASIGNAR]"}

EN LO PRINCIPAL: Se solicita indemnizacion por despido injustificado.

I. IDENTIFICACION DE LAS PARTES

Demandante: ${datos.demandante || "[NOMBRE]"}
RUT: ${datos.rut_demandante || ""}
Abogado patrocinante: ${datos.abogado || ""}

Demandado: ${datos.empresa || "[NOMBRE EMPRESA]"}
RUT: ${datos.rut_empresa || ""}

II. HECHOS

1. El demandante presto servicios desde ${datos.fecha_ingreso || "[FECHA]"} hasta ${datos.fecha_despido || "[FECHA]"}.
2. Su remuneracion mensual era de $${datos.remuneracion?.toLocaleString("es-CL") || "[MONTO]"}.
3. El demandado puso termino al contrato invocando necesidades de la empresa.
4. La causal invocada no se acredita (presuncion Art. 164 CT).

III. CÁLCULO DE INDEMNIZACION

- Anos de servicio: ${datos.anios || "[X]"}
- Remuneracion: $${datos.remuneracion?.toLocaleString("es-CL") || "[MONTO]"} (tope: 90 UF)
- Dias indemnizacion: ${Math.min((datos.anios || 0) * 30, 330)} dias
- Monto: $${Math.round((Math.min((datos.anios || 0) * 30, 330) / 30) * Math.min(datos.remuneracion || 0, 90 * 37200)).toLocaleString("es-CL")}

POR TANTO: RUEGO A U.S. acceder a lo solicitado.

${datos.abogado || "[ABOGADO]"}
Abogado patrocinante`,
            contexto: ctx,
          };

        default:
          return { titulo: "Documento", contenido: "Template no implementado", contexto: [] };
      }
    }),

  calcularIndemnizacion: publicQuery
    .input(z.object({
      anios: z.number(),
      meses: z.number().optional(),
      sueldo: z.number(),
      avisoPrevio: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      const UF_VALUE = 37200;
      const TOPE_REM = 90 * UF_VALUE;
      const TOPE_DIAS = 330;

      const remCalc = Math.min(input.sueldo, TOPE_REM);
      const totalAnios = input.anios + ((input.meses || 0) >= 6 ? 1 : 0);
      const diasIndem = Math.min(totalAnios * 30, TOPE_DIAS);
      const montoIndem = (diasIndem / 30) * remCalc;
      const aviso = input.avisoPrevio ? 0 : remCalc;

      return {
        diasIndemnizacion: diasIndem,
        montoIndemnizacion: Math.round(montoIndem),
        montoAvisoPrevio: Math.round(aviso),
        proporcionalVacaciones: Math.round((remCalc / 30) * 1.25),
        proporcionalFeriado: Math.round(remCalc / 30),
        total: Math.round(montoIndem + aviso + (remCalc / 30) * 1.25 + remCalc / 30),
        topeAplicado: input.sueldo > TOPE_REM,
      };
    }),
});
