// ─── PJUD Sync Service ───────────────────────────────────────────
// Synchronizes local causa data with the Poder Judicial system

import { getDb } from "../../queries/connection";
import { causas, cronologia, alertas } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  consultarCausa,
  obtenerMovimientos,
  type PjudCausaResult,
  type PjudMovimiento,
} from "./client";

export interface SyncResult {
  causaId: number;
  rit: string;
  synced: boolean;
  error?: string;
  cambios: {
    estadoCambio: { anterior: string; nuevo: string } | null;
    nuevosMovimientos: number;
    movimientos: Array<{
      fecha: string;
      tipo: string;
      descripcion: string;
    }>;
  };
}

/** Map PJUD estado strings to our DB enum values */
function mapEstadoPjud(
  estadoPjud: string,
): "tramitacion" | "notificacion" | "prueba" | "sentencia" | "ejecucion" | "concluida" | "archivada" {
  const lower = estadoPjud.toLowerCase();
  if (lower.includes("tramitacion") || lower.includes("discusion"))
    return "tramitacion";
  if (lower.includes("acuerdo") || lower.includes("conciliacion"))
    return "tramitacion";
  if (lower.includes("prueba")) return "prueba";
  if (lower.includes("sentencia")) return "sentencia";
  if (lower.includes("cumplimiento") || lower.includes("ejecucion"))
    return "ejecucion";
  if (lower.includes("archivada")) return "archivada";
  if (lower.includes("concluida") || lower.includes("terminada"))
    return "concluida";
  return "tramitacion";
}

/** Map PJUD movimiento tipo to our cronologia enum */
function mapTipoMovimiento(
  tipoPjud: string,
): "ingreso" | "audiencia" | "resolucion" | "notificacion" | "tramite" | "prueba" | "sentencia" | "apelacion" | "cambio_estado" | "escrito_presentado" | "otro" {
  const lower = tipoPjud.toLowerCase();
  if (lower.includes("resolucion")) return "resolucion";
  if (lower.includes("audiencia")) return "audiencia";
  if (lower.includes("notificacion")) return "notificacion";
  if (lower.includes("sentencia")) return "sentencia";
  if (lower.includes("escrito")) return "escrito_presentado";
  if (lower.includes("actuacion")) return "tramite";
  if (lower.includes("prueba")) return "prueba";
  if (lower.includes("apelacion") || lower.includes("recurso"))
    return "apelacion";
  return "otro";
}

/**
 * Synchronize a single causa with PJUD data.
 * 1. Fetches causa from DB
 * 2. Queries PJUD for current state
 * 3. Compares and inserts new movimientos into cronologia
 * 4. Updates estado if changed and creates an alert
 */
