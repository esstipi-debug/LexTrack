# LexTrack

![CI](https://github.com/esstipi-debug/LexTrack/actions/workflows/ci.yml/badge.svg)

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
- 🟢 [RAG AlloyDB (GCP)](docs/RAG_ALLOYDB.md) — Postgres gestionado en GCP (guía genérica).

## Stack

- **Frontend:** React 19 + Vite + Tailwind + shadcn/ui
- **Backend:** Hono + tRPC + Drizzle
- **DB:** Postgres 16 + pgvector (migrando desde MySQL)
- **IA:** Anthropic Claude Sonnet 4.6 + Voyage `voyage-law-2` + Cohere rerank
- **Infra:** S3, Stripe + dLocal, Resend, PostHog

## Disclaimer

LexTrack es un **asistente**, no reemplaza el criterio profesional del abogado. Cada respuesta lleva sus fuentes citadas (artículo, rol, tribunal, fecha) para que el usuario verifique.

## Scrapers

LexTrack integra varios scrapers de fuentes oficiales chilenas. Todos siguen el mismo patrón de fachada: un módulo `api/lib/<fuente>/index.ts` que selecciona entre simulador (default) e implementación real con Playwright vía variable de entorno. Los selectores en las implementaciones Playwright son **placeholders** documentados con `// TODO: verify` y deben verificarse contra el sitio vivo antes de habilitar en producción.

| Fuente | Env flag | Default | Sitio |
|---|---|---|---|
| Poder Judicial | `PJUD_SCRAPER` | `simulator` | `oficinajudicialvirtual.pjud.cl` |
| Dirección del Trabajo (dictámenes) | `DT_SCRAPER` | `simulator` | `dt.gob.cl` |
| BCN / LeyChile (leyes y normas) | `BCN_SCRAPER` | `simulator` | `bcn.cl/leychile` |
| Diario Oficial | `DIARIO_OFICIAL_SCRAPER` | `simulator` | `diariooficial.interior.gob.cl` |
| Corte Suprema (jurisprudencia) | `SUPREMA_SCRAPER` | `simulator` | `suprema.pjud.cl` |

Cada scraper expone errores tipados (`*UnavailableError`, `*NotFoundError`). El ciclo de vida del navegador (launch / page / teardown), reintentos con backoff exponencial y screenshots de debug viven en el helper compartido `api/jobs/lib/playwright-helpers.ts`. Ver [`docs/SCRAPERS.md`](docs/SCRAPERS.md) para el workflow de campo (verificación de selectores contra el DOM real, anti-detección).

### Scraper config (env vars)

| Variable | Default | Descripción |
|---|---|---|
| `PLAYWRIGHT_HEADLESS` | `true` | `false` para abrir Chromium con ventana (debugging interactivo). |
| `SCRAPER_TIMEOUT_MS` | `30000` | Timeout por defecto para selectores y navegación. |
| `SCRAPER_USER_AGENT` | `Mozilla/5.0 (compatible; LexTrack/1.0)` | UA string usado por todos los scrapers. |
| `SCRAPER_DEBUG` | `false` | `true` para guardar screenshots al fallar un scrape. |
| `SCRAPER_DEBUG_DIR` | `./debug` | Carpeta donde se escriben los screenshots de debug. |

## PJUD Scraper

LexTrack consulta el Poder Judicial de Chile (`https://oficinajudicialvirtual.pjud.cl`) para sincronizar el estado de causas. El módulo `api/lib/pjud/` expone una fachada (`api/lib/pjud/index.ts`) que selecciona la implementación según la variable de entorno `PJUD_SCRAPER`:

- `PJUD_SCRAPER=simulator` (default, o no seteada): usa el simulador en memoria (`api/lib/pjud/client.ts`) con datos sintéticos. Útil para desarrollo y CI.
- `PJUD_SCRAPER=playwright`: usa el scraper real basado en Playwright (`api/lib/pjud/playwright-scraper.ts`) que lanza Chromium headless, navega a PJUD y extrae datos por selectores.

**Selectores placeholder.** El scraper real fue construido sin acceso a la UI viva de PJUD: todos los selectores son placeholders documentados con `// TODO: verify selector against real PJUD` y están centralizados en la constante `SELECTORS` para que cambiarlos sea un edit de una línea. **Antes de habilitar `PJUD_SCRAPER=playwright` en producción hay que verificar manualmente cada selector** contra el DOM real de oficinajudicialvirtual.pjud.cl (consulta unificada, consulta por RUT, listado de movimientos).

**Errores tipados.** El scraper lanza `PjudUnavailableError` (PJUD caído / red), `PjudCaptchaError` (CAPTCHA detectado) y `PjudNotFoundError` (causa inexistente) para que el caller decida si fallback al simulador o propaga el error.

**Browser singleton.** Chromium se lanza una sola vez por proceso (`getBrowser()`) y se reusa entre llamadas. En shutdown llamar `closeBrowser()` desde `api/lib/pjud/playwright-scraper.ts` para liberar el proceso.

