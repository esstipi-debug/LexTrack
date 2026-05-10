import { getDb } from "../../api/queries/connection";
import { documentosLegales } from "../schema";
import { sql } from "drizzle-orm";

// Importar todos los títulos del Código del Trabajo
import { tituloPreliminar } from "./titulo-preliminar";
import { titulo1Contrato } from "./titulo1-contrato";
import { titulo3Remuneracion } from "./titulo3-remuneracion";
import { titulo4Jornada } from "./titulo4-jornada";
import { titulo6Termino } from "./titulo6-termino";
import { titulo7Proteccion } from "./titulo7-proteccion";
import { titulo8Negociacion } from "./titulo8-negociacion";
import { titulo9Inspeccion } from "./titulo9-inspeccion";

// ─── CONFIGURACIÓN ───────────────────────────────────────────────
const BATCH_SIZE = 50; // Insertar de 50 en 50 para eficiencia

// ─── FUNCION DE BATCH INSERT ─────────────────────────────────────
async function batchInsert(docs: typeof documentosLegales.$inferInsert[]) {
  const db = getDb();
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    await db.insert(documentosLegales).values(batch as any);
    process.stdout.write(`  Insertados ${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length}\r`);
  }
  console.log(""); // newline
}

// ─── SEED PRINCIPAL ──────────────────────────────────────────────
async function seedCompleto() {
  const db = getDb();
  console.log("\n" + "=".repeat(60));
  console.log("  LEXTRACK RAG - SEED COMPLETO DEL CODIGO DEL TRABAJO");
  console.log("=".repeat(60) + "\n");

  // 1. Limpiar tabla para evitar duplicados
  console.log("[1/11] Limpiando tabla documentos_legales...");
  await db.delete(documentosLegales);
  console.log("       Tabla limpia.\n");

  // 2. Insertar Título por Título
  const titulos = [
    { nombre: "Título Preliminar", data: tituloPreliminar },
    { nombre: "Título I: Contrato Individual", data: titulo1Contrato },
    { nombre: "Título III: Remuneración", data: titulo3Remuneracion },
    { nombre: "Título IV: Jornada de Trabajo", data: titulo4Jornada },
    { nombre: "Título VI: Término del Contrato", data: titulo6Termino },
    { nombre: "Título VII: Protección Especial", data: titulo7Proteccion },
    { nombre: "Título VIII: Negociación Colectiva", data: titulo8Negociacion },
    { nombre: "Título IX: Inspección y Multas", data: titulo9Inspeccion },
  ];

  let total = 0;
  for (let i = 0; i < titulos.length; i++) {
    const t = titulos[i];
    console.log(`[${i + 2}/${titulos.length + 2}] ${t.nombre} (${t.data.length} artículos)...`);
    await batchInsert(t.data as any);
    total += t.data.length;
  }

  // 3. Verificar inserción
  console.log(`[${titulos.length + 2}/${titulos.length + 2}] Verificando inserción...`);
  const count = await db.select().from(documentosLegales);
  
  console.log("\n" + "=".repeat(60));
  console.log("  SEED COMPLETADO EXITOSAMENTE");
  console.log("=".repeat(60));
  console.log(`  Total documentos insertados: ${count.length}`);
  console.log(`  Batch size usado: ${BATCH_SIZE}`);
  console.log("=".repeat(60) + "\n");

  // Mostrar distribución por norma
  const porNorma = count.reduce((acc, d) => {
    acc[d.norma || "Sin norma"] = (acc[d.norma || "Sin norma"] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("  Distribución por norma:");
  Object.entries(porNorma).forEach(([norma, n]) => {
    console.log(`    ${norma}: ${n} documentos`);
  });
  console.log("\n");
}

// Ejecutar
seedCompleto()
  .then(() => {
    console.log("RAG poblado con éxito.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error en seed:", err);
    process.exit(1);
  });
