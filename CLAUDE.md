# LexTrack — Contexto para Claude

> SaaS legaltech chileno para abogados laboralistas. Stack completo construido con agentes Claude.

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Backend | Hono + tRPC-style routers (api/*-router.ts) |
| ORM | Drizzle ORM — Postgres (pg-core) |
| DB | PostgreSQL 16 + pgvector |
| Auth | OAuth via Kimi (api/kimi/) — JWT en cookies |
| Frontend | React 19 + React Router 7 + TanStack Query |
| UI | shadcn/ui + Tailwind CSS v3 |
| AI | Anthropic Claude (Sonnet) — agent con 20+ tools |
| Email | Resend (api/lib/email/) |
| Pagos | Stripe (internacional) + MercadoPago (Chile) |
| Analytics | PostHog (frontend) |
| Errores | Sentry (backend @sentry/node + frontend @sentry/react) |
| Logs | Pino (api/lib/logger.ts) — pretty en dev, JSON en prod |
| Jobs | node-cron (api/jobs/) — sync PJUD c/6h, DiarioOficial diario, DT lunes |
| Tests | vitest — ~180+ test cases (api/**/*.test.ts + contracts/**/*.test.ts + src/**/*.test.tsx) |
| CI | GitHub Actions (.github/workflows/ci.yml) — Node 22, Postgres 16, lint→check→test→build |
| Deploy | Docker + docker-compose (Dockerfile node:22-alpine) |

---

## Repositorio

- **GitHub**: https://github.com/esstipi-debug/LexTrack
- **Branch activa**: `claude/elastic-kirch-4eb0b0`
- **PR**: https://github.com/esstipi-debug/LexTrack/pull/3

```bash
# Clonar y levantar
git clone https://github.com/esstipi-debug/LexTrack
git checkout claude/elastic-kirch-4eb0b0
npm install
cp .env.example .env.local   # completar vars
npm run db:generate           # generar migraciones Postgres
npm run db:migrate            # aplicar migraciones
npm run db:seed               # datos de prueba
npm run dev                   # localhost:5173 (frontend) + localhost:3000 (api)
```

---

## Variables de entorno requeridas (.env.local)

```bash
# DB
DATABASE_URL=postgres://lextrack:lextrack@localhost:5432/lextrack

# Auth (OAuth)
APP_ID=...          # OAuth App ID
APP_SECRET=...      # OAuth App Secret
OWNER_UNION_ID=...  # unionId del admin
APP_URL=http://localhost:5173

# AI
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5   # o claude-opus-4-5
VOYAGE_API_KEY=...   # embeddings RAG
COHERE_API_KEY=...   # reranking RAG

# Pagos
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
MP_ACCESS_TOKEN=TEST-...            # MercadoPago

# Email
RESEND_API_KEY=re_...

# Observabilidad
SENTRY_DSN=                         # vacío = desactivado
VITE_SENTRY_DSN=                    # vacío = desactivado

# Analytics
VITE_POSTHOG_KEY=                   # vacío = desactivado
VITE_POSTHOG_HOST=https://app.posthog.com

# Scrapers (simulator = sin browser real)
PJUD_SCRAPER=simulator              # cambiar a "playwright" cuando selectores verificados
DT_SCRAPER=simulator
BCN_SCRAPER=simulator
DIARIO_OFICIAL_SCRAPER=simulator
SUPREMA_SCRAPER=simulator

# Jobs
JOBS_ENABLED=false                  # true en producción
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:5173
PORT=3000
```

---

## Estructura de archivos clave

