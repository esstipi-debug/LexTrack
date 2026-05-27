import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  integer,
  boolean,
  jsonb,
  date,
  index,
  unique,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const orgRoleEnum = pgEnum("org_role", ["owner", "admin", "member"]);
export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "expired",
]);

export const materiaEnum = pgEnum("materia", [
  "laboral",
  "civil",
  "penal",
  "cobranza",
  "familia",
  "comercial",
  "administrativa",
]);

export const expedienteEstadoEnum = pgEnum("expediente_estado", [
  "activo",
  "archivado",
  "concluido",
  "pendiente",
]);

export const prioridadEnum = pgEnum("prioridad", [
  "baja",
  "media",
  "alta",
  "critica",
]);

export const causaEstadoEnum = pgEnum("causa_estado", [
  "tramitacion",
  "notificacion",
  "prueba",
  "sentencia",
  "ejecucion",
  "concluida",
  "archivada",
]);

export const alertaTipoEnum = pgEnum("alerta_tipo", [
  "cambio_estado",
  "nuevo_movimiento",
  "nueva_resolucion",
  "prazo_proximo",
  "audiencia_programada",
  "notificacion_pendiente",
  "cambio_normativo",
  "diario_oficial",
  "dt_dictamen",
  "system",
]);

export const alertaEstadoEnum = pgEnum("alerta_estado", [
  "pendiente",
  "leida",
  "archivada",
]);

export const tareaTipoEnum = pgEnum("tarea_tipo", [
  "revision_documento",
  "preparar_escrito",
  "seguimiento_causa",
  "revisar_resolucion",
  "notificar_cliente",
  "agendar_audiencia",
  "investigar_norma",
  "checklist_despido",
  "checklist_finiquito",
  "revisar_diario_oficial",
  "otra",
]);

export const tareaEstadoEnum = pgEnum("tarea_estado", [
  "pendiente",
  "en_progreso",
  "completada",
  "cancelada",
]);

export const documentoTipoEnum = pgEnum("documento_tipo", [
  "resolucion",
  "sentencia",
  "escrito",
  "demanda",
  "contestacion",
  "finiquito",
  "contrato",
  "carta_aviso",
  "dictamen",
  "informe",
  "nota",
  "otro",
]);

export const cronologiaTipoEnum = pgEnum("cronologia_tipo", [
  "ingreso",
  "audiencia",
  "resolucion",
  "notificacion",
  "tramite",
  "prueba",
  "sentencia",
  "apelacion",
  "cambio_estado",
  "escrito_presentado",
  "otro",
]);

export const notaTipoEnum = pgEnum("nota_tipo", [
  "general",
  "estrategia",
  "cliente",
  "procesal",
  "evidencia",
]);

export const checklistTemplateTipoEnum = pgEnum("checklist_template_tipo", [
  "despido_procedente",
  "despido_injustificado",
  "finiquito",
  "reclamacion_indemnizacion",
  "reclamacion_cotizaciones",
  "carta_aviso_despido",
  "accidente_laboral",
  "proteccion_derechos",
  "despido_colectivo",
  "consulta_dt",
]);

export const checklistTemplateMateriaEnum = pgEnum(
  "checklist_template_materia",
  ["laboral", "civil", "penal", "cobranza"]
);

export const checklistItemCategoriaEnum = pgEnum("checklist_item_categoria", [
  "documento",
  "tramite",
  "notificacion",
  "plazo",
  "verificacion",
  "pago",
  "consulta",
  "otro",
]);

export const checklistEjecucionEstadoEnum = pgEnum(
  "checklist_ejecucion_estado",
  ["pendiente", "en_progreso", "completado"]
);

export const consultaFuenteEnum = pgEnum("consulta_fuente", [
  "pjud_causas",
  "pjud_sentencias",
  "diario_oficial",
  "dt_dictamenes",
  "leychile",
]);

export const consultaFrecuenciaEnum = pgEnum("consulta_frecuencia", [
  "cada_4_horas",
  "diaria",
  "semanal",
]);

export const actividadTipoEnum = pgEnum("actividad_tipo", [
  "causa_creada",
  "causa_actualizada",
  "alerta_nueva",
  "alerta_leida",
  "tarea_creada",
  "tarea_completada",
  "tarea_vencida",
  "documento_agregado",
  "cronologia_nuevo",
  "checklist_completado",
  "consulta_ejecutada",
]);

