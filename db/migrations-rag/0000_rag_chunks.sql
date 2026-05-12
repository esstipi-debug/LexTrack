-- Ejecutar contra Postgres con extensión pgvector ya creada (ver db/docker/init-pgvector.sql).
CREATE TABLE IF NOT EXISTS rag_chunks (
  id text PRIMARY KEY NOT NULL,
  source text NOT NULL,
  titulo text,
  norma text,
  articulo text,
  rol text,
  tribunal text,
  fecha text,
  contenido text NOT NULL,
  contenido_normalizado text,
  metadata jsonb,
  embedding vector(1024) NOT NULL
);

CREATE INDEX IF NOT EXISTS rag_chunks_source_idx ON rag_chunks (source);
CREATE INDEX IF NOT EXISTS rag_chunks_fts_idx ON rag_chunks USING gin (to_tsvector('spanish', contenido));
