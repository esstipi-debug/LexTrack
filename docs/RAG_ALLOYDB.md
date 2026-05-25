# RAG en AlloyDB (GCP) — LexTrack

Guía genérica para usar **AlloyDB** (PostgreSQL + pgvector) como almacén del índice RAG de LexTrack (`rag_chunks`).

> **Importante:** cada producto/proyecto debe tener su **propia** instancia AlloyDB (o Neon/Postgres) y su propia `RAG_DATABASE_URL`. No reutilices la base de otro proyecto.

## Conexión desde desarrollo (IP pública)

1. En GCP → AlloyDB → tu instancia → **Redes** → **Redes externas autorizadas**: agrega la IP pública de tu PC.
2. Copia host, puerto, usuario y base desde la consola (IP pública + **SSL requerido**).
3. En `.env` de **este** repo (raíz, no commitear):

```env
RAG_DATABASE_URL=postgresql://USUARIO:CONTRASEÑA@HOST_PUBLICO:5432/NOMBRE_DB?sslmode=require
```

4. Verificar:

```bash
npm run rag:apply-schema
npm run rag:verify-db
```

## Conexión desde VPC (Private Service Connect)

Si la app corre en GCP con PSC, usa el **nombre DNS PSC** de la instancia (visible en consola → Redes), no la IP pública. Misma URL con `sslmode=require`.

## Qué debe existir en la base de LexTrack

| Paso | Comando / archivo |
|------|-------------------|
| Esquema | `db/neon-setup.sql` o `npm run rag:apply-schema` |
| Datos + vectores | `npm run rag:ingest` (MySQL app + `VOYAGE_API_KEY`) |
| Comprobar filas | `npm run rag:verify-db` o `SELECT COUNT(*) FROM rag_chunks;` |

## Seguridad

- No subas `.env` a Git.
- No uses `RAG_DATABASE_URL` de otro producto: mezclarías corpus y costos.

## Más contexto

- [RAG_SETUP.md](./RAG_SETUP.md) — flujo Neon / Docker (mismo esquema `rag_chunks`)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — pipeline híbrido
