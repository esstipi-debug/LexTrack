# LexTrack — Contexto para Claude Code

## Qué es

SaaS legaltech chileno para abogados laboralistas. Plataforma operativa con agente AI (20 tools Claude tool-use), RAG híbrido (BM25+vector+rerank), 11 servicios con backend+frontend, gestión de causas, Ley Karin, cobranza, y scraper PJUD.

## Stack

```
Frontend:   React 19 + Vite 7 + Tailwind + shadcn/ui (40+ componentes)
Backend:    Hono 4.8 + tRPC 11.8 + Drizzle ORM 0.45
DB App:     MySQL (mysql2) — migrando a Postgres
DB RAG:     Postgres 16 + pgvector + tsearch2
Auth:       OAuth 2.0 (jose + cookies) con Kimi
AI:         Anthropic Claude (tool-use) + Voyage voyage-law-2 + Cohere rerank-v3
```

## Estructura clave

```
api/agent-router.ts      # Agente Claude con 20 tools (archivo más grande, ~1500 líneas)
api/lib/rag/             # Pipeline RAG: pg-hybrid.ts, llm-answer.ts, citations.ts, scoring.ts
api/lib/karin/           # Protocolo + documentos Ley Karin (protocolo.ts, documentos.ts)
api/lib/cobranza/        # Intereses + reportes (intereses.ts, reportes.ts)
api/lib/pjud/            # Cliente PJUD + sync (client.ts, sync.ts)
api/lib/uf.ts            # UF dinámica via mindicador.cl
api/middleware.ts         # authedQuery / publicQuery (tRPC middleware)
db/schema.ts             # ~20 tablas MySQL (Drizzle)
db/seed/                 # Corpus legal: 195+ artículos CT + jurisprudencia
src/pages/               # 17 páginas React
```

## Routers tRPC registrados (api/router.ts)

auth, rag, causa, alerta, tarea, checklist, generador, jurisprudencia, leykarin, honorario, diarioOficial, agent, stats, pjud

## Comandos

```bash
npm run dev          # Dev server (localhost:3000)
npm run build        # Build producción
npm run start        # Producción
npm run db:push      # Push schema MySQL
npm run db:seed      # Seed datos legales
npm run db:rag:push  # Push schema RAG (Postgres)
npx vitest run       # Tests (62 tests, 7 archivos)
```

## PR abierto

PR #1: https://github.com/esstipi-debug/LexTrack/pull/1
Branch: `claude/zen-mayer-XbsTn`

## Score evaluación técnica: 7.2/10 → estimado ~8.0/10 post-fixes

## Tests

62 tests pasando en 7 archivos:
- protocolo.test.ts (12) — Ley Karin protocol
- citations.test.ts (4) — Anti-hallucination
- query-intent.test.ts (3) — Article extraction
- calculadora.test.ts (10) — Severance Art. 163 CT
- intereses.test.ts (6) — Monthly interest
- documentos.test.ts (17) — Ley Karin documents
- reportes.test.ts (5) — Cobranza reports

## Convenciones

- Todos los routers de datos usan `authedQuery` (excepto auth-router y ping)
- Fechas: `toLocaleDateString("es-CL")` en frontend
- Moneda: CLP con `toLocaleString("es-CL")`
- UI en español chileno
- Cada documento generado incluye disclaimer legal
- UF siempre dinámica via api/lib/uf.ts
