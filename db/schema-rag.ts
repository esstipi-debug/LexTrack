/**
 * Schema Drizzle solo para Postgres RAG (`rag_chunks`).
 * La app principal sigue en MySQL; esta tabla vive en DATABASE_URL de tipo Postgres.
 */
import { jsonb, pgTable, text, customType } from "drizzle-orm/pg-core";

const vector1024 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1024)";
  },
});

export const ragChunks = pgTable("rag_chunks", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  titulo: text("titulo"),
  norma: text("norma"),
  articulo: text("articulo"),
  rol: text("rol"),
  tribunal: text("tribunal"),
  fecha: text("fecha"),
  contenido: text("contenido").notNull(),
  contenidoNormalizado: text("contenido_normalizado"),
  metadata: jsonb("metadata"),
  embedding: vector1024("embedding").notNull(),
});

export type RagChunkRow = typeof ragChunks.$inferSelect;
