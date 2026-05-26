import { getDb } from "../../api/queries/connection";
import {
  documentosLegales,
  jurisprudencias,
  checklistTemplates,
  checklistItems,
  causas,
  tareas,
  alertas,
  honorarios,
  actividadReciente,
} from "../schema";
import { sql } from "drizzle-orm";

// ─── Importar Títulos del Código del Trabajo ─────────────────────
import { tituloPreliminar } from "./titulo-preliminar";
import { titulo1Contrato } from "./titulo1-contrato";
import { titulo1Extra } from "./titulo1-extra";
import { titulo2Derechos } from "./titulo2-derechos";
import { titulo3Remuneracion } from "./titulo3-remuneracion";
import { titulo3RemuneracionReal } from "./titulo3-remuneracion-real";
import { titulo4Jornada } from "./titulo4-jornada";
import { titulo4JornadaReal } from "./titulo4-jornada-real";
import { titulo5Reglamentos } from "./titulo5-reglamentos";
import { titulo6Termino } from "./titulo6-termino";
import { titulo6Complemento } from "./titulo6-complemento";
import { titulo7Proteccion } from "./titulo7-proteccion";
import { titulo8Negociacion } from "./titulo8-negociacion";
import { titulo9Inspeccion } from "./titulo9-inspeccion";
import { jurisprudenciaExtra } from "./jurisprudencia-extra";
import { jurisprudenciaDespido } from "./jurisprudencia-despido";
import { articulosSueltos } from "./articulos-sueltos";
import { gapsFinales100 } from "./gaps-finales-100";

// ─── Importar Libros y Leyes Especiales ──────────────────────────
import { libro3Organizaciones } from "./libro3-organizaciones";
import { libro4NegociacionExtra } from "./libro4-negociacion-extra";
import { libro4Gaps } from "./libro4-gaps";
import { libro5Jurisdiccion } from "./libro5-jurisdiccion";
import { leyesEspeciales } from "./leyes-especiales";

// ─── CONFIGURACIÓN ───────────────────────────────────────────────
const BATCH_SIZE = 5; // Small batches to avoid prepared-statement limits with large content

// ─── BATCH INSERT HELPER ─────────────────────────────────────────
async function batchInsert<T>(table: any, data: T[]) {
  const db = getDb();
  let inserted = 0;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    try {
      await db.insert(table).values(batch as any);
      inserted += batch.length;
    } catch {
      // Fallback: insert one by one (no truncation — preserve full content)
      for (const item of batch) {
        try {
          await db.insert(table).values(item as any);
          inserted++;
        } catch {
          // Skip items that fail to insert
        }
      }
    }
    process.stdout.write(`  ${Math.min(i + BATCH_SIZE, data.length)}/${data.length}\r`);
  }
  if (data.length > 0) console.log(`  ${inserted}/${data.length} OK`);
}

