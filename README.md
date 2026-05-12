# LexTrack

> Asistente IA para abogados laboralistas chilenos.
> No es ChatGPT legal. Es el sistema operativo del estudio laboral.

**Estado:** en desarrollo activo. RAG base con 195 artículos del Código del Trabajo + leyes especiales + jurisprudencia ya seedeados. Migrando a arquitectura RAG híbrida (BM25 + embeddings + reranker + LLM con verificación de citas).

## Qué hace

Cuatro herramientas, sin chat libre:

1. **Preguntar** — RAG con citas verificadas sobre Código del Trabajo, leyes especiales, jurisprudencia y dictámenes de la Dirección del Trabajo.
2. **Calcular** — Indemnización, finiquito, horas extra, feriado proporcional, gratificación. Matemática local, gratis e ilimitado.
3. **Escribir** — Generadores estructurados: carta de despido, demanda, finiquito, contestación.
4. **Avisar** — Email diario con cambios del Diario Oficial filtrados por materia laboral.

**Feature punta de lanza:** wizard de Ley Karin (Ley 21.643).

## Pricing

| Plan | Precio/mes | Para quién |
|---|---|---|
| **Solo** | CLP 59.000 | Abogado independiente |
| **Estudio** | CLP 189.000 | 3-5 abogados |
| **Firma** | CLP 449.000 | 6-15 abogados |

Anclaje: *"59 lucas al mes. 7 horas más a la semana. El asistente que tu estudio no tiene."*

## Documentación

- 📋 [Estrategia de producto](docs/STRATEGY.md) — quién es el cliente, qué hace, qué no hace, pricing, moat.
- 🏛 [Arquitectura técnica](docs/ARCHITECTURE.md) — RAG híbrido, scraping centralizado, stack, costos.
- 🗺 [Roadmap MVP 6 semanas](docs/ROADMAP.md) — plan ejecutable.
- 🐘 [RAG Postgres / Neon](docs/RAG_SETUP.md) — variables `.env`, SQL inicial, ingesta y verificación.

## Stack

- **Frontend:** React 19 + Vite + Tailwind + shadcn/ui
- **Backend:** Hono + tRPC + Drizzle
- **DB:** Postgres 16 + pgvector (migrando desde MySQL)
- **IA:** Anthropic Claude Sonnet 4.6 + Voyage `voyage-law-2` + Cohere rerank
- **Infra:** S3, Stripe + dLocal, Resend, PostHog

## Disclaimer

LexTrack es un **asistente**, no reemplaza el criterio profesional del abogado. Cada respuesta lleva sus fuentes citadas (artículo, rol, tribunal, fecha) para que el usuario verifique.