export const documentoLegalTipoEnum = pgEnum("documento_legal_tipo", [
  "articulo",
  "ley",
  "decreto",
  "jurisprudencia",
  "doctrina",
]);

export const documentoLegalCategoriaEnum = pgEnum(
  "documento_legal_categoria",
  ["laboral", "civil", "penal", "procesal", "constitucional"]
);

export const conversacionRoleEnum = pgEnum("conversacion_role", [
  "user",
  "assistant",
  "system",
]);

export const promptEscritoTipoEnum = pgEnum("prompt_escrito_tipo", [
  "demanda",
  "contestacion",
  "recurso",
  "escrito",
  "carta",
  "memorial",
]);

export const promptEscritoEstadoEnum = pgEnum("prompt_escrito_estado", [
  "pendiente",
  "generado",
  "revisado",
]);

export const jurisprudenciaTipoEnum = pgEnum("jurisprudencia_tipo", [
  "sentencia",
  "resolucion",
  "auto",
  "acordada",
  "fallo",
]);

export const leykarinTipoEnum = pgEnum("leykarin_tipo", [
  "acoso_laboral",
  "acoso_sexual",
  "violencia_laboral",
  "discriminacion",
  "otro",
]);

export const leykarinModoEnum = pgEnum("leykarin_modo", [
  "presencial",
  "escrito",
  "correo",
  "telefono",
  "anonimo",
]);

export const leykarinEstadoEnum = pgEnum("leykarin_estado", [
  "recepcionada",
  "evaluacion",
  "investigacion",
  "remitida_dt",
  "archivada",
  "concluida",
]);

export const leykarinActuacionTipoEnum = pgEnum("leykarin_actuacion_tipo", [
  "recepcion",
  "evaluacion",
  "entrevista",
  "investigacion",
  "evidencia",
  "remision_dt",
  "archivo",
  "resolucion",
  "apelacion",
]);

export const leykarinMedidaTipoEnum = pgEnum("leykarin_medida_tipo", [
  "separacion_espacial",
  "cambio_turno",
  "reasignacion_funciones",
  "permiso_preventivo",
  "derivacion_psicologica",
  "otra",
]);

export const leykarinMedidaEstadoEnum = pgEnum("leykarin_medida_estado", [
  "activa",
  "finalizada",
  "revocada",
]);

export const honorarioTipoEnum = pgEnum("honorario_tipo", [
  "honorario",
  "gasto",
  "tasa",
  "consulta",
  "retencion",
]);

export const honorarioEstadoEnum = pgEnum("honorario_estado", [
  "pendiente",
  "pagado_parcial",
  "pagado",
  "vencido",
  "cobranza",
  "moroso",
]);

export const honorarioFormaPagoEnum = pgEnum("honorario_forma_pago", [
  "efectivo",
  "transferencia",
  "cheque",
  "debito",
  "credito",
  "cuota",
]);

export const diarioOficialTipoEnum = pgEnum("diario_oficial_tipo", [
  "ley",
  "decreto",
  "resolucion",
  "circular",
  "instruccion",
  "acuerdo",
  "convenio",
]);

export const diarioOficialMateriaEnum = pgEnum("diario_oficial_materia", [
  "laboral",
  "civil",
  "penal",
  "tributaria",
  "administrativa",
  "ambiental",
  "otra",
]);

// ─── Users (OAuth) ───────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }).unique(),
  avatar: text("avatar"),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
  hasCompletedOnboarding: boolean("hasCompletedOnboarding")
    .default(false)
    .notNull(),
  consentedAt: timestamp("consentedAt"), // null = no consent yet (Ley 19.628)
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Expedientes (Casos/Carpetas) ────────────────────────────────
export const expedientes = pgTable(
  "expedientes",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codigo: varchar("codigo", { length: 50 }).notNull().unique(),
    nombre: varchar("nombre", { length: 255 }).notNull(),
    descripcion: text("descripcion"),
    materia: materiaEnum("materia").default("laboral").notNull(),
    estado: expedienteEstadoEnum("estado").default("activo").notNull(),
    prioridad: prioridadEnum("prioridad").default("media").notNull(),
    cliente: varchar("cliente", { length: 255 }),
    clienteRut: varchar("clienteRut", { length: 20 }),
    abogadoAsignado: varchar("abogadoAsignado", { length: 255 }),
    asistenteAsignado: varchar("asistenteAsignado", { length: 255 }),
    tribunal: varchar("tribunal", { length: 255 }),
    fechaInicio: date("fechaInicio"),
    fechaEstimadaCierre: date("fechaEstimadaCierre"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    codigoIdx: index("codigo_idx").on(table.codigo),
    materiaIdx: index("materia_idx").on(table.materia),
    estadoIdx: index("estado_idx").on(table.estado),
    userIdIdx: index("expedientes_user_id_idx").on(table.userId),
  })
);

