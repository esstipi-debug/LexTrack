import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { leykarinDenuncias, leykarinActuaciones, leykarinMedidas } from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  generarProtocoloKarin,
  generarChecklistKarin,
  type EmpresaInput,
} from "./lib/karin/protocolo";
import {
  generarActaRecepcion,
  generarInformeFinal,
  generarNotificacionMedidas,
  type ActaRecepcionInput,
  type InformeFinalInput,
  type NotificacionMedidasInput,
} from "./lib/karin/documentos";

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

const medidaTipoEnum = z.enum([
  "separacion_espacial",
  "cambio_turno",
  "reasignacion_funciones",
  "permiso_preventivo",
  "derivacion_psicologica",
  "otra",
]);

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

function toDateStr(v: string | Date): string {
  return typeof v === "string" ? v : new Date(v).toISOString().split("T")[0];
}

// ─── Router ─────────────────────────────────────────────────────
export const leykarinRouter = createRouter({
  listar: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(leykarinDenuncias).orderBy(desc(leykarinDenuncias.createdAt));
  }),

  obtener: authedQuery
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

  crear: authedQuery
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

  cambiarEstado: authedQuery
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

  agregarActuacion: authedQuery
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

  dashboard: authedQuery.query(async () => {
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

  calcularPlazo: authedQuery
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

  generarProtocolo: authedQuery
    .input(empresaSchema)
    .mutation(async ({ input }) => {
      const empresa = input as EmpresaInput;
      return {
        protocolo: generarProtocoloKarin(empresa),
        checklist: generarChecklistKarin(empresa),
        generadoEn: new Date().toISOString(),
      };
    }),

  // ─── Document generators ────────────────────────────────────

  generarActa: authedQuery
    .input(z.object({
      denunciaId: z.number(),
      empresa: z.string().min(1),
      hora: z.string().default("09:00"),
      canalDenuncia: z.string().default("presencial"),
      receptor: z.string().min(1),
      receptorCargo: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [denuncia] = await db
        .select()
        .from(leykarinDenuncias)
        .where(eq(leykarinDenuncias.id, input.denunciaId));

      if (!denuncia) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Denuncia no encontrada" });
      }

      const actaInput: ActaRecepcionInput = {
        folio: denuncia.codigo,
        fecha: toDateStr(denuncia.fechaRecepcion),
        hora: input.hora,
        empresa: input.empresa,
        denuncianteNombre: denuncia.denunciante || "Anónimo",
        denuncianteRut: denuncia.rutDenunciante || "—",
        denuncianteCargo: denuncia.cargoDenunciante || "—",
        denunciadoNombre: denuncia.denunciado,
        denunciadoCargo: denuncia.cargoDenunciado || "—",
        tipo: denuncia.tipo as ActaRecepcionInput["tipo"],
        descripcionHechos: denuncia.descripcionHechos,
        testigos: denuncia.testigos || undefined,
        canalDenuncia: input.canalDenuncia,
        receptor: input.receptor,
        receptorCargo: input.receptorCargo,
      };

      return {
        documento: generarActaRecepcion(actaInput),
        folio: denuncia.codigo,
        generadoEn: new Date().toISOString(),
      };
    }),

  generarInforme: authedQuery
    .input(z.object({
      denunciaId: z.number(),
      empresa: z.string().min(1),
      investigador: z.string().min(1),
      investigadorCargo: z.string().min(1),
      fechaCierre: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      hechosAcreditados: z.string().min(1),
      calificacionJuridica: z.string().min(1),
      conclusion: z.enum(["acreditado", "no_acreditado", "parcialmente_acreditado"]),
      fundamentoConclusion: z.string().min(1),
      medidasPropuestas: z.array(z.string()).default([]),
      sancionesPropuestas: z.array(z.string()).default([]),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [denuncia] = await db
        .select()
        .from(leykarinDenuncias)
        .where(eq(leykarinDenuncias.id, input.denunciaId));

      if (!denuncia) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Denuncia no encontrada" });
      }

      const actuaciones = await db
        .select()
        .from(leykarinActuaciones)
        .where(eq(leykarinActuaciones.denunciaId, input.denunciaId))
        .orderBy(leykarinActuaciones.fecha);

      const informeInput: InformeFinalInput = {
        folio: denuncia.codigo,
        empresa: input.empresa,
        fecha: input.fechaCierre,
        investigador: input.investigador,
        investigadorCargo: input.investigadorCargo,
        denuncianteNombre: denuncia.denunciante || "Anónimo",
        denuncianteRut: denuncia.rutDenunciante || undefined,
        denuncianteCargo: denuncia.cargoDenunciante || undefined,
        denunciadoNombre: denuncia.denunciado,
        denunciadoRut: denuncia.rutDenunciado || undefined,
        denunciadoCargo: denuncia.cargoDenunciado || undefined,
        tipo: denuncia.tipo as InformeFinalInput["tipo"],
        fechaRecepcion: toDateStr(denuncia.fechaRecepcion),
        fechaInicioInvestigacion: denuncia.fechaInicioInvestigacion
          ? toDateStr(denuncia.fechaInicioInvestigacion)
          : toDateStr(denuncia.fechaRecepcion),
        fechaCierre: input.fechaCierre,
        descripcionHechos: denuncia.descripcionHechos,
        actuaciones: actuaciones.map((a) => ({
          fecha: toDateStr(a.fecha),
          tipo: a.tipo,
          descripcion: a.descripcion,
          actor: a.actor || undefined,
        })),
        hechosAcreditados: input.hechosAcreditados,
        calificacionJuridica: input.calificacionJuridica,
        conclusion: input.conclusion,
        fundamentoConclusion: input.fundamentoConclusion,
        medidasPropuestas: input.medidasPropuestas,
        sancionesPropuestas: input.sancionesPropuestas,
      };

      return {
        documento: generarInformeFinal(informeInput),
        folio: denuncia.codigo,
        generadoEn: new Date().toISOString(),
      };
    }),

  generarNotificacionMedidas: authedQuery
    .input(z.object({
      denunciaId: z.number(),
      empresa: z.string().min(1),
      representanteLegal: z.string().min(1),
      medidas: z.array(z.object({
        tipo: z.string().min(1),
        descripcion: z.string().min(1),
      })).min(1),
      fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      fundamentoLegal: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [denuncia] = await db
        .select()
        .from(leykarinDenuncias)
        .where(eq(leykarinDenuncias.id, input.denunciaId));

      if (!denuncia) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Denuncia no encontrada" });
      }

      const notifInput: NotificacionMedidasInput = {
        folio: denuncia.codigo,
        fecha: input.fechaInicio,
        empresa: input.empresa,
        representanteLegal: input.representanteLegal,
        denuncianteNombre: denuncia.denunciante || "Anónimo",
        denuncianteRut: denuncia.rutDenunciante || undefined,
        denuncianteCargo: denuncia.cargoDenunciante || undefined,
        medidas: input.medidas,
        fechaInicio: input.fechaInicio,
        fundamentoLegal: input.fundamentoLegal,
      };

      return {
        documento: generarNotificacionMedidas(notifInput),
        folio: denuncia.codigo,
        generadoEn: new Date().toISOString(),
      };
    }),

  // ─── Medidas cautelares CRUD ──────────────────────────────────

  agregarMedida: authedQuery
    .input(z.object({
      denunciaId: z.number(),
      tipo: medidaTipoEnum,
      descripcion: z.string().min(1),
      fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(leykarinMedidas).values({
        denunciaId: input.denunciaId,
        tipo: input.tipo,
        descripcion: input.descripcion,
        fechaInicio: input.fechaInicio,
        fechaFin: input.fechaFin || null,
        estado: "activa",
      } as any);
      return { ok: true };
    }),

  listarMedidas: authedQuery
    .input(z.object({ denunciaId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(leykarinMedidas)
        .where(eq(leykarinMedidas.denunciaId, input.denunciaId))
        .orderBy(desc(leykarinMedidas.createdAt));
    }),

  finalizarMedida: authedQuery
    .input(z.object({
      id: z.number(),
      fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const fechaFin = input.fechaFin ? new Date(input.fechaFin) : new Date();
      await db
        .update(leykarinMedidas)
        .set({ estado: "finalizada" as any, fechaFin })
        .where(eq(leykarinMedidas.id, input.id));
      return { ok: true };
    }),

  // ─── Alertas automáticas de plazos ────────────────────────────

  alertasAutomaticas: authedQuery.query(async () => {
    const db = getDb();
    const denuncias = await db
      .select()
      .from(leykarinDenuncias)
      .where(
        sql`${leykarinDenuncias.estado} IN ('recepcionada', 'evaluacion', 'investigacion')`
      );

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const alertas: {
      denunciaId: number;
      codigo: string;
      tipo: string;
      mensaje: string;
      diasRestantes: number;
      vencido: boolean;
    }[] = [];

    for (const d of denuncias) {
      const fechaRecepcion = new Date(
        typeof d.fechaRecepcion === "string"
          ? d.fechaRecepcion + "T00:00:00"
          : d.fechaRecepcion
      );

      // 1. Investigation deadline: 30 days from reception
      const plazoInvestigacion = new Date(fechaRecepcion);
      plazoInvestigacion.setDate(plazoInvestigacion.getDate() + 30);
      const diasInvestigacion = Math.ceil(
        (plazoInvestigacion.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diasInvestigacion <= 10) {
        alertas.push({
          denunciaId: d.id,
          codigo: d.codigo,
          tipo: "plazo_investigacion",
          mensaje: diasInvestigacion <= 0
            ? `VENCIDO: Plazo de investigación (30 días) vencido hace ${Math.abs(diasInvestigacion)} día(s)`
            : `Quedan ${diasInvestigacion} día(s) para concluir la investigación (plazo 30 días)`,
          diasRestantes: diasInvestigacion,
          vencido: diasInvestigacion <= 0,
        });
      }

      // 2. Medidas cautelares deadline: 3 days from reception
      if (d.estado === "recepcionada" || d.estado === "evaluacion") {
        const plazoMedidas = new Date(fechaRecepcion);
        plazoMedidas.setDate(plazoMedidas.getDate() + 3);
        const diasMedidas = Math.ceil(
          (plazoMedidas.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diasMedidas <= 3) {
          alertas.push({
            denunciaId: d.id,
            codigo: d.codigo,
            tipo: "plazo_medidas_cautelares",
            mensaje: diasMedidas <= 0
              ? `VENCIDO: Plazo para adoptar medidas cautelares (3 días) vencido hace ${Math.abs(diasMedidas)} día(s)`
              : `Quedan ${diasMedidas} día(s) para adoptar medidas cautelares (plazo 3 días)`,
            diasRestantes: diasMedidas,
            vencido: diasMedidas <= 0,
          });
        }
      }

      // 3. Sanction application deadline: 15 days from informe (fechaResolucion)
      if (d.fechaResolucion) {
        const fechaResolucion = new Date(
          typeof d.fechaResolucion === "string"
            ? d.fechaResolucion + "T00:00:00"
            : d.fechaResolucion
        );
        const plazoSancion = new Date(fechaResolucion);
        plazoSancion.setDate(plazoSancion.getDate() + 15);
        const diasSancion = Math.ceil(
          (plazoSancion.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diasSancion <= 10) {
          alertas.push({
            denunciaId: d.id,
            codigo: d.codigo,
            tipo: "plazo_sancion",
            mensaje: diasSancion <= 0
              ? `VENCIDO: Plazo para aplicar sanciones (15 días desde informe) vencido hace ${Math.abs(diasSancion)} día(s)`
              : `Quedan ${diasSancion} día(s) para aplicar sanciones (plazo 15 días desde informe)`,
            diasRestantes: diasSancion,
            vencido: diasSancion <= 0,
          });
        }
      }
    }

    // Sort: vencidos first, then by remaining days ascending
    alertas.sort((a, b) => {
      if (a.vencido !== b.vencido) return a.vencido ? -1 : 1;
      return a.diasRestantes - b.diasRestantes;
    });

    return alertas;
  }),

  estadisticas: authedQuery.query(async () => {
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