```
api/
  *-router.ts          # 18 routers tRPC (causa, alerta, tarea, honorario, leykarin,
                       # checklist, generador, jurisprudencia, diariooficial, pjud,
                       # rag, agent, stats, jobs, org, pdf, billing, auth)
  router.ts            # appRouter — registra todos los routers
  boot.ts              # Hono app — middleware, /health, Sentry, startJobs()
  middleware.ts        # authedQuery, adminQuery — auth enforcement
  context.ts           # ctx.user.id, ctx.user.role

  lib/
    agent/             # Agente Anthropic spliteado en módulos
      types.ts, tool-definitions.ts, executor.ts, loop.ts, fallback.ts
      tools/           # causas, tareas, alertas, honorarios, leykarin,
                       # normativa, pjud, estadisticas, documentos, scrapers
    anthropic.ts       # cliente Anthropic
    billing/           # stripe.ts, mercadopago.ts, types.ts (PLANS, BillingProvider)
    email/             # client.ts, send.ts, templates.ts (4 templates en español)
    pdf/               # generate-pdf.ts (pdfkit)
    pjud/              # index.ts (facade), playwright-scraper.ts, simulator.ts
    dt/                # Dirección del Trabajo scraper
    bcn/               # Biblioteca del Congreso scraper
    diariooficial/     # Diario Oficial scraper
    suprema/           # Corte Suprema scraper
    karin/             # Ley Karin document generators
    logger.ts          # Pino logger con redact
    rate-limit.ts      # generalLimiter, agentLimiter, ragLimiter, authLimiter

  jobs/
    index.ts           # startJobs(), stopJobs(), JOBS registry
    sync-pjud.ts       # cron cada 6h
    sync-diario-oficial.ts  # cron diario 09:00
    scan-dt-dictamenes.ts   # cron lunes 08:00

db/
  schema.ts            # todas las tablas (Postgres pg-core)
  schema-billing.ts    # tabla subscriptions
  schema-rag.ts        # chunks RAG
  relations.ts         # Drizzle relations
  seed.ts              # seeds de prueba

src/
  pages/               # 20+ páginas React
  components/          # UI components (AppLayout, ExportPdfButton, etc.)
  lib/analytics.ts     # PostHog wrapper
  hooks/use-debounce.ts, use-analytics.ts

contracts/
  rut.ts               # validación RUT chileno (mod-11)
```

---

## Lo que está hecho ✅

### Infraestructura base
- [x] Auth OAuth completa con JWT, cookie segura, authedQuery en todos los endpoints
- [x] Postgres migration completa (desde MySQL) — schema, queries, seeds
- [x] Multi-tenancy: userId FK en 17 tablas, filtros en ~80 queries
- [x] Rate limiting: general 100/min, agent 20/min, RAG 30/min, auth 10/min (IP-only)
- [x] CI/CD: GitHub Actions Node 22 + Postgres 16 real + migrations
- [x] Docker: node:22-alpine, app service, backup service (profile)

### Producto
- [x] 18 routers con ~100+ endpoints CRUD
- [x] Agente IA con 22 tools (PJUD, DT, BCN, Suprema, DiarioOficial, causas, tareas, etc.)
- [x] Ley Karin profunda (acta, informe, medidas cautelares, protocolo)
- [x] Cobranza avanzada (intereses, reportes, cartas, aging)
- [x] Paginación cursor-based en 13 endpoints (useInfiniteQuery en 8 páginas)
- [x] Validación RUT chileno (mod-11) en inputs críticos
- [x] Export PDF con pdfkit (ExportPdfButton component)
- [x] Multi-firma: organizations, org_members, invites (schema + org-router)
- [x] Onboarding wizard 3 pasos
- [x] Settings page (perfil, notificaciones, datos/privacidad)
- [x] Notificación bell en AppLayout (polling 60s)
- [x] ToS + Política de Privacidad (Ley 19.628)
- [x] Plan limits enforcement (free:5, starter:50, pro:∞ causas)

### Scrapers (todos en simulator por defecto)
- [x] PJUD Playwright scraper (21 selectores TODO)
- [x] Dirección del Trabajo (11 selectores TODO)
- [x] BCN/leychile.cl (11 selectores TODO)
- [x] Diario Oficial (13 selectores TODO)
- [x] Corte Suprema (16 selectores TODO)

### Cron jobs proactivos
- [x] Sync PJUD activas c/6h → cronologia + alertas + emails
- [x] Sync Diario Oficial diario → alertas laborales por usuario + emails
- [x] Scan DT dictámenes lunes → alertas (stub, pendiente selector real)