export type Expediente = typeof expedientes.$inferSelect;
export type InsertExpediente = typeof expedientes.$inferInsert;

// ─── Causas ──────────────────────────────────────────────────────
export const causas = pgTable(
  "causas",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rit: varchar("rit", { length: 50 }).notNull(),
    ruc: varchar("ruc", { length: 50 }),
    rol: varchar("rol", { length: 50 }),
    caratula: varchar("caratula", { length: 500 }).notNull(),
    tribunal: varchar("tribunal", { length: 255 }).notNull(),
    comuna: varchar("comuna", { length: 100 }),
    region: varchar("region", { length: 100 }),
    materia: materiaEnum("materia").default("laboral").notNull(),
    estado: causaEstadoEnum("estado").default("tramitacion").notNull(),
    etapa: varchar("etapa", { length: 100 }),
    fechaIngreso: date("fechaIngreso"),
    fechaUltimoMovimiento: date("fechaUltimoMovimiento"),
    litigantes: text("litigantes"),
    abogadoDemandante: varchar("abogadoDemandante", { length: 255 }),
    abogadoDemandado: varchar("abogadoDemandado", { length: 255 }),
    expedienteId: bigint("expedienteId", { mode: "number" }).references(() => expedientes.id, { onDelete: "set null" }),
    estaMonitoreando: boolean("estaMonitoreando").default(true).notNull(),
    fuente: varchar("fuente", { length: 50 })
      .default("consulta_unificada")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    ritIdx: index("rit_idx").on(table.rit),
    rucIdx: index("ruc_idx").on(table.ruc),
    materiaIdx: index("causa_materia_idx").on(table.materia),
    estadoIdx: index("causa_estado_idx").on(table.estado),
    expedienteIdx: index("expediente_idx").on(table.expedienteId),
    userIdIdx: index("causas_user_id_idx").on(table.userId),
  })
);

export type Causa = typeof causas.$inferSelect;
export type InsertCausa = typeof causas.$inferInsert;

// ─── Alertas ─────────────────────────────────────────────────────
export const alertas = pgTable(
  "alertas",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    causaId: bigint("causaId", { mode: "number" }),
    expedienteId: bigint("expedienteId", { mode: "number" }),
    tipo: alertaTipoEnum("tipo").default("nuevo_movimiento").notNull(),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    descripcion: text("descripcion"),
    prioridad: prioridadEnum("prioridad").default("media").notNull(),
    estado: alertaEstadoEnum("estado").default("pendiente").notNull(),
    fechaEvento: date("fechaEvento"),
    fechaVencimiento: date("fechaVencimiento"),
    metadata: jsonb("metadata"),
    leidaAt: timestamp("leidaAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    causaIdx: index("alerta_causa_idx").on(table.causaId),
    expedienteIdx: index("alerta_expediente_idx").on(table.expedienteId),
    tipoIdx: index("tipo_idx").on(table.tipo),
    estadoIdx: index("alerta_estado_idx").on(table.estado),
    prioridadIdx: index("prioridad_idx").on(table.prioridad),
    userIdIdx: index("alertas_user_id_idx").on(table.userId),
  })
);

export type Alerta = typeof alertas.$inferSelect;
export type InsertAlerta = typeof alertas.$inferInsert;

