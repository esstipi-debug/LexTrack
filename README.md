# LexTrack

> AI assistant for Chilean employment lawyers.
> Not legal ChatGPT. The operating system for the employment law practice.

**Status:** under active development. Base RAG with 195 articles of the Código del Trabajo (Chile's Labor Code) + special statutes + case law already seeded. Migrating to a hybrid RAG architecture (BM25 + embeddings + reranker + LLM with citation verification).

## What it does

Four tools, no free-form chat:

1. **Ask** — RAG with verified citations over the Código del Trabajo, special statutes, case law, and legal opinions from the Dirección del Trabajo (Chile's labor authority).
2. **Calculate** — Severance, finiquito (termination settlement), overtime, pro-rated annual leave, gratificación (annual bonus). Local math, free and unlimited.
3. **Write** — Structured generators: termination letter, complaint, finiquito, answer.
4. **Notify** — Daily email with changes from the Diario Oficial (Chile's official gazette) filtered by employment-law subject matter.

**Spearhead feature:** Ley Karin wizard (Ley 21.643).

## Pricing

| Plan | Price/month | For whom |
|---|---|---|
| **Solo** | CLP 59,000 | Independent lawyer |
| **Estudio** | CLP 189,000 | 3-5 lawyers |
| **Firma** | CLP 449,000 | 6-15 lawyers |

Anchor: *"59K a month. 7 more hours a week. The assistant your practice doesn't have."*

## Documentation

- 📋 [Product strategy](docs/STRATEGY.md) — who the customer is, what it does, what it doesn't do, pricing, moat.
- 🏛 [Technical architecture](docs/ARCHITECTURE.md) — hybrid RAG, centralized scraping, stack, costs.
- 🗺 [6-week MVP roadmap](docs/ROADMAP.md) — executable plan.
- 🐘 [RAG Postgres / Neon](docs/RAG_SETUP.md) — `.env` variables, initial SQL, ingestion and verification.
- 🟢 [RAG AlloyDB (GCP)](docs/RAG_ALLOYDB.md) — managed Postgres on GCP (generic guide).

## Stack

- **Frontend:** React 19 + Vite + Tailwind + shadcn/ui
- **Backend:** Hono + tRPC + Drizzle
- **DB:** Postgres 16 + pgvector (migrating from MySQL)
- **AI:** Anthropic Claude Sonnet 4.6 + Voyage `voyage-law-2` + Cohere rerank
- **Infra:** S3, Stripe + dLocal, Resend, PostHog

## Disclaimer

LexTrack is an **assistant**; it does not replace the lawyer's professional judgment. Every answer carries its cited sources (article, rol — case docket number —, court, date) so the user can verify.