### Pagos y monetización
- [x] Stripe checkout + portal + webhooks
- [x] MercadoPago preference + IPN webhook (reemplaza dLocal)
- [x] Tabla subscriptions + plan enforcement en crear causa
- [x] Pricing page /billing con CLP (Intl.NumberFormat es-CL)

### Observabilidad
- [x] Pino logs (JSON prod, pretty dev, redact auth headers)
- [x] Sentry backend + frontend (no-op sin DSN)
- [x] PostHog: pageview, causa_created, agent_message_sent, pdf_exported
- [x] /health endpoint público (DB check, 200/503)

### Tests (~180+ casos)
- [x] causa, alerta, tarea, honorario, auth, checklist, generador, pdf,
      leykarin, pjud, stats, rag, agent (E2E con mock Anthropic)
- [x] RUT validation (16 casos)
- [x] Rate limiter, scrapers (DT, BCN, Suprema, DiarioOficial), jobs
- [x] useDebounce hook

---

## Lo que falta para v1 🔴

### CRÍTICO — Sin esto no se puede lanzar con pago real

**1. Verificar selectores Playwright** (trabajo manual de campo)
Todos los scrapers están en modo `simulator`. Para activar datos reales:
- Abrir cada sitio en browser con DevTools
- Buscar elementos y verificar/reemplazar los `// TODO: verify selector` en:
  - `api/lib/pjud/playwright-scraper.ts` (21 selectores)
  - `api/lib/dt/playwright-scraper.ts` (11 selectores)
  - `api/lib/bcn/playwright-scraper.ts` (11 selectores)
  - `api/lib/diariooficial/playwright-scraper.ts` (13 selectores)
  - `api/lib/suprema/playwright-scraper.ts` (16 selectores)
- Luego setear env vars: `PJUD_SCRAPER=playwright`, `DT_SCRAPER=playwright`, etc.

**2. Revisión legal de ToS y Privacidad** (con abogado)
Los archivos `src/pages/Terminos.tsx` y `src/pages/Privacidad.tsx` son drafts.
Requieren revisión por abogado antes de cobrar a usuarios.

**3. Configurar credenciales reales de producción**
- MercadoPago: credenciales de producción (no sandbox) en `MP_ACCESS_TOKEN`
- Stripe: `STRIPE_SECRET_KEY` producción + webhook endpoint registrado
- Resend: dominio verificado (lextrack.cl) en panel Resend
- Sentry: crear proyectos y setear DSNs
- PostHog: crear proyecto y setear `VITE_POSTHOG_KEY`

**4. Landing page pública**
No existe. Usuarios no autenticados ven pantalla de login directamente.
Crear `src/pages/Landing.tsx` con hero, demo video, pricing, FAQ.
Agregar ruta pública `/` en `src/App.tsx` fuera del AuthLayout.

**5. Trial de 14 días sin tarjeta**
No está implementado. Agregar:
- `trialEndsAt` en tabla `subscriptions`
- Middleware que bloquea features si trial expiró y no hay plan pagado
- Email automático D-3 antes de fin de trial (template ya existe `resumenSemanal`)

---

## Lo que falta para v1 🟡

### IMPORTANTE — Necesario antes de escalar

**6. Audit trail**
No existe tabla `audit_log`. Para legaltech es compliance importante.
Agregar tabla `(userId, action, tableName, recordId, before, after, ip, timestamp)`
y registrar todas las mutaciones críticas.

**7. Invitaciones por email**
`org.invitarMiembro` genera el token pero NO envía email.
Wire: después de crear invite, llamar `sendEmail({ to: email, template: inviteTemplate({...}) })`.
Crear template `inviteMiembro` en `api/lib/email/templates.ts`.

**8. Re-scope de queries por orgId** (multi-firma completo)
El schema tiene `organizations` + `org_members` + `invites` PERO las tablas de datos
(`causas`, `tareas`, `alertas`, etc.) todavía usan `userId` scalar.
Para que un estudio con 3 abogados comparta causas, hay que:
- Agregar `orgId` FK en tablas de datos
- Modificar queries para filtrar por `orgId` en vez de (o además de) `userId`
- Definir política: ¿causas son por org? ¿o por usuario dentro de org?
Este es el cambio más grande arquitectónicamente.