// ─── Tareas ──────────────────────────────────────────────────────
export const tareas = pgTable(
  "tareas",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    descripcion: text("descripcion"),
    causaId: bigint("causaId", { mode: "number" }),
    expedienteId: bigint("expedienteId", { mode: "number" }),
    asignadoA: varchar("asignadoA", { length: 255 }),
    creadoPor: varchar("creadoPor", { length: 255 }),
    tipo: tareaTipoEnum("tipo").default("otra").notNull(),
    estado: tareaEstadoEnum("estado").default("pendiente").notNull(),
    prioridad: prioridadEnum("prioridad").default("media").notNull(),
    fechaVencimiento: date("fechaVencimiento"),
    fechaCompletada: timestamp("fechaCompletada"),
    notas: text("notas"),
    etiquetas: varchar("etiquetas", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    causaIdx: index("tarea_causa_idx").on(table.causaId),
    expedienteIdx: index("tarea_expediente_idx").on(table.expedienteId),
    estadoIdx: index("tarea_estado_idx").on(table.estado),
    asignadoIdx: index("asignado_idx").on(table.asignadoA),
    vencimientoIdx: index("vencimiento_idx").on(table.fechaVencimiento),
    userIdIdx: index("tareas_user_id_idx").on(table.userId),
  })
);

export type Tarea = typeof tareas.$inferSelect;
export type InsertTarea = typeof tareas.$inferInsert;

// ─── Documentos ──────────────────────────────────────────────────
export const documentos = pgTable(
  "documentos",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    tipo: documentoTipoEnum("tipo").default("otro").notNull(),
    causaId: bigint("causaId", { mode: "number" }),
    expedienteId: bigint("expedienteId", { mode: "number" }),
    contenido: text("contenido"),
    url: text("url"),
    numeroDocumento: varchar("numeroDocumento", { length: 100 }),
    fechaDocumento: date("fechaDocumento"),
    tribunalOrigen: varchar("tribunalOrigen", { length: 255 }),
    esPublico: boolean("esPublico").default(true).notNull(),
    fuente: varchar("fuente", { length: 100 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    causaIdx: index("doc_causa_idx").on(table.causaId),
    expedienteIdx: index("doc_expediente_idx").on(table.expedienteId),
    tipoIdx: index("doc_tipo_idx").on(table.tipo),
    userIdIdx: index("documentos_user_id_idx").on(table.userId),
  })
);

export type Documento = typeof documentos.$inferSelect;
export type InsertDocumento = typeof documentos.$inferInsert;

// ─── Cronologia ──────────────────────────────────────────────────
export const cronologia = pgTable(
  "cronologia",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    causaId: bigint("causaId", { mode: "number" }),
    expedienteId: bigint("expedienteId", { mode: "number" }),
    fecha: date("fecha").notNull(),
    hora: varchar("hora", { length: 10 }),
    tipo: cronologiaTipoEnum("tipo").default("otro").notNull(),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    descripcion: text("descripcion"),
    actor: varchar("actor", { length: 255 }),
    documentoId: bigint("documentoId", { mode: "number" }),
    fuente: varchar("fuente", { length: 100 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    causaIdx: index("cron_causa_idx").on(table.causaId),
    expedienteIdx: index("cron_expediente_idx").on(table.expedienteId),
    fechaIdx: index("fecha_idx").on(table.fecha),
    userIdIdx: index("cronologia_user_id_idx").on(table.userId),
  })
);

export type CronologiaItem = typeof cronologia.$inferSelect;
export type InsertCronologiaItem = typeof cronologia.$inferInsert;

// ─── Notas ───────────────────────────────────────────────────────
export const notas = pgTable(
  "notas",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contenido: text("contenido").notNull(),
    causaId: bigint("causaId", { mode: "number" }),
    expedienteId: bigint("expedienteId", { mode: "number" }),
    autor: varchar("autor", { length: 255 }),
    tipo: notaTipoEnum("tipo").default("general").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    causaIdx: index("nota_causa_idx").on(table.causaId),
    expedienteIdx: index("nota_expediente_idx").on(table.expedienteId),
    userIdIdx: index("notas_user_id_idx").on(table.userId),
  })
);

export type Nota = typeof notas.$inferSelect;
export type InsertNota = typeof notas.$inferInsert;

// ─── Checklist Templates ─────────────────────────────────────────
export const checklistTemplates = pgTable(
  "checklist_templates",
  {
    id: serial("id").primaryKey(),
    nombre: varchar("nombre", { length: 255 }).notNull(),
    descripcion: text("descripcion"),
    tipo: checklistTemplateTipoEnum("tipo")
      .default("despido_procedente")
      .notNull(),
    materia: checklistTemplateMateriaEnum("materia")
      .default("laboral")
      .notNull(),
    articulos: varchar("articulos", { length: 500 }),
    leychileUrl: varchar("leychileUrl", { length: 500 }),
    estaActiva: boolean("estaActiva").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tipoIdx: index("ct_tipo_idx").on(table.tipo),
  })
);

