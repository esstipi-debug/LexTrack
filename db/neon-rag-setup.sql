-- ────────────────────────────────────────────────────────────────
-- LexTrack: Neon RAG Setup Script
-- PostgreSQL + pgvector para búsqueda semántica legal
-- Ejecutar en: neon.tech → SQL Editor
-- ────────────────────────────────────────────────────────────────

-- 1. Habilitar pgvector (ya viene en Neon, es idempotente)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabla principal: chunks de documentos legales + embeddings
CREATE TABLE IF NOT EXISTS rag_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Origen del documento
    source_type     VARCHAR(50)  NOT NULL,  -- 'codigo_trabajo', 'ley_especial', 'norma_general', 'protocolo'
    source_id       VARCHAR(255) NOT NULL,  -- ID único dentro de la fuente (ej: articulo_5_art.3)
    source_url      TEXT,                  -- URL si el documento es accesible públicamente

    -- Contenido del chunk
    title           VARCHAR(500) NOT NULL,
    content         TEXT         NOT NULL,
    content_md5     CHAR(32)     NOT NULL,  -- para detectar duplicados

    -- Embedding: vector de text-embedding-3-small (OpenAI) = 1536 dimensiones
    embedding       vector(1536),

    -- Metadata estructurada para filtrar antes/después de búsqueda vectorial
    metadata        JSONB DEFAULT '{}'::jsonb,

    -- Índices de utilidad
    UNIQUE (source_type, source_id)
);

-- 3. Índice HNSW para búsqueda rápida por similitud coseno
-- Usa ~1–2 GB de RAM, buen trade-off velocidad/precisión
CREATE INDEX IF NOT EXISTS idx_rag_documents_embedding
    ON rag_documents
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 4. Índice GIN sobre metadata JSONB para filtros
CREATE INDEX IF NOT EXISTS idx_rag_documents_metadata
    ON rag_documents
    USING gin (metadata);

-- 5. Tabla de log de queries (para analytics y tuning del RAG)
CREATE TABLE IF NOT EXISTS rag_query_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    query_text   TEXT NOT NULL,
    query_embedding vector(1536),
    top_k        INT NOT NULL DEFAULT 5,
    filters      JSONB DEFAULT '{}'::jsonb,
    result_count INT NOT NULL DEFAULT 0,
    latency_ms   INT,
    session_id   VARCHAR(100)
);

-- 6. Índice sobre created_at para purga/cleanup periódica del log
CREATE INDEX IF NOT EXISTS idx_rag_query_logs_created_at
    ON rag_query_logs (created_at DESC);

-- 7. Función SQL reutilizable: búsqueda por similitud + filtros JSONB
-- Uso desde Node.js (pg): SELECT * FROM match_documents($1, $2, $3)
CREATE OR REPLACE FUNCTION match_documents(
    p_embedding     vector(1536),
    p_top_k         INT DEFAULT 5,
    p_filters       JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    id          UUID,
    source_type VARCHAR,
    source_id   VARCHAR,
    title       VARCHAR,
    content     TEXT,
    similarity  DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.source_type,
        d.source_id,
        d.title,
        d.content,
        1 - (d.embedding <=> p_embedding) AS similarity
    FROM rag_documents d
    WHERE
        -- Filtro base: solo registros con embedding
        d.embedding IS NOT NULL
        -- Filtros dinámicos por clave JSONB (si el usuario pasó filtros)
        AND (p_filters = '{}'::jsonb OR (
            (p_filters ? 'source_type') 
                AND d.source_type = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filters->'source_type')))
            OR NOT (p_filters ? 'source_type')
        ))
    ORDER BY d.embedding <=> p_embedding
    LIMIT p_top_k;
END;
$$ LANGUAGE plpgsql;

-- 8. Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rag_documents_updated_at ON rag_documents;
CREATE TRIGGER trg_rag_documents_updated_at
    BEFORE UPDATE ON rag_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