**9. Selector drop-in para DT scan**
`api/jobs/scan-dt-dictamenes.ts` tiene un TODO de 1 línea para enchufar al facade.
Una vez verificados los selectores DT, activar con:
```ts
const dictamenes = await buscarDictamenes('laboral', { limite: 20 });
```

**10. Resumen semanal automático**
Cron job faltante: domingo 08:00, enviar email `resumenSemanal` a cada usuario.
Agregar en `api/jobs/index.ts` + nuevo `api/jobs/resumen-semanal.ts`.

---

## Pendientes técnicos 🟢

### V2 — Post-lanzamiento

| # | Task | Archivo(s) |
|---|------|-----------|
| 11 | Cursor compuesto (sort por prioridad/fecha + id) en alertas/diario | alerta-router.ts, diariooficial-router.ts |
| 12 | Tests para billing-router y email/send | api/billing-router.test.ts (nuevo) |
| 13 | Tests para org-router | api/org-router.test.ts (nuevo) |
| 14 | Métricas job failures (contador consecutivo + alerta) | api/jobs/index.ts |
| 15 | Bottom nav móvil (el sidebar responsive ya funciona) | src/components/AppLayout.tsx |
| 16 | Más calculadoras laborales (licencias médicas, fueros, cotizaciones) | api/lib/calculos/ |
| 17 | Más templates escritos (contestación, demanda tutela, transacción) | api/lib/karin/ o nuevo |
| 18 | Editor TipTap para documentos generados (vs textarea actual) | src/pages/Generador.tsx |
| 19 | Integración OJV si habilitan API pública | api/lib/pjud/ |

---

## Comandos útiles

```bash
# Dev
npm run dev              # frontend + backend
npm test                 # vitest run (~180 tests)
npm run check            # tsc -b
npm run lint             # eslint

# DB
npm run db:generate      # generar migraciones desde schema
npm run db:migrate       # aplicar migraciones
npm run db:seed          # seeds de prueba
npm run db:push          # push directo sin migración (solo dev)

# RAG
npm run rag:ingest       # ingestar chunks al RAG
npm run rag:verify-db    # verificar chunks en DB

# Docker
docker compose up -d                    # levantar Postgres
docker compose --profile backup up -d  # con backup automático

# Backup manual
chmod +x scripts/backup.sh
./scripts/backup.sh ./backups

# Activar scrapers reales (después de verificar selectores)
PJUD_SCRAPER=playwright
DT_SCRAPER=playwright
# etc.
```

---

## Decisiones de arquitectura importantes

1. **tRPC sobre REST**: todos los endpoints son procedures tRPC. Frontend usa `trpc.<router>.<proc>.useQuery/useMutation`. No hay REST endpoints excepto `/health` y webhooks (Stripe/MP).

2. **userId en todas las tablas de datos**: multi-tenancy a nivel de usuario. El `orgId` existe en schema pero aún no está en las tablas de datos (pendiente #8).

3. **Scrapers con facade pattern**: todos usan `simulador|playwright` controlado por env var. El simulador siempre funciona; playwright requiere selectores verificados.

4. **Emails siempre swallowed**: `sendEmail()` nunca lanza. Errores se loggean y se ignoran. Los jobs tampoco crashean por email fallido.

5. **MercadoPago por defecto en billing UI**: `provider` default es `'mercadopago'` en `/billing`. Stripe es secundario (tarjetas internacionales).

6. **Pino con redact**: `authorization`, `cookie`, `password`, `token`, `apiKey` nunca aparecen en logs.

7. **Jobs gated por JOBS_ENABLED**: en producción setear `JOBS_ENABLED=true`. En dev/test off por defecto.

---

*Última actualización: 2026-05-27 — construido enteramente con Claude agentes paralelos en ~3 sesiones.*