export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;

export const checklistItems = pgTable(
  "checklist_items",
  {
    id: serial("id").primaryKey(),
    templateId: bigint("templateId", { mode: "number" }).notNull().references(() => checklistTemplates.id, { onDelete: "cascade" }),
    orden: integer("orden").notNull(),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    descripcion: text("descripcion"),
    articuloLegal: varchar("articuloLegal", { length: 100 }),
    esObligatorio: boolean("esObligatorio").default(true).notNull(),
    categoria: checklistItemCategoriaEnum("categoria")
      .default("otro")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    templateIdx: index("ci_template_idx").on(table.templateId),
  })
);

export type ChecklistItem = typeof checklistItems.$inferSelect;

export const checklistEjecuciones = pgTable(
  "checklist_ejecuciones",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: bigint("templateId", { mode: "number" }).notNull().references(() => checklistTemplates.id),
    causaId: bigint("causaId", { mode: "number" }),
    expedienteId: bigint("expedienteId", { mode: "number" }),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    estado: checklistEjecucionEstadoEnum("estado")
      .default("pendiente")
      .notNull(),
    progreso: integer("progreso").default(0).notNull(),
    creadoPor: varchar("creadoPor", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    templateIdx: index("ce_template_idx").on(table.templateId),
    causaIdx: index("ce_causa_idx").on(table.causaId),
    userIdIdx: index("ce_user_id_idx").on(table.userId),
  })
);

export type ChecklistEjecucion = typeof checklistEjecuciones.$inferSelect;

export const checklistCompletados = pgTable(
  "checklist_completados",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ejecucionId: bigint("ejecucionId", { mode: "number" }).notNull().references(() => checklistEjecuciones.id, { onDelete: "cascade" }),
    itemId: bigint("itemId", { mode: "number" }).notNull().references(() => checklistItems.id, { onDelete: "cascade" }),
    completado: boolean("completado").default(false).notNull(),
    notas: text("notas"),
    completadoPor: varchar("completadoPor", { length: 255 }),
    completadoAt: timestamp("completadoAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    ejecIdx: index("cc_ejec_idx").on(table.ejecucionId),
    userIdIdx: index("cc_user_id_idx").on(table.userId),
  })
);

export type ChecklistCompletado = typeof checklistCompletados.$inferSelect;

// ─── Consultas Programadas ──────────────────────────────────────
export const consultasProgramadas = pgTable(
  "consultas_programadas",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nombre: varchar("nombre", { length: 255 }).notNull(),
    fuente: consultaFuenteEnum("fuente").default("pjud_causas").notNull(),
    parametros: text("parametros").notNull(),
    frecuencia: consultaFrecuenciaEnum("frecuencia").default("diaria").notNull(),
    estaActiva: boolean("estaActiva").default(true).notNull(),
    ultimaEjecucion: timestamp("ultimaEjecucion"),
    proximaEjecucion: timestamp("proximaEjecucion"),
    ultimoResultado: text("ultimoResultado"),
    alertaEmail: boolean("alertaEmail").default(true).notNull(),
    creadoPor: varchar("creadoPor", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    fuenteIdx: index("cp_fuente_idx").on(table.fuente),
    activaIdx: index("cp_activa_idx").on(table.estaActiva),
    userIdIdx: index("cp_user_id_idx").on(table.userId),
  })
);

export type ConsultaProgramada = typeof consultasProgramadas.$inferSelect;

// ─── Actividad Reciente ─────────────────────────────────────────
export const actividadReciente = pgTable(
  "actividad_reciente",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tipo: actividadTipoEnum("tipo").default("causa_creada").notNull(),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    descripcion: text("descripcion"),
    referenciaId: bigint("referenciaId", { mode: "number" }),
    referenciaTipo: varchar("referenciaTipo", { length: 50 }),
    actor: varchar("actor", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tipoIdx: index("ar_tipo_idx").on(table.tipo),
    createdIdx: index("ar_created_idx").on(table.createdAt),
    userIdIdx: index("ar_user_id_idx").on(table.userId),
  })
);

