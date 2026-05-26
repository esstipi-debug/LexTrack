import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { causas } from "@db/schema";
import {
  consultarCausa,
  buscarPorRut,
  type PjudCausaResult,
} from "./lib/pjud/client";
import { sincronizarCausa, sincronizarTodas } from "./lib/pjud/sync";

/** Map a PJUD estado string to our local DB enum */
function mapEstadoToLocal(
  estadoPjud: string,
): "tramitacion" | "notificacion" | "prueba" | "sentencia" | "ejecucion" | "concluida" | "archivada" {
  const lower = estadoPjud.toLowerCase();
  if (lower.includes("tramitacion") || lower.includes("discusion"))
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

export const pjudRouter = createRouter({
  /** Query PJUD by RIT, return result */
  consultar: authedQuery
    .input(
      z.object({
        rit: z.string().min(1),
        tribunal: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const result = await consultarCausa(input.rit, input.tribunal);
      return result;
    }),

  /** Sync a specific causa by ID, return changes */
  sincronizar: authedQuery
    .input(z.object({ causaId: z.number() }))
    .mutation(async ({ input }) => {
      return sincronizarCausa(input.causaId);
    }),

  /** Sync all causas with estaMonitoreando = true */
  sincronizarTodas: authedQuery.mutation(async () => {
    return sincronizarTodas();
  }),

  /** Search PJUD by RUT, return matches */
  buscarPorRut: authedQuery
    .input(z.object({ rut: z.string().min(1) }))
    .query(async ({ input }) => {
      return buscarPorRut(input.rut);
    }),

  /** Import a PJUD result as a new causa in the DB */
  importar: authedQuery
    .input(
      z.object({
        rit: z.string(),
        ruc: z.string().optional(),
        caratula: z.string(),
        tribunal: z.string(),
        estado: z.string().optional(),
        etapa: z.string().optional(),
        fechaIngreso: z.string().optional(),
        litigantes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const estado = input.estado
        ? mapEstadoToLocal(input.estado)
        : "tramitacion";

      await db.insert(causas).values({
        rit: input.rit,
        ruc: input.ruc,
        caratula: input.caratula,
        tribunal: input.tribunal,
        estado,
        etapa: input.etapa,
        fechaIngreso: input.fechaIngreso
          ? new Date(input.fechaIngreso)
          : undefined,
        litigantes: input.litigantes,
        fuente: "consulta_unificada",
        estaMonitoreando: true,
      });

      return { ok: true };
    }),
});
