# RAG en Postgres (Neon u otro Postgres)

## Dónde está cada cosa en este repo

La **raíz del proyecto LexTrack** es la carpeta que contiene el archivo **`package.json`** (no una subcarpeta como `api/` ni `src/`).

Ejemplo en tu PC:

```text
C:\Users\Gamer\Documents\GitHub\LexTrack\    ← carpeta raíz (aquí abrís la terminal)
├── package.json                           ← si ves este archivo, estás en la raíz
├── .env.example                           ← plantilla de variables (sí va a Git)
├── .env                                   ← TUS secretos SOLO aquí (NO va a Git; créalo vos)
├── db\
│   └── neon-setup.sql                     ← SQL que crea extensión vector + tabla rag_chunks
├── scripts\
│   ├── apply-rag-schema.ts                ← lo usa `npm run rag:apply-schema`
│   ├── verify-rag-db.ts                   ← lo usa `npm run rag:verify-db`
│   └── ingest-rag-chunks.ts               ← lo usa `npm run rag:ingest`
└── docs\
    └── RAG_SETUP.md                       ← este archivo
```

**Regla:** todos los comandos `npm run …` de esta guía se ejecutan **desde la raíz** (la carpeta donde está `package.json`). Si ejecutás `npm` desde `db\` o `scripts\`, fallará.

---

## 1. Crear y editar `.env` en la raíz

1. Abrí la carpeta raíz LexTrack en el Explorador de archivos o en Cursor (**File → Open Folder** → elegís `LexTrack`).
2. Si **no** existe un archivo llamado **`.env`** en esa misma carpeta que `package.json`:
   - Copiá el archivo **`.env.example`** y renombrá la copia a **`.env`**  
     (en Windows: clic derecho → copiar → pegar → renombrar a `.env`).
3. Abrí **`.env`** con Cursor o un editor de texto.
4. Agregá o completá una línea **exactamente** con este nombre de variable (sin espacios alrededor del `=`):

   ```env
   RAG_DATABASE_URL=postgresql://USUARIO:CONTRASEÑA@HOST/neondb?sslmode=require
   ```

   Pegá ahí la connection string que te da Neon (Dashboard → tu proyecto → **Connection string** → Postgres).

   - Si al ejecutar los scripts más abajo **falla la conexión**, probá **borrar** de la URL el fragmento `channel_binding=require` y dejá solo `sslmode=require`.
5. **No subas `.env` a Git.** Este archivo ya está listado en `.gitignore`; solo vive en tu disco.

Otras variables que vas a necesitar más adelante (misma carpeta, mismo archivo `.env`):

| Variable | Archivo donde se define | Uso |
|----------|-------------------------|-----|
| `RAG_DATABASE_URL` | `.env` en la raíz | Postgres Neon (índice RAG). |
| `DATABASE_URL` | `.env` en la raíz | MySQL de la app (para `npm run rag:ingest`). |
| `VOYAGE_API_KEY` | `.env` en la raíz | Embeddings al ingerir (`rag:ingest`). |

---

## 2. Terminal en la carpeta correcta (Windows)

1. Abrí **PowerShell** o la terminal integrada de **Cursor** (**Terminal → New Terminal**).
2. Cambiá al directorio raíz del repo (ajustá la ruta si tu usuario o carpeta es distinta):

   ```powershell
   cd C:\Users\Gamer\Documents\GitHub\LexTrack
   ```

3. Comprobá que estás en el lugar correcto:

   ```powershell
   dir package.json
   ```

   Si dice que no encuentra el archivo, **no** estás en la raíz; repetí el `cd` hasta la carpeta que tiene `package.json`.

---

## 3. Crear tablas en Neon (esquema RAG)

**Opción A — desde tu PC (recomendado)**  
Con `RAG_DATABASE_URL` ya guardado en **`.env`** (paso 1), en la misma terminal (raíz del proyecto):

```powershell
npm run rag:apply-schema
npm run rag:verify-db
```

- **`rag:apply-schema`** lee el archivo **`db\neon-setup.sql`** y lo ejecuta contra Neon.
- **`rag:verify-db`** comprueba extensión `vector`, tabla `rag_chunks` y cantidad de filas.

**Opción B — Neon SQL Editor**  
En el dashboard de Neon → **SQL Editor**: pegá el contenido del archivo **`db/neon-setup.sql`** del repo y ejecutá todo.

Esto crea la extensión `vector`, la tabla `rag_chunks` (vectores dimensión **1024**, alineado con `voyage-law-2`), índice **GIN** para FTS en español e índice **HNSW** sobre `embedding` ([pgvector en Neon](https://neon.tech/docs/extensions/pgvector)).

Si ya habías creado la tabla antes sin índice vectorial:

```sql
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_hnsw_idx ON rag_chunks USING hnsw (embedding vector_cosine_ops);
```

---

## 4. Ingerir corpus (MySQL → Postgres)

Con **`DATABASE_URL`** (MySQL) y **`VOYAGE_API_KEY`** en **`.env`**, desde la raíz:

```powershell
npm run rag:ingest
```

---

## 5. Comprobar el chat de la app

Con datos en `rag_chunks`, `rag.chat` usará el pipeline híbrido si existe **`VOYAGE_API_KEY`**. Opcional: **`ANTHROPIC_API_KEY`** para respuesta con Claude.

---

## Seguridad

Si pegaste la URL con usuario y contraseña en un chat público o issue, **rotá la contraseña** en Neon y actualizá solo tu **`.env`** local.