export type ActividadReciente = typeof actividadReciente.$inferSelect;

// ─── Documentos Legales (para RAG) ──────────────────────────────
export const documentosLegales = pgTable("documentos_legales", {
  id: serial("id").primaryKey(),
  titulo: varchar("titulo", { length: 500 }).notNull(),
  contenido: text("contenido").notNull(),
  tipo: documentoLegalTipoEnum("tipo").default("articulo").notNull(),
  norma: varchar("norma", { length: 255 }),
  articulo: varchar("articulo", { length: 100 }),
  url: varchar("url", { length: 500 }),
  etiquetas: varchar("etiquetas", { length: 500 }),
  categoria: documentoLegalCategoriaEnum("categoria")
    .default("laboral")
    .notNull(),
  embedding: text("embedding"),
  estaActiva: boolean("estaActiva").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentoLegal = typeof documentosLegales.$inferSelect;

// ─── Conversaciones RAG ─────────────────────────────────────────
export const conversacionesRag = pgTable("conversaciones_rag", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionId: varchar("sessionId", { length: 100 }).notNull(),
  role: conversacionRoleEnum("role").default("user").notNull(),
  content: text("content").notNull(),
  contexto: text("contexto"),
  fuentes: text("fuentes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConversacionRag = typeof conversacionesRag.$inferSelect;

// ─── Prompts Escritos ───────────────────────────────────────────
export const promptsEscritos = pgTable("prompts_escritos", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  tipo: promptEscritoTipoEnum("tipo").default("escrito").notNull(),
  causaId: bigint("causaId", { mode: "number" }),
  expedienteId: bigint("expedienteId", { mode: "number" }),
  prompt: text("prompt").notNull(),
  respuesta: text("respuesta"),
  contexto: text("contexto"),
  fuentes: text("fuentes"),
  estado: promptEscritoEstadoEnum("estado").default("pendiente").notNull(),
  creadoPor: varchar("creadoPor", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type PromptEscrito = typeof promptsEscritos.$inferSelect;

// ─── Jurisprudencia (Fallos/Sentencias para RAG) ──────────────────
export const jurisprudencias = pgTable(
  "jurisprudencias",
  {
    id: serial("id").primaryKey(),
    rit: varchar("rit", { length: 50 }),
    ruc: varchar("ruc", { length: 50 }),
    caratula: varchar("caratula", { length: 500 }),
    tribunal: varchar("tribunal", { length: 255 }),
    tipo: jurisprudenciaTipoEnum("tipo").default("sentencia").notNull(),
    materia: materiaEnum("materia").default("laboral").notNull(),
    contenido: text("contenido").notNull(),
    extracto: text("extracto"),
    fallo: text("fallo"),
    fundamento: text("fundamento"),
    normasAplicadas: varchar("normasAplicadas", { length: 500 }),
    votacion: varchar("votacion", { length: 50 }),
    fechaSentencia: date("fechaSentencia"),
    fechaPublicacion: date("fechaPublicacion"),
    urlFuente: varchar("urlFuente", { length: 500 }),
    urlDescarga: varchar("urlDescarga", { length: 500 }),
    estaActiva: boolean("estaActiva").default(true).notNull(),
    embeddings: text("embeddings"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    ritIdx: index("juris_rit_idx").on(table.rit),
    tipoIdx: index("juris_tipo_idx").on(table.tipo),
    materiaIdx: index("juris_materia_idx").on(table.materia),
    fechaIdx: index("juris_fecha_idx").on(table.fechaSentencia),
  })
);

export type Jurisprudencia = typeof jurisprudencias.$inferSelect;
export type InsertJurisprudencia = typeof jurisprudencias.$inferInsert;

// ─── Ley Karin (Denuncias de Acoso Laboral) ──────────────────────
export const leykarinDenuncias = pgTable(
  "leykarin_denuncias",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codigo: varchar("codigo", { length: 50 }).notNull().unique(),
    fechaRecepcion: date("fechaRecepcion").notNull(),
    fechaHechos: date("fechaHechos"),
    tipo: leykarinTipoEnum("tipo").default("acoso_laboral").notNull(),
    modo: leykarinModoEnum("modo").default("presencial").notNull(),
    denunciante: varchar("denunciante", { length: 255 }),
    denunciado: varchar("denunciado", { length: 255 }).notNull(),
    rutDenunciante: varchar("rutDenunciante", { length: 20 }),
    rutDenunciado: varchar("rutDenunciado", { length: 20 }),
    area: varchar("area", { length: 100 }),
    cargoDenunciante: varchar("cargoDenunciante", { length: 100 }),
    cargoDenunciado: varchar("cargoDenunciado", { length: 100 }),
    descripcionHechos: text("descripcionHechos").notNull(),
    testigos: text("testigos"),
    evidencia: text("evidencia"),
    estado: leykarinEstadoEnum("estado").default("recepcionada").notNull(),
    prioridad: prioridadEnum("prioridad").default("media").notNull(),
    investigador: varchar("investigador", { length: 255 }),
    fechaInicioInvestigacion: date("fechaInicioInvestigacion"),
    fechaPlazo: date("fechaPlazo"),
    fechaResolucion: date("fechaResolucion"),
    diasPlazo: integer("diasPlazo").default(30),
    medidasCautelares: text("medidasCautelares"),
    medidasDefinitivas: text("medidasDefinitivas"),
    resolucion: text("resolucion"),
    accionesTomadas: text("accionesTomadas"),
    anonimizada: boolean("anonimizada").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    codigoIdx: index("lk_codigo_idx").on(table.codigo),
    estadoIdx: index("lk_estado_idx").on(table.estado),
    prioridadIdx: index("lk_prioridad_idx").on(table.prioridad),
    denunciadoIdx: index("lk_denunciado_idx").on(table.denunciado),
    userIdIdx: index("lk_user_id_idx").on(table.userId),
  })
);

export type LeykarinDenuncia = typeof leykarinDenuncias.$inferSelect;
export type InsertLeykarinDenuncia = typeof leykarinDenuncias.$inferInsert;

// ─── Ley Karin Timeline / Actuaciones ────────────────────────────
export const leykarinActuaciones = pgTable(
  "leykarin_actuaciones",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    denunciaId: bigint("denunciaId", { mode: "number" }).notNull(),
    fecha: date("fecha").notNull(),
    tipo: leykarinActuacionTipoEnum("tipo").default("recepcion").notNull(),
    descripcion: text("descripcion").notNull(),
    actor: varchar("actor", { length: 255 }),
    documento: text("documento"),
    horaInicio: varchar("horaInicio", { length: 10 }),
    horaFin: varchar("horaFin", { length: 10 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    denunciaIdx: index("lkact_denuncia_idx").on(table.denunciaId),
    userIdIdx: index("lkact_user_id_idx").on(table.userId),
  })
);

export type LeykarinActuacion = typeof leykarinActuaciones.$inferSelect;

// ─── Ley Karin Medidas Cautelares ───────────────────────────────
export const leykarinMedidas = pgTable(
  "leykarin_medidas",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    denunciaId: bigint("denunciaId", { mode: "number" }).notNull(),
    tipo: leykarinMedidaTipoEnum("tipo").notNull(),
    descripcion: text("descripcion").notNull(),
    fechaInicio: date("fechaInicio").notNull(),
    fechaFin: date("fechaFin"),
    estado: leykarinMedidaEstadoEnum("estado").default("activa").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    denunciaIdx: index("lkmed_denuncia_idx").on(table.denunciaId),
    estadoIdx: index("lkmed_estado_idx").on(table.estado),
    userIdIdx: index("lkmed_user_id_idx").on(table.userId),
  })
);

export type LeykarinMedida = typeof leykarinMedidas.$inferSelect;
export type InsertLeykarinMedida = typeof leykarinMedidas.$inferInsert;

// ─── Honorarios y Cobranza ───────────────────────────────────────
export const honorarios = pgTable(
  "honorarios",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    causaId: bigint("causaId", { mode: "number" }),
    expedienteId: bigint("expedienteId", { mode: "number" }),
    cliente: varchar("cliente", { length: 255 }).notNull(),
    concepto: varchar("concepto", { length: 255 }).notNull(),
    tipo: honorarioTipoEnum("tipo").default("honorario").notNull(),
    monto: integer("monto").notNull(),
    montoPagado: integer("montoPagado").default(0).notNull(),
    moneda: varchar("moneda", { length: 10 }).default("CLP").notNull(),
    estado: honorarioEstadoEnum("estado").default("pendiente").notNull(),
    formaPago: honorarioFormaPagoEnum("formaPago"),
    numCuotas: integer("numCuotas").default(1),
    cuotaActual: integer("cuotaActual").default(0),
    fechaVencimiento: date("fechaVencimiento"),
    fechaPago: date("fechaPago"),
    facturado: boolean("facturado").default(false).notNull(),
    numeroFactura: varchar("numeroFactura", { length: 50 }),
    observaciones: text("observaciones"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    causaIdx: index("hon_causa_idx").on(table.causaId),
    estadoIdx: index("hon_estado_idx").on(table.estado),
    vencimientoIdx: index("hon_vencimiento_idx").on(table.fechaVencimiento),
    userIdIdx: index("hon_user_id_idx").on(table.userId),
  })
);

export type Honorario = typeof honorarios.$inferSelect;
export type InsertHonorario = typeof honorarios.$inferInsert;

// ─── Diario Oficial (Normas Publicadas) ──────────────────────────
export const diarioOficialNormas = pgTable(
  "diario_oficial_normas",
  {
    id: serial("id").primaryKey(),
    numeroDO: varchar("numeroDO", { length: 50 }),
    fechaPublicacion: date("fechaPublicacion").notNull(),
    tipo: diarioOficialTipoEnum("tipo").default("ley").notNull(),
    organismo: varchar("organismo", { length: 255 }).notNull(),
    titulo: varchar("titulo", { length: 500 }).notNull(),
    extracto: text("extracto"),
    materia: diarioOficialMateriaEnum("materia").default("laboral").notNull(),
    urlOriginal: varchar("urlOriginal", { length: 500 }),
    numeroNorma: varchar("numeroNorma", { length: 100 }),
    anoNorma: integer("anoNorma"),
    vigente: boolean("vigente").default(true).notNull(),
    articulosRelevantes: text("articulosRelevantes"),
    alertaGenerada: boolean("alertaGenerada").default(false).notNull(),
    procesadoRag: boolean("procesadoRag").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    fechaIdx: index("do_fecha_idx").on(table.fechaPublicacion),
    materiaIdx: index("do_materia_idx").on(table.materia),
    tipoIdx: index("do_tipo_idx").on(table.tipo),
    uniqueNumeroTipo: unique("diario_oficial_numero_tipo_idx").on(table.numeroNorma, table.tipo),
  })
);

