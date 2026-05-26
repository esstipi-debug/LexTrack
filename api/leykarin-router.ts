import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { leykarinDenuncias, leykarinActuaciones } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import {
  generarProtocoloKarin,
  generarChecklistKarin,
  type EmpresaInput,
} from "./lib/karin/protocolo";

// ─── Types ──────────────────────────────────────────────────────
type EstadoDenuncia = "recepcionada" | "evaluacion" | "investigacion" | "remitida_dt" | "archivada" | "concluida";

type TipoActuacion = "recepcion" | "evaluacion" | "entrevista" | "investigacion" | "evidencia" | "remision_dt" | "archivo" | "resolucion" | "apelacion";

// ─── State machine ──────────────────────────────────────────────
const VALID_TRANSITIONS: Record<EstadoDenuncia, EstadoDenuncia[]> = {
  recepcionada: ["evaluacion"],
  evaluacion: ["investigacion", "remitida_dt"],
  investigacion: ["concluida", "remitida_dt"],
  remitida_dt: ["concluida"],
  concluida: ["archivada"],
  archivada: [],
};

function validarTransicionEstado(actual: EstadoDenuncia, nuevo: EstadoDenuncia): void {
  const permitidos = VALID_TRANSITIONS[actual];
  if (!permitidos || !permitidos.includes(nuevo)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Transición de estado inválida: "${actual}" → "${nuevo}". Transiciones permitidas desde "${actual}": ${
        permitidos && permitidos.length > 0 ? permitidos.join(", ") : "ninguna (estado terminal)"
      }.`,
    });
  }
}

// ─── Zod enums ──────────────────────────────────────────────────
const estadoEnum = z.enum(["recepcionada", "evaluacion", "investigacion", "remitida_dt", "archivada", "concluida"]);

const tipoActuacionEnum = z.enum(["recepcion", "evaluacion", "entrevista", "investigacion", "evidencia", "remision_dt", "archivo", "resolucion", "apelacion"]);

const canalEnum = z.enum([
  "presencial",
  "escrito_fisico",
  "formulario_web",
  "correo_electronico",
  "linea_telefonica",
  "buzon_anonimo",
]);

const empresaSchema = z.object({
  razonSocial: z.string().min(1),
  rut: z.string().min(1),
  rubro: z.string().min(1),
  domicilioPrincipal: z.string().min(1),
  dotacionTotal: z.number().int().nonnegative(),
  sucursales: z.array(z.string()).default([]),
  encargadoNombre: z.string().min(1),
  encargadoCargo: z.string().min(1),
  encargadoEmail: z.string().email(),
  encargadoTelefono: z.string().optional(),
  encargadoSuplenteNombre: z.string().optional(),
  encargadoSuplenteCargo: z.string().optional(),
  canalesDenuncia: z.array(canalEnum).min(1),
  emailDenuncias: z.string().email().optional(),
  telefonoDenuncias: z.string().optional(),
  urlFormulario: z.string().url().optional(),
  representanteLegalNombre: z.string().min(1),
  representanteLegalRut: z.string().min(1),
  fechaVigencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ─── Helpers ────────────────────────────────────────────────────
function calcularDiasRestantes(fechaRecepcion: string | Date, plazo: number): number {
  const recepcion = typeof fechaRecepcion === "string"
    ? new Date(fechaRecepcion + "T00:00:00")
    : new Date(fechaRecepcion);
  const limite = new Date(recepcion);
  limite.setDate(limite.getDate() + plazo);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diff = limite.getTime() - hoy.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Router ─────────────────────────────────────────────────────
export const leykarinRouter = createRouter({
  listar: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(leykarinDenuncias).orderBy(desc(leykarinDenuncias.createdAt));
  }),

  obtener: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [denuncia] = await db
        .select()
        .from(leykarinDenuncias)
        .where(eq(leykarinDenuncias.id, input.id));
      if (!denuncia) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Denuncia con ID ${input.id} no encontrada.`,
        });
      }
      const actuaciones = await db
        .select()
        .from(leykarinActuaciones)
        .where(eq(leykarinActuaciones.denunciaId, input.id))
        .orderBy(desc(leykarinActuaciones.fecha));
      return { ...denuncia, actuaciones };
    }),

  crear: publicQuery
    .input(z.object({
      codigo: z.string(),
      fechaRecepcion: z.string(),
      tipo: z.string().default("acoso_laboral"),
      denunciante: z.string().optional(),
      denunciado: z.string(),
      descripcionHechos: z.string(),
      area: z.string().optional(),
      prioridad: z.string().default("media"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const values: Record<string, unknown> = {
        codigo: input.codigo,
        fechaRecepcion: new Date(input.fechaRecepcion),
        tipo: input.tipo as "acoso_laboral" | "acoso_sexual" | "violencia_laboral" | "discriminacion" | "otro",
        denunciante: input.denunciante,
        denunciado: input.denunciado,
        descripcionHechos: input.descripcionHechos,
        area: input.area,
        prioridad: input.prioridad as "baja" | "media" | "alta" | "critica",
      };
      await db.insert(leykarinDenuncias).values(values as any);
      return { ok: true };
    }),

  cambiarEstado: publicQuery
    .input(z.object({ id: z.number(), estado: estadoEnum }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const nuevoEstado: EstadoDenuncia = input.estado;

      // Fetch current denuncia to validate transition
      const [denuncia] = await db
        .select()
        .from(leykarinDenuncias)
        .where(eq(leykarinDenuncias.id, input.id));

      if (!denuncia) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Denuncia con ID ${input.id} no encontrada.`,
        });
      }

      const estadoActual = denuncia.estado as EstadoDenuncia;
      validarTransicionEstado(estadoActual, nuevoEstado);

      await db
        .update(leykarinDenuncias)
        .set({ estado: nuevoEstado })
        .where(eq(leykarinDenuncias.id, input.id));

      return { ok: true, de: estadoActual, a: nuevoEstado };
    }),

  agregarActuacion: publicQuery
    .input(z.object({
      denunciaId: z.number(),
      fecha: z.string(),
      tipo: tipoActuacionEnum,
      descripcion: z.string(),
      actor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(leykarinActuaciones).values({
        denunciaId: input.denunciaId,
        fecha: new Date(input.fecha),
        tipo: input.tipo as any,
        descripcion: input.descripcion,
        actor: input.actor || null,
      } as any);
      return { ok: true };
    }),

  dashboard: publicQuery.query(async () => {
    const db = getDb();
    const todas = await db.select().from(leykarinDenuncias);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const porEstado: Record<string, number> = {};
    const porTipo: Record<string, number> = {};
    let urgentes = 0;
    let vencidas = 0;
    let activas = 0;

    const estadosActivos: EstadoDenuncia[] = ["recepcionada", "evaluacion", "investigacion", "remitida_dt"];

    for (const d of todas) {
      // Count by estado
      porEstado[d.estado] = (porEstado[d.estado] || 0) + 1;
      // Count by tipo
      porTipo[d.tipo] = (porTipo[d.tipo] || 0) + 1;

      if (estadosActivos.includes(d.estado as EstadoDenuncia)) {
        activas++;
        const diasRestantes = calcularDiasRestantes(
          d.fechaRecepcion,
          d.diasPlazo ?? 30,
        );
        if (diasRestantes < 0) {
          vencidas++;
        } else if (diasRestantes < 5) {
          urgentes++;
        }
      }
    }

    return {
      total: todas.length,
      activas,
      urgentes,
      vencidas,
      porEstado,
      porTipo,
    };
  }),

  calcularPlazo: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [denuncia] = await db
        .select()
        .from(leykarinDenuncias)
        .where(eq(leykarinDenuncias.id, input.id));

      if (!denuncia) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Denuncia con ID ${input.id} no encontrada.`,
        });
      }

      const plazoInvestigacion = denuncia.diasPlazo ?? 30;
      const diasRestantesInvestigacion = calcularDiasRestantes(
        denuncia.fechaRecepcion,
        plazoInvestigacion,
      );
      const diasRestantesCautelares = calcularDiasRestantes(
        denuncia.fechaRecepcion,
        3,
      );

      return {
        denunciaId: denuncia.id,
        codigo: denuncia.codigo,
        fechaRecepcion: denuncia.fechaRecepcion,
        plazoInvestigacion,
        diasRestantesInvestigacion,
        diasRestantesCautelares,
        vencidaInvestigacion: diasRestantesInvestigacion < 0,
        vencidaCautelares: diasRestantesCautelares < 0,
      };
    }),

  generarProtocolo: publicQuery
    .input(empresaSchema)
    .mutation(async ({ input }) => {
      const empresa = input as EmpresaInput;
      return {
        protocolo: generarProtocoloKarin(empresa),
        checklist: generarChecklistKarin(empresa),
        generadoEn: new Date().toISOString(),
      };
    }),

  estadisticas: publicQuery.query(async () => {
    const db = getDb();
    const todas = await db.select().from(leykarinDenuncias);
    const porEstado = todas.reduce((acc, d) => {
      acc[d.estado] = (acc[d.estado] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const porTipo = todas.reduce((acc, d) => {
      acc[d.tipo] = (acc[d.tipo] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { total: todas.length, porEstado, porTipo };
  }),
});