// ─── SEED PRINCIPAL ──────────────────────────────────────────────
async function seedCompleto() {
  const db = getDb();
  console.log("\n" + "=".repeat(65));
  console.log("   LEXTRACK RAG - SEED COMPLETO DEL CODIGO DEL TRABAJO");
  console.log("=".repeat(65));

  // 1. LIMPIAR TABLAS
  console.log("\n[1/6] Limpiando tablas...");
  await db.delete(documentosLegales);
  await db.delete(jurisprudencias);
  await db.delete(checklistItems);
  await db.delete(checklistTemplates);
  await db.delete(actividadReciente);
  await db.delete(honorarios);
  await db.delete(alertas);
  await db.delete(tareas);
  await db.delete(causas);
  console.log("       Tablas limpias.\n");

  // 2. INSERTAR DOCUMENTOS LEGALES (TODOS LOS TITULOS Y LIBROS)
  const titulosCT = [
    { nombre: "Título Preliminar", data: tituloPreliminar },
    { nombre: "Título I: Contrato Individual (base)", data: titulo1Contrato },
    { nombre: "Título I: Contrato Individual (extra)", data: titulo1Extra },
    { nombre: "Título II: Derechos y Obligaciones", data: titulo2Derechos },
    { nombre: "Título III: Remuneración (original)", data: titulo3Remuneracion },
    { nombre: "Título III: Remuneración (real Arts. 84-110)", data: titulo3RemuneracionReal },
    { nombre: "Título IV: Jornada (original)", data: titulo4Jornada },
    { nombre: "Título IV: Jornada real (Arts. 111-155)", data: titulo4JornadaReal },
    { nombre: "Título V: Reglamentos Internos", data: titulo5Reglamentos },
    { nombre: "Título VI: Término del Contrato (base)", data: titulo6Termino },
    { nombre: "Título VI: Término del Contrato (complemento)", data: titulo6Complemento },
    { nombre: "Título VII: Protección Especial", data: titulo7Proteccion },
    { nombre: "Título VIII: Negociación Colectiva (base)", data: titulo8Negociacion },
    { nombre: "Título IX: Inspección y Multas", data: titulo9Inspeccion },
    { nombre: "Libro III: Organizaciones Sindicales", data: libro3Organizaciones },
    { nombre: "Libro IV: Negociación Colectiva (complemento)", data: libro4NegociacionExtra },
    { nombre: "Libro IV: Gaps (Arts. 390-395)", data: libro4Gaps },
    { nombre: "Libro V: Jurisdicción Laboral", data: libro5Jurisdiccion },
    { nombre: "Artículos sueltos faltantes", data: articulosSueltos },
    { nombre: "GAPS FINALES - 100% Codigo del Trabajo (43,59,299-330,412-414)", data: gapsFinales100 },
    { nombre: "Leyes Especiales (21.561, 16.744, 19.728, 21.643)", data: leyesEspeciales },
  ];

  let totalCT = 0;
  for (let i = 0; i < titulosCT.length; i++) {
    const t = titulosCT[i];
    console.log(`[2/6] CT · ${t.nombre} (${t.data.length} artículos)...`);
    await batchInsert(documentosLegales, t.data as any);
    totalCT += t.data.length;
  }

  // 3. INSERTAR JURISPRUDENCIA
  const totalJurisprudencia = [...jurisprudenciaExtra, ...jurisprudenciaDespido];
  console.log(`[3/6] Jurisprudencia (${totalJurisprudencia.length} fallos)...`);
  await batchInsert(jurisprudencias, totalJurisprudencia as any);

  // 4. INSERTAR CHECKLIST TEMPLATES
  console.log("[4/6] Checklist templates...");
  const templates = [
    { nombre: "Despido Injustificado - Tutela de Derechos", descripcion: "Checklist completo para reclamar por despido injustificado", tipo: "despido_injustificado" as const, materia: "laboral" as const, articulos: "Art. 160, 163, 164, 165, 168 bis, 168 ter, 486 CT", estaActiva: true },
    { nombre: "Carta de Aviso de Despido - Art. 161 CT", descripcion: "Checklist para redactar y entregar carta de aviso", tipo: "carta_aviso_despido" as const, materia: "laboral" as const, articulos: "Art. 159, 161, 162, 163, 168 CT", estaActiva: true },
    { nombre: "Finiquito y Liquidación Final", descripcion: "Verificación completa del finiquito", tipo: "finiquito" as const, materia: "laboral" as const, articulos: "Art. 45, 47, 72, 73, 163, 165, 168 CT", estaActiva: true },
  ];
  const insertedTemplates = await db.insert(checklistTemplates).values(templates as any).$returningId();

  const items = [
    // Template 1: Despido Injustificado
    { templateId: insertedTemplates[0].id, orden: 1, titulo: "Verificar fecha del despido y plazo de 60 días hábiles para demandar", descripcion: "El plazo para tutela es de 60 días hábiles desde el despido (Art. 486 CT)", articuloLegal: "Art. 486 CT", esObligatorio: true, categoria: "plazo" },
    { templateId: insertedTemplates[0].id, orden: 2, titulo: "Determinar tipo de contrato (indefinido o plazo fijo)", descripcion: "Verificar si hubo simulación de plazos fijos sucesivos", articuloLegal: "Art. 9, 22, 23 CT", esObligatorio: true, categoria: "verificacion" },
    { templateId: insertedTemplates[0].id, orden: 3, titulo: "Calcular años de servicio continuos", descripcion: "Fracción > 6 meses = 1 año completo", articuloLegal: "Art. 163 CT", esObligatorio: true, categoria: "documento" },
    { templateId: insertedTemplates[0].id, orden: 4, titulo: "Determinar remuneración de cálculo", descripcion: "Última mensual devengada, tope 90 UF", articuloLegal: "Art. 163 CT", esObligatorio: true, categoria: "documento" },
    { templateId: insertedTemplates[0].id, orden: 5, titulo: "Elegir opción: indemnización o reposición", descripcion: "Irrevocable (Art. 168 bis CT)", articuloLegal: "Art. 168 bis CT", esObligatorio: true, categoria: "tramite" },
    { templateId: insertedTemplates[0].id, orden: 6, titulo: "Verificar si se dio aviso previo de 30 días", descripcion: "Si no: indemnización sustitutiva = 1 remuneración", articuloLegal: "Art. 161, 165 CT", esObligatorio: true, categoria: "verificacion" },
    { templateId: insertedTemplates[0].id, orden: 7, titulo: "Calcular indemnización por años de servicio", descripcion: "30 días × año, tope 330 días, base máx 90 UF", articuloLegal: "Art. 163 CT", esObligatorio: true, categoria: "pago" },
    { templateId: insertedTemplates[0].id, orden: 8, titulo: "Calcular proporcional de vacaciones", descripcion: "Última / 25 × días proporcionales", articuloLegal: "Art. 72 CT", esObligatorio: true, categoria: "pago" },
    { templateId: insertedTemplates[0].id, orden: 9, titulo: "Calcular proporcional de feriado legal", descripcion: "Última / 25 × días proporcionales", articuloLegal: "Art. 73 CT", esObligatorio: true, categoria: "pago" },
    { templateId: insertedTemplates[0].id, orden: 10, titulo: "Revisar finiquito firmado bajo protesta", descripcion: "Plazo para impugnar: 2 años", articuloLegal: "Art. 168 CT", esObligatorio: false, categoria: "verificacion" },
    { templateId: insertedTemplates[0].id, orden: 11, titulo: "Preparar demanda de tutela de derechos", descripcion: "Dirección del Trabajo o Tribunal Laboral", articuloLegal: "Art. 485, 486 CT", esObligatorio: true, categoria: "tramite" },
    { templateId: insertedTemplates[0].id, orden: 12, titulo: "Adjuntar documentos de respaldo", descripcion: "Contratos, liquidaciones, certificado cotizaciones, finiquito", articuloLegal: "Art. 485 CT", esObligatorio: true, categoria: "documento" },
    // Template 2: Carta de Aviso
    { templateId: insertedTemplates[1].id, orden: 1, titulo: "Identificar causal de término", descripcion: "Necesidades empresa, mutuo acuerdo, o vencimiento", articuloLegal: "Art. 145, 159 CT", esObligatorio: true, categoria: "verificacion" },
    { templateId: insertedTemplates[1].id, orden: 2, titulo: "Calcular indemnización por años de servicio", descripcion: "30 días × año, tope 330 días, base máx 90 UF", articuloLegal: "Art. 163 CT", esObligatorio: true, categoria: "pago" },
    { templateId: insertedTemplates[1].id, orden: 3, titulo: "Calcular indemnización sustitutiva aviso previo", descripcion: "1 remuneración mensual", articuloLegal: "Art. 161, 165 CT", esObligatorio: true, categoria: "pago" },
    { templateId: insertedTemplates[1].id, orden: 4, titulo: "Calcular proporcional de vacaciones", descripcion: "Remuneración / 25 × días pendientes", articuloLegal: "Art. 72 CT", esObligatorio: true, categoria: "pago" },
    { templateId: insertedTemplates[1].id, orden: 5, titulo: "Calcular proporcional de feriado legal", descripcion: "Remuneración / 25 × días proporcionales", articuloLegal: "Art. 73 CT", esObligatorio: true, categoria: "pago" },
    { templateId: insertedTemplates[1].id, orden: 6, titulo: "Redactar carta de aviso con 30 días de anticipación", descripcion: "Indicar fecha término, causal, indemnizaciones", articuloLegal: "Art. 161 CT", esObligatorio: true, categoria: "documento" },
    { templateId: insertedTemplates[1].id, orden: 7, titulo: "Entregar carta con acuse de recibo", descripcion: "Personalmente o carta certificada", articuloLegal: "Art. 161 CT", esObligatorio: true, categoria: "notificacion" },
    { templateId: insertedTemplates[1].id, orden: 8, titulo: "Preparar finiquito detallado", descripcion: "Incluir indemnizaciones, proporcionales, gratificación", articuloLegal: "Art. 168 CT", esObligatorio: true, categoria: "documento" },
    // Template 3: Finiquito
    { templateId: insertedTemplates[2].id, orden: 1, titulo: "Verificar última remuneración devengada", descripcion: "Confirmar monto", articuloLegal: "Art. 45 CT", esObligatorio: true, categoria: "verificacion" },
    { templateId: insertedTemplates[2].id, orden: 2, titulo: "Revisar gratificación proporcional", descripcion: "Semestre en curso", articuloLegal: "Art. 47 CT", esObligatorio: true, categoria: "pago" },
    { templateId: insertedTemplates[2].id, orden: 3, titulo: "Calcular proporcional de vacaciones", descripcion: "Última / 25 × días no tomados", articuloLegal: "Art. 72 CT", esObligatorio: true, categoria: "pago" },
    { templateId: insertedTemplates[2].id, orden: 4, titulo: "Calcular proporcional de feriado legal", descripcion: "Última / 25 × días proporcionales", articuloLegal: "Art. 73 CT", esObligatorio: true, categoria: "pago" },
    { templateId: insertedTemplates[2].id, orden: 5, titulo: "Verificar indemnización por años de servicio", descripcion: "30 días × año, tope 330, base máx 90 UF", articuloLegal: "Art. 163 CT", esObligatorio: true, categoria: "pago" },
    { templateId: insertedTemplates[2].id, orden: 6, titulo: "Verificar indemnización sustitutiva aviso previo", descripcion: "1 remuneración", articuloLegal: "Art. 165 CT", esObligatorio: true, categoria: "pago" },
    { templateId: insertedTemplates[2].id, orden: 7, titulo: "Firmar finiquito bajo protesta si hay dudas", descripcion: "Art. 168 CT", articuloLegal: "Art. 168 CT", esObligatorio: true, categoria: "documento" },
    { templateId: insertedTemplates[2].id, orden: 8, titulo: "Solicitar certificado de trabajo", descripcion: "Derecho al terminar relación", articuloLegal: "Art. 58 CT", esObligatorio: true, categoria: "documento" },
    { templateId: insertedTemplates[2].id, orden: 9, titulo: "Verificar pago oportuno de cotizaciones", descripcion: "Últimos meses", articuloLegal: "Art. 58 quinquies CT", esObligatorio: true, categoria: "verificacion" },
  ];
  await batchInsert(checklistItems, items);

  // 5. INSERTAR CAUSAS DE EJEMPLO
  console.log("[5/6] Causas, tareas, alertas, honorarios, actividad...");
  await db.insert(causas).values([
    { rit: "C-2024-001", caratula: "Gonzalez Perez vs Empresa Constructora Ltda.", tribunal: "1° Juzgado de Letras del Trabajo de Santiago", materia: "laboral", estado: "tramitacion", etapa: "Prueba", fechaIngreso: "2024-01-15", comuna: "Santiago", region: "Region Metropolitana" },
    { rit: "C-2024-002", caratula: "Rodriguez Martinez vs Supermercados del Sur S.A.", tribunal: "2° Juzgado de Letras del Trabajo de Concepcion", materia: "laboral", estado: "sentencia", etapa: "Sentencia primera instancia", fechaIngreso: "2023-06-10", comuna: "Concepcion", region: "Biobio" },
    { rit: "C-2024-003", caratula: "Silva Fuentes vs Transportes Nacional S.A.", tribunal: "3° Juzgado de Letras del Trabajo de Valparaiso", materia: "laboral", estado: "tramitacion", etapa: "Audiencia preparatoria", fechaIngreso: "2024-03-01", comuna: "Valparaiso", region: "Valparaiso" },
  ] as any);

  await db.insert(tareas).values([
    { titulo: "Revisar escrito de demanda causa C-2024-001", descripcion: "Revisar y corregir escrito de demanda de tutela", estado: "pendiente", prioridad: "alta", tipo: "preparar_escrito", fechaVencimiento: "2024-12-20" },
    { titulo: "Preparar audiencia preparatoria C-2024-003", descripcion: "Organizar pruebas y testigos", estado: "en_progreso", prioridad: "alta", tipo: "agendar_audiencia", fechaVencimiento: "2024-12-18" },
    { titulo: "Calcular liquidación final Rodriguez Martinez", descripcion: "Calcular indemnizaciones y proporcionales", estado: "pendiente", prioridad: "media", tipo: "checklist_despido", fechaVencimiento: "2024-12-22" },
    { titulo: "Revisar Diario Oficial - normas laborales", descripcion: "Verificar nuevas normas", estado: "pendiente", prioridad: "baja", tipo: "revisar_diario_oficial", fechaVencimiento: "2024-12-25" },
  ] as any);

  await db.insert(alertas).values([
    { titulo: "Plazo próximo: Contestación de demanda C-2024-001", descripcion: "El plazo vence en 5 días hábiles", prioridad: "critica", estado: "pendiente", tipo: "prazo_proximo", fechaVencimiento: "2024-12-15" },
    { titulo: "Nueva norma laboral publicada en Diario Oficial", descripcion: "Reforma al Art. 184 bis CT sobre teletrabajo", prioridad: "media", estado: "pendiente", tipo: "cambio_normativo" },
    { titulo: "Audiencia programada: C-2024-003", descripcion: "Audiencia preparatoria 20 de diciembre", prioridad: "alta", estado: "pendiente", tipo: "audiencia_programada", fechaEvento: "2024-12-20" },
  ] as any);

  await db.insert(honorarios).values([
    { cliente: "Gonzalez Perez", concepto: "Honorarios primera instancia - Despido injustificado", tipo: "honorario", monto: 2500000, montoPagado: 1000000, estado: "pagado_parcial", fechaVencimiento: "2024-12-31" },
    { cliente: "Rodriguez Martinez", concepto: "Honorarios causa despido - Sentencia favorable", tipo: "honorario", monto: 3200000, montoPagado: 0, estado: "pendiente", fechaVencimiento: "2024-12-15" },
    { cliente: "Silva Fuentes", concepto: "Consulta inicial - Despido indirecto", tipo: "consulta", monto: 150000, montoPagado: 150000, estado: "pagado", fechaVencimiento: "2024-11-30" },
  ] as any);

  await db.insert(actividadReciente).values([
    { tipo: "causa_creada", titulo: "Nueva causa: C-2024-003", descripcion: "Silva Fuentes vs Transportes Nacional S.A." },
    { tipo: "tarea_completada", titulo: "Tarea completada: Revisión de demanda", descripcion: "Escrito de demanda C-2024-001 revisado y presentado" },
    { tipo: "alerta_nueva", titulo: "Alerta: Plazo próximo", descripcion: "Contestación C-2024-001 vence en 5 días" },
  ] as any);
  console.log("       Datos insertados.\n");

  // 6. VERIFICACIÓN FINAL
  console.log("[6/6] Verificando inserción...");
  const countDocs = await db.select().from(documentosLegales);
  const countJuris = await db.select().from(jurisprudencias);
  const countTemplates = await db.select().from(checklistTemplates);
  const countItems = await db.select().from(checklistItems);
  const countCausas = await db.select().from(causas);
  const countTareas = await db.select().from(tareas);

  console.log("\n" + "=".repeat(65));
  console.log("   SEED COMPLETADO EXITOSAMENTE");
  console.log("=".repeat(65));
  console.log(`   Artículos Código del Trabajo: ${countDocs.length}`);
  console.log(`   Fallos jurisprudenciales:     ${countJuris.length}`);
  console.log(`   Checklist templates:          ${countTemplates.length}`);
  console.log(`   Checklist items:              ${countItems.length}`);
  console.log(`   Causas:                       ${countCausas.length}`);
  console.log(`   Tareas:                       ${countTareas.length}`);
  console.log("=".repeat(65) + "\n");

  const porNorma = countDocs.reduce((acc, d) => {
    acc[d.norma || "Sin norma"] = (acc[d.norma || "Sin norma"] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("   Distribución por norma:");
  Object.entries(porNorma).forEach(([norma, n]) => {
    console.log(`     ${norma}: ${n}`);
  });
  console.log("\n");
}

seedCompleto()
  .then(() => { console.log("✅ RAG poblado con éxito."); process.exit(0); })
  .catch((err) => { console.error("❌ Error:", err); process.exit(1); });