export type DiarioOficialNorma = typeof diarioOficialNormas.$inferSelect;
export type InsertDiarioOficialNorma = typeof diarioOficialNormas.$inferInsert;

// ─── Organizations ───────────────────────────────────────────────
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  plan: varchar("plan", { length: 50 }).default("free").notNull(),
  logoUrl: text("logoUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ─── Org Members ─────────────────────────────────────────────────
export const orgMembers = pgTable(
  "org_members",
  {
    id: serial("id").primaryKey(),
    orgId: bigint("orgId", { mode: "number" })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: bigint("userId", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").default("member").notNull(),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  },
  (table) => ({
    uniqueOrgUser: unique("unique_org_user").on(table.orgId, table.userId),
    orgIdIdx: index("org_members_org_idx").on(table.orgId),
    userIdIdx: index("org_members_user_idx").on(table.userId),
  })
);

export type OrgMember = typeof orgMembers.$inferSelect;
export type InsertOrgMember = typeof orgMembers.$inferInsert;

// ─── Invites ─────────────────────────────────────────────────────
export const invites = pgTable(
  "invites",
  {
    id: serial("id").primaryKey(),
    orgId: bigint("orgId", { mode: "number" })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    invitedByUserId: bigint("invitedByUserId", { mode: "number" })
      .notNull()
      .references(() => users.id),
    email: varchar("email", { length: 320 }).notNull(),
    role: orgRoleEnum("role").default("member").notNull(),
    token: varchar("token", { length: 64 }).notNull().unique(), // nanoid(32) token
    status: inviteStatusEnum("status").default("pending").notNull(),
    expiresAt: timestamp("expiresAt").notNull(), // createdAt + 7 days
    acceptedAt: timestamp("acceptedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: index("invites_token_idx").on(table.token),
    orgEmailIdx: index("invites_org_email_idx").on(table.orgId, table.email),
  })
);

export type Invite = typeof invites.$inferSelect;
export type InsertInvite = typeof invites.$inferInsert;
