import { relations } from "drizzle-orm";
import {
  users,
  causas,
  expedientes,
  alertas,
  tareas,
  documentos,
  cronologia,
  notas,
  checklistTemplates,
  checklistItems,
  checklistEjecuciones,
  checklistCompletados,
  leykarinDenuncias,
  leykarinActuaciones,
  organizations,
  orgMembers,
  invites,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  expedientes: many(expedientes),
  causas: many(causas),
  alertas: many(alertas),
  tareas: many(tareas),
  documentos: many(documentos),
  cronologia: many(cronologia),
  notas: many(notas),
  checklistEjecuciones: many(checklistEjecuciones),
  checklistCompletados: many(checklistCompletados),
  leykarinDenuncias: many(leykarinDenuncias),
  leykarinActuaciones: many(leykarinActuaciones),
  orgMembers: many(orgMembers),
}));

export const expedientesRelations = relations(expedientes, ({ one, many }) => ({
  user: one(users, { fields: [expedientes.userId], references: [users.id] }),
  causas: many(causas),
  alertas: many(alertas),
  tareas: many(tareas),
  documentos: many(documentos),
  cronologia: many(cronologia),
  notas: many(notas),
  checklistEjecuciones: many(checklistEjecuciones),
}));

export const causasRelations = relations(causas, ({ one, many }) => ({
  user: one(users, { fields: [causas.userId], references: [users.id] }),
  expediente: one(expedientes, {
    fields: [causas.expedienteId],
    references: [expedientes.id],
  }),
  alertas: many(alertas),
  tareas: many(tareas),
  documentos: many(documentos),
  cronologia: many(cronologia),
  notas: many(notas),
  checklistEjecuciones: many(checklistEjecuciones),
}));

export const alertasRelations = relations(alertas, ({ one }) => ({
  user: one(users, { fields: [alertas.userId], references: [users.id] }),
  causa: one(causas, {
    fields: [alertas.causaId],
    references: [causas.id],
  }),
  expediente: one(expedientes, {
    fields: [alertas.expedienteId],
    references: [expedientes.id],
  }),
}));

export const tareasRelations = relations(tareas, ({ one }) => ({
  user: one(users, { fields: [tareas.userId], references: [users.id] }),
  causa: one(causas, {
    fields: [tareas.causaId],
    references: [causas.id],
  }),
  expediente: one(expedientes, {
    fields: [tareas.expedienteId],
    references: [expedientes.id],
  }),
}));

export const documentosRelations = relations(documentos, ({ one }) => ({
  user: one(users, { fields: [documentos.userId], references: [users.id] }),
  causa: one(causas, {
    fields: [documentos.causaId],
    references: [causas.id],
  }),
  expediente: one(expedientes, {
    fields: [documentos.expedienteId],
    references: [expedientes.id],
  }),
}));

export const cronologiaRelations = relations(cronologia, ({ one }) => ({
  user: one(users, { fields: [cronologia.userId], references: [users.id] }),
  causa: one(causas, {
    fields: [cronologia.causaId],
    references: [causas.id],
  }),
  expediente: one(expedientes, {
    fields: [cronologia.expedienteId],
    references: [expedientes.id],
  }),
}));

export const notasRelations = relations(notas, ({ one }) => ({
  user: one(users, { fields: [notas.userId], references: [users.id] }),
  causa: one(causas, {
    fields: [notas.causaId],
    references: [causas.id],
  }),
  expediente: one(expedientes, {
    fields: [notas.expedienteId],
    references: [expedientes.id],
  }),
}));

export const checklistTemplatesRelations = relations(
  checklistTemplates,
  ({ many }) => ({
    items: many(checklistItems),
    ejecuciones: many(checklistEjecuciones),
  })
);

export const checklistItemsRelations = relations(
  checklistItems,
  ({ one, many }) => ({
    template: one(checklistTemplates, {
      fields: [checklistItems.templateId],
      references: [checklistTemplates.id],
    }),
    completados: many(checklistCompletados),
  })
);

export const checklistEjecucionesRelations = relations(
  checklistEjecuciones,
  ({ one, many }) => ({
    user: one(users, {
      fields: [checklistEjecuciones.userId],
      references: [users.id],
    }),
    template: one(checklistTemplates, {
      fields: [checklistEjecuciones.templateId],
      references: [checklistTemplates.id],
    }),
    causa: one(causas, {
      fields: [checklistEjecuciones.causaId],
      references: [causas.id],
    }),
    expediente: one(expedientes, {
      fields: [checklistEjecuciones.expedienteId],
      references: [expedientes.id],
    }),
    completados: many(checklistCompletados),
  })
);

export const checklistCompletadosRelations = relations(
  checklistCompletados,
  ({ one }) => ({
    user: one(users, {
      fields: [checklistCompletados.userId],
      references: [users.id],
    }),
    ejecucion: one(checklistEjecuciones, {
      fields: [checklistCompletados.ejecucionId],
      references: [checklistEjecuciones.id],
    }),
    item: one(checklistItems, {
      fields: [checklistCompletados.itemId],
      references: [checklistItems.id],
    }),
  })
);

export const leykarinDenunciasRelations = relations(
  leykarinDenuncias,
  ({ one, many }) => ({
    user: one(users, {
      fields: [leykarinDenuncias.userId],
      references: [users.id],
    }),
    actuaciones: many(leykarinActuaciones),
  })
);

export const leykarinActuacionesRelations = relations(
  leykarinActuaciones,
  ({ one }) => ({
    user: one(users, {
      fields: [leykarinActuaciones.userId],
      references: [users.id],
    }),
    denuncia: one(leykarinDenuncias, {
      fields: [leykarinActuaciones.denunciaId],
      references: [leykarinDenuncias.id],
    }),
  })
);

export const organizationsRelations = relations(
  organizations,
  ({ many }) => ({
    members: many(orgMembers),
    invites: many(invites),
  })
);

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgMembers.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [orgMembers.userId],
    references: [users.id],
  }),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
  organization: one(organizations, {
    fields: [invites.orgId],
    references: [organizations.id],
  }),
  invitedByUser: one(users, {
    fields: [invites.invitedByUserId],
    references: [users.id],
  }),
}));