export async function sincronizarCausa(causaId: number): Promise<SyncResult> {
  const db = getDb();

  // 1. Get the causa from DB
  const causaRows = await db
    .select()
    .from(causas)
    .where(eq(causas.id, causaId))
    .limit(1);

  if (causaRows.length === 0) {
    return {
      causaId,
      rit: "",
      synced: false,
      error: "Causa no encontrada en la base de datos",
      cambios: { estadoCambio: null, nuevosMovimientos: 0, movimientos: [] },
    };
  }

  const causa = causaRows[0];

  // 2. Query PJUD
  let pjudResult: PjudCausaResult | null;
  let pjudMovimientos: PjudMovimiento[];
  try {
    pjudResult = await consultarCausa(causa.rit, causa.tribunal);
    pjudMovimientos = await obtenerMovimientos(causa.rit, causa.tribunal);
  } catch (err) {
    return {
      causaId,
      rit: causa.rit,
      synced: false,
      error: `Error consultando PJUD: ${err instanceof Error ? err.message : String(err)}`,
      cambios: { estadoCambio: null, nuevosMovimientos: 0, movimientos: [] },
    };
  }

  if (!pjudResult) {
    return {
      causaId,
      rit: causa.rit,
      synced: false,
      error: "Causa no encontrada en el Poder Judicial",
      cambios: { estadoCambio: null, nuevosMovimientos: 0, movimientos: [] },
    };
  }

  // 3. Compare movimientos — get existing cronologia to find new ones
  const existingCronologia = await db
    .select()
    .from(cronologia)
    .where(eq(cronologia.causaId, causaId))
    .orderBy(desc(cronologia.fecha));

  const existingDates = new Set(
    existingCronologia.map(
      (c) =>
        `${c.fecha instanceof Date ? c.fecha.toISOString().split("T")[0] : String(c.fecha)}|${c.titulo}`,
    ),
  );

  const newMovimientos = pjudMovimientos.filter(
    (m) => !existingDates.has(`${m.fecha}|${m.descripcion}`),
  );

  // Insert new movimientos into cronologia
  for (const mov of newMovimientos) {
    await db.insert(cronologia).values({
      causaId,
      fecha: new Date(mov.fecha),
      tipo: mapTipoMovimiento(mov.tipo),
      titulo: mov.descripcion,
      descripcion: `${mov.tipo}: ${mov.descripcion}${mov.folio ? ` (folio ${mov.folio})` : ""}`,
      fuente: "pjud_sync",
    });
  }

  // 4. Check if estado changed
  const nuevoEstado = mapEstadoPjud(pjudResult.estado);
  let estadoCambio: { anterior: string; nuevo: string } | null = null;

  if (nuevoEstado !== causa.estado) {
    estadoCambio = {
      anterior: causa.estado,
      nuevo: nuevoEstado,
    };

    // Update causa estado
    await db
      .update(causas)
      .set({
        estado: nuevoEstado,
        etapa: pjudResult.etapa,
        fechaUltimoMovimiento: pjudResult.ultimoMovimiento
          ? new Date(pjudResult.ultimoMovimiento.fecha)
          : undefined,
        updatedAt: new Date(),
      })
      .where(eq(causas.id, causaId));

    // Create alert for estado change
    await db.insert(alertas).values({
      causaId,
      tipo: "cambio_estado",
      titulo: `Cambio de estado: ${causa.rit}`,
      descripcion: `La causa ${causa.rit} (${causa.caratula}) cambio de estado "${estadoCambio.anterior}" a "${estadoCambio.nuevo}" segun el Poder Judicial.`,
      prioridad: "alta",
      estado: "pendiente",
      fechaEvento: new Date(),
    } as any);
  } else if (pjudResult.ultimoMovimiento) {
    // Even if estado didn't change, update fechaUltimoMovimiento
    await db
      .update(causas)
      .set({
        fechaUltimoMovimiento: new Date(pjudResult.ultimoMovimiento.fecha),
        updatedAt: new Date(),
      })
      .where(eq(causas.id, causaId));
  }

  // Create alerts for new movimientos
  if (newMovimientos.length > 0) {
    await db.insert(alertas).values({
      causaId,
      tipo: "nuevo_movimiento",
      titulo: `${newMovimientos.length} nuevo(s) movimiento(s): ${causa.rit}`,
      descripcion: `Se detectaron ${newMovimientos.length} nuevo(s) movimiento(s) en la causa ${causa.rit} (${causa.caratula}).`,
      prioridad: "media",
      estado: "pendiente",
      fechaEvento: new Date(),
    } as any);
  }

  return {
    causaId,
    rit: causa.rit,
    synced: true,
    cambios: {
      estadoCambio,
      nuevosMovimientos: newMovimientos.length,
      movimientos: newMovimientos.map((m) => ({
        fecha: m.fecha,
        tipo: m.tipo,
        descripcion: m.descripcion,
      })),
    },
  };
}

/**
 * Synchronize all causas that have monitoring enabled.
 */
export async function sincronizarTodas(): Promise<SyncResult[]> {
  const db = getDb();

  const causasMonitoreadas = await db
    .select()
    .from(causas)
    .where(eq(causas.estaMonitoreando, true));

  const results: SyncResult[] = [];

  for (const causa of causasMonitoreadas) {
    const result = await sincronizarCausa(causa.id);
    results.push(result);
  }

  return results;
}
