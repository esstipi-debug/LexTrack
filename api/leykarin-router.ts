import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { leykarinDenuncias, leykarinActuaciones } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import {
  generarProtocoloKarin,
  generarChecklistKarin,
  type EmpresaInput,
} from "./lib/karin/protocolo";

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

export const leykarinRouter = createRouter({
  listar: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(leykarinDenuncias).orderBy(desc(leykarinDenuncias.createdAt));
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
    .input(z.object({ id: z.number(), estado: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(leykarinDenuncias).set({ estado: input.estado }).where(eq(leykarinDenuncias.id, input.id));
      return { ok: true };
    }),

  agregarActuacion: publicQuery
    .input(z.object({
      denunciaId: z.number(),
      fecha: z.string(),
      tipo: z.string(),
      descripcion: z.string(),
      actor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(leykarinActuaciones).values({
        denunciaId: input.denunciaId,
        fecha: new Date(input.fecha),
        tipo: input.tipo,
        descripcion: input.descripcion,
        actor: input.actor || null,
      });
      return { ok: true };
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
