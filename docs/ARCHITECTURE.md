# LexTrack — Arquitectura técnica

## 1. Estado actual vs target

### Hoy (al 2026-05-10)
- React+TS+Vite, Hono+tRPC, Drizzle+**MySQL**, Radix UI.
- `api/rag-router.ts`: **TF-IDF por keywords**, sin embeddings, sin LLM, respuestas por template.
- Corpus cargado en `db/seed/`: 195 art. CT + leyes especiales + jurisprudencia, chunked por artículo. **Esta parte está bien.**
- Routers scaffoldeados: causa, alerta, diariooficial, generador, honorario, jurisprudencia, leykarin, tarea, rag.

### Target
- Postgres 16 + **pgvector** + tsvector ES.
- Retrieval **híbrido**: BM25 + embeddings + reranker.
- LLM con **tool use** y verificador de citas.
- **Scraping centralizado** (un worker, base compartida).

## 2. Stack target

```
Frontend:    React 19 + Vite + Tailwind + shadcn/ui  (sin cambios)
Backend:     Hono + tRPC                              (sin cambios)
ORM:         Drizzle                                  (sin cambios)
DB:          Postgres 16 + pgvector                   ← MIGRAR desde MySQL
Embeddings:  Voyage `voyage-law-2`                    ← legal-specific
LLM:         Anthropic Claude Sonnet 4.6 + tool use
Reranker:    Cohere rerank-multilingual-v3
Storage:     S3 (ya está)
Auth:        ya está (jose + cookies)
Pagos:       Stripe + dLocal (CLP)
Email:       Resend
Analytics:   PostHog
Scraping:    Worker Node + Playwright (headless)
```

## 3. RAG híbrido — diseño

### Chunking
- **1 chunk = 1 artículo del Código del Trabajo.**
- Jurisprudencia: chunk = considerandos relevantes + caratula + rol + tribunal + fecha.
- Dictámenes DT: chunk = ordinario completo (suelen ser cortos).

### Metadata por chunk
```ts
{
  id: string,
  source: 'CT' | 'ley_especial' | 'jurisprudencia' | 'dictamen_DT',
  // CT / ley:
  libro?: string,        // "I", "II", "III"...
  titulo?: string,       // "Del Contrato Individual"
  articulo?: number,     // 162
  vigencia: { desde: Date, hasta?: Date },
  ley_modificatoria?: string,
  // Jurisprudencia:
  rol?: string,
  tribunal?: string,
  fecha?: Date,
  materia?: string[],    // ["despido_injustificado", "tutela"]
  // Embedding y FTS:
  embedding: vector(1024),
  fts: tsvector,
  contenido: text,
  contenido_normalizado: text,
}
```

### Pipeline de query
```
User query
   │
   ├──> BM25 (Postgres tsvector ES)  → top 20
   ├──> Embedding (Voyage)            → top 20 (cosine)
   │
   ▼
Union → 30-40 chunks únicos
   │
   ▼
Cohere rerank-multilingual-v3 → top 5-8
   │
   ▼
Claude Sonnet 4.6
   - System prompt: "Solo cita artículos presentes en <chunks>. Si no hay
     fuente, di 'no encuentro fuente'. Cada afirmación lleva [Art. X CT] o
     [Rol N° / Tribunal / fecha]."
   - User: pregunta original
   - Context: <chunks> top-k
   │
   ▼
Verificador post-gen
   - Extrae cada [Art. X] y [Rol N°] de la respuesta.
   - Verifica que exista en chunks recuperados.
   - Si no existe → reintento con prompt correctivo o marca "sin fuente".
   │
   ▼
Respuesta + lista de fuentes citadas (clickeables)
```

### Por qué híbrido (no solo vectorial)
El abogado escribe "art. 162" y espera el art. 162 exacto. BM25 lo resuelve trivialmente. Embeddings solo fallarían en "el del despido por necesidades de la empresa". Híbrido = lo mejor de ambos.

## 4. Scraping centralizado

```
┌─────────────────────────────────────────┐
│  Worker scraper (cron, fuera del web)   │
│                                          │
│  ├─ Diario Oficial    (diario, 06:00)   │
│  ├─ Poder Judicial    (semanal, lunes)  │
│  └─ Dirección Trabajo (semanal)         │
└──────────────┬──────────────────────────┘
               │
               ▼
       ┌───────────────┐
       │  Normalizer   │  HTML/PDF → texto limpio
       └───────┬───────┘
               │
               ▼
       ┌───────────────┐
       │  Chunker      │  por artículo / considerando / ordinario
       └───────┬───────┘
               │
               ▼
       ┌───────────────┐
       │  Embedder     │  Voyage voyage-law-2 (batch)
       └───────┬───────┘
               │
               ▼
       ┌───────────────┐
       │  Postgres     │  upsert por (source, source_id)
       │  + pgvector   │
       └───────────────┘
               │
               ▼
    Consultado por TODOS los usuarios
```

**Reglas:**
- 1 IP, rate limit conservador (no quemar Poder Judicial).
- Robots.txt respetado donde aplique.
- Atribución a fuente original en cada cita.
- Re-embed solo cuando cambia versión del modelo de embeddings.

## 5. Verificador de citas (anti-alucinación)

```ts
function verifyCitations(response: string, retrievedChunks: Chunk[]): VerificationResult {
  const articleCites = extractMatches(response, /\[Art\.\s*(\d+(?:\s*bis)?)\s*(CT|del\s+CT)?\]/gi);
  const rolCites = extractMatches(response, /\[Rol\s*N°?\s*([\d\-]+)/gi);

  const knownArticles = new Set(retrievedChunks
    .filter(c => c.source === 'CT' || c.source === 'ley_especial')
    .map(c => c.articulo));

  const knownRoles = new Set(retrievedChunks
    .filter(c => c.source === 'jurisprudencia')
    .map(c => c.rol));

  const invalid = [
    ...articleCites.filter(a => !knownArticles.has(a)),
    ...rolCites.filter(r => !knownRoles.has(r)),
  ];

  return { ok: invalid.length === 0, invalid };
}
```

Si `ok === false`:
1. Reintento (1 vez) con `system += "Las citas X, Y, Z no son válidas. Solo usa fuentes presentes en <chunks>."`
2. Si vuelve a fallar → responder con la versión sin las citas inválidas + warning UI.

## 6. Migración MySQL → Postgres

**Plan:**
1. Levantar Postgres 16 con `pgvector` y `tsearch2` (español).
2. Reescribir `db/schema.ts` con tipos de Drizzle para pg (`pgTable` en vez de `mysqlTable`).
3. Adaptar `db/seed/*.ts` (cambios mínimos, son data).
4. Re-ingestar corpus: chunk → embed → insert.
5. Mantener Drizzle para auth/usuarios/causas; agregar tabla `chunks` con vector + tsvector.

**Por qué Postgres:** pgvector + FTS ES en una sola DB. MySQL vectorial es inmaduro.

## 7. Costos por usuario (Plan Solo, CLP)

| Concepto | Cálculo | CLP/mes |
|---|---|---|
| Claude Sonnet | 200 queries × ~CLP 40 | 8.000 |
| Embeddings (query side) | 200 × ~CLP 2 | 500 |
| Postgres + hosting prorrateado | shared | 2.000 |
| Stripe + dLocal fees | ~5% | 2.500 |
| **Total variable** | | **~13.000** |
| **Precio cobrado** | | **59.000** |
| **Margen bruto** | | **~78%** |

Scraping y embeddings de corpus son **costo fijo** (~CLP 15.000/mes total para el SaaS), no escalan con usuarios.
