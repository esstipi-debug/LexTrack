# RAG en Postgres (Neon u otro Postgres)

## Solo esto — qué hacer y en qué orden

**Meta:** que LexTrack pueda usar tu base **Neon** para el RAG (vectores). Eso implica: (1) guardar la dirección de Neon en un archivo en tu PC, (2) crear las tablas en Neon, (3) más tarde copiar los datos desde MySQL.

| Paso | Dónde lo hacés | Qué hacés |
|------|----------------|-----------|
| **1** | En **GitHub Desktop / Cursor / Explorador**: carpeta **`LexTrack`** (donde está **`package.json`**) | Abrís esa carpeta como proyecto. Si no sabés cuál es: en Cursor **Archivo → Abrir carpeta** y elegís `...\Documents\GitHub\LexTrack`. |
| **2** | En esa misma carpeta (al lado de `package.json`) | Creás el archivo **`.env`** si no existe: copiá **`.env.example`** y renombrá la copia a **`.env`** (solo la palabra `.env`, con el punto adelante). |
| **3** | En la página web **neon.tech** (tu proyecto Neon) | Copiás la **connection string** de Postgres (menú tipo “Connection string”). |
| **4** | Dentro del archivo **`.env`** en tu PC (abrilo con Cursor: clic en el archivo) | Pegás **una línea nueva**: `RAG_DATABASE_URL=` y pegás la URL que copiaste de Neon. Sin comillas. Guardás el archivo (**Ctrl+S**). |
| **5** | En Cursor: menú **Terminal → Nueva terminal** | La terminal debe estar **dentro** del proyecto. Si no estás seguro, escribí: `cd` espacio y arrastrá la carpeta `LexTrack` a la terminal y Enter (Windows te pone la ruta sola). |
| **6** | En esa terminal | Ejecutás primero: `npm run rag:apply-schema` → crea tablas en Neon leyendo `db/neon-setup.sql`. Después: `npm run rag:verify-db` → debe decir OK y cuántas filas hay (al principio **0**). |
| **7** | Cuando tengas MySQL funcionando y una API key de Voyage | En el mismo **`.env`** completás `DATABASE_URL` (MySQL) y `VOYAGE_API_KEY`. En la terminal: `npm run rag:ingest` → copia textos/embeddings a Neon. |

Si algo falla al conectar, probá en la URL de Neon **quitar** `channel_binding=require` y dejar `sslmode=require`.

### Esquema canónico de este repo (no mezclar con otros tutoriales)

LexTrack usa la tabla **`rag_chunks`** y vectores de **1024** dimensiones (modelo **`voyage-law-2`** en `.env.example`).  
Si ves en otro lado un SQL con **`rag_documents`**, **`vector(1536)`** o funciones tipo **`match_documents()`** de otro tutorial, **no** lo uses con este código sin adaptar todo el backend: aquí el archivo correcto es **`db/neon-setup.sql`**.

---

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
