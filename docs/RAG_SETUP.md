# RAG en Postgres (Neon u otro Postgres)

## 1. Variables en `.env` (no subir a Git)

Copia `.env.example` → `.env` y completa:

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | MySQL de la app (origen del corpus al ingerir). |
| `RAG_DATABASE_URL` | Postgres con pgvector (Neon u otro). |
| `VOYAGE_API_KEY` | Obligatorio para `npm run rag:ingest`. |

**Neon:** en el dashboard copia la connection string y pégala solo en `.env`. Si Node falla al conectar, prueba **quitar** `channel_binding=require` de la URL y deja `sslmode=require`.

## 2. Crear tablas en Neon

**Opción A — desde tu PC (recomendado):** con `RAG_DATABASE_URL` ya en `.env`:

```bash
npm run rag:apply-schema
npm run rag:verify-db
```

**Opción B — SQL Editor en Neon:** pegá **`db/neon-setup.sql`** y ejecutá todo.

Esto crea la extensión `vector`, la tabla `rag_chunks` (vectores dimensión **1024**, alineado con `voyage-law-2`), índice **GIN** para FTS en español e índice **HNSW** sobre `embedding` para acelerar `ORDER BY embedding <=> …` ([pgvector en Neon](https://neon.tech/docs/extensions/pgvector)).

Si ya creaste la tabla antes sin índice vectorial, ejecutá solo:

```sql
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_hnsw_idx ON rag_chunks USING hnsw (embedding vector_cosine_ops);
```

## 3. Verificar conexión desde el repo

```bash
npm run rag:verify-db
```

Debe mostrar extensión `vector`, tabla `rag_chunks` y el recuento de filas (0 hasta que ingieras).

## 4. Ingerir corpus (MySQL → Postgres)

Con MySQL accesible y `VOYAGE_API_KEY` configurado:

```bash
npm run rag:ingest
```

## 5. Comprobar el chat

Con datos en `rag_chunks`, el endpoint `rag.chat` usará el pipeline híbrido si hay `VOYAGE_API_KEY`. Opcional: `ANTHROPIC_API_KEY` para respuesta con Claude.

## Seguridad

Si alguna vez pegaste la URL con usuario/contraseña en un chat o issue, **rotá la contraseña** en Neon y actualizá solo tu `.env` local.
