import { relations } from "drizzle-orm";
import {
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
} from "./schema";

export const expedientesRelations = relations(expedientes, ({ many }) => ({
  causas: many(causas),
  alertas: many(alertas),
  tareas: many(tareas),
  documentos: many(documentos),
  cronologia: many(cronologia),
  notas: many(notas),
  checklistEjecuciones: many(checklistEjecuciones),
}));

export const causasRelations = relations(causas, ({ one, many }) => ({
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
  ({ many }) => ({
    actuaciones: many(leykarinActuaciones),
  })
);

export const leykarinActuacionesRelations = relations(
  leykarinActuaciones,
  ({ one }) => ({
    denuncia: one(leykarinDenuncias, {
      fields: [leykarinActuaciones.denunciaId],
      references: [leykarinDenuncias.id],
    }),
  })
);
