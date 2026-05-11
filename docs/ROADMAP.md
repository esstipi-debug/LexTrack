# LexTrack — Roadmap MVP (6 semanas)

> Objetivo: tener un SaaS vendible a abogados laboralistas chilenos en 6 semanas.
> Métrica de éxito: 10 trials de pago en mes 1 post-launch.

## Pre-week 0 — Validación (esta semana)

- [ ] Demos a 10 abogados laboralistas con mockups del flujo.
- [ ] Pregunta clave: *"¿pagarías CLP 59.000/mes por esto?"*
- [ ] **Gate:** si <6/10 dicen sí, ajustar antes de codear.

## Semana 1-2 — RAG que no falla

**Entregable:** endpoint `/rag/ask` que recibe pregunta y devuelve respuesta con citas verificadas sobre el Código del Trabajo + jurisprudencia ya seedeada.

- [ ] Levantar Postgres 16 + pgvector + tsearch2 ES (Docker compose local + Railway/Fly prod).
- [ ] Migrar `db/schema.ts` a `drizzle-orm/pg-core`.
- [ ] Crear tabla `chunks` con `embedding vector(1024)` + `fts tsvector` + metadata.
- [ ] Reescribir `db/seed/index.ts` para insertar en Postgres.
- [ ] Pipeline de ingesta: para cada artículo del seed → embed Voyage → insert.
- [ ] Cliente Voyage en `api/lib/voyage.ts`.
- [ ] Cliente Anthropic en `api/lib/anthropic.ts`.
- [ ] Cliente Cohere rerank en `api/lib/cohere.ts`.
- [ ] Reescribir `api/rag-router.ts`:
  - [ ] BM25 query (Postgres `ts_rank`).
  - [ ] Vector query (`<=>` pgvector).
  - [ ] Union + dedup.
  - [ ] Cohere rerank → top 6.
  - [ ] Claude Sonnet 4.6 con prompt de citación obligatoria.
  - [ ] `verifyCitations()` post-gen + reintento.
- [ ] **Eval set:** 50 preguntas reales con respuesta esperada → mide recall@5 y % citas válidas.

## Semana 3 — Ley Karin (punta de lanza comercial)

**Entregable:** wizard que genera protocolo + reglamento interno + plan de capacitación para Ley 21.643.

- [ ] Cargar texto completo Ley 21.643 + reglamento + dictámenes DT al RAG.
- [ ] Wizard UI (5-7 pasos) en `src/sections/leykarin/`:
  - Datos empresa (rubro, dotación, sucursales).
  - Canales de denuncia ya existentes.
  - Encargado del proceso.
- [ ] `api/leykarin-router.ts`: endpoint `generarProtocolo()` con Claude + plantillas.
- [ ] Output: PDF descargable + DOCX editable + checklist de implementación.
- [ ] Landing dedicada `/ley-karin` para SEO.

## Semana 4 — Calculadoras

**Entregable:** 4 calculadoras laborales precisas, exportables a PDF.

- [ ] Indemnización por años de servicio (art. 163, tope 11 años).
- [ ] Sustitutiva de aviso previo (art. 161 inc. 2).
- [ ] Feriado proporcional (art. 73).
- [ ] Horas extra (art. 32) + semana corrida (art. 45).
- [ ] Gratificación art. 50 vs 47 (selector).
- [ ] Recargo art. 168 (30% / 50% / 80% / 100% tutela).
- [ ] UI en `src/sections/calculadoras/` — forms con `react-hook-form` + `zod`.
- [ ] Lógica pura en `api/lib/calculos/*.ts` (testeada con `vitest`).
- [ ] PDF con `react-pdf` o `pdfkit`, citando artículos.

## Semana 5 — Generador de escritos

**Entregable:** 3 plantillas de escrito con datos del caso → output editable.

- [ ] Carta de despido (art. 162).
- [ ] Demanda de despido injustificado (procedimiento de aplicación general).
- [ ] Finiquito tipo.
- [ ] Forms estructurados (no chat libre) en `src/sections/generador/`.
- [ ] `api/generador-router.ts`: usa Claude con plantilla + datos + RAG para citar correctamente.
- [ ] Output: editor TipTap o textarea + export DOCX.

## Semana 6 — Onboarding, cobro, launch

**Entregable:** SaaS cobrable.

- [ ] Stripe + dLocal (CLP). Webhook → activar plan.
- [ ] Trial 14 días sin tarjeta.
- [ ] Email transaccional (Resend): bienvenida, fin de trial, cobro fallido.
- [ ] Landing pública con hero, demo de 60s grabado, pricing, FAQ.
- [ ] PostHog: track signup → first query → first escrito.
- [ ] T&C + Política de privacidad (revisar con abogado).
- [ ] Health check + Sentry.
- [ ] Deploy: web en Vercel/Fly, scraper worker separado en Fly/Railway.

## Post-launch (mes 2+)

- [ ] Scraping live: Diario Oficial diario, Poder Judicial semanal, DT semanal.
- [ ] Email "Avisar" diario con cambios filtrados.
- [ ] Gestión de causas (usar `causa-router.ts` ya scaffoldeado).
- [ ] Más calculadoras: licencias médicas, fueros, cotizaciones.
- [ ] Más escritos: contestación, transacción, demanda de tutela.
- [ ] Integración con sistemas de tribunales (OJV) si la API lo permite.

## Definition of Done por feature

Una feature NO está lista hasta que:
1. ✅ Tiene tests (`vitest`) en la lógica pura.
2. ✅ El happy path está cubierto por un test e2e o de integración.
3. ✅ El abogado de prueba (validación) la usó y dijo "esto me sirve".
4. ✅ Hay un evento PostHog que rastrea su uso.
5. ✅ Disclaimer legal visible si aplica.
