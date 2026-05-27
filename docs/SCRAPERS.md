# Scrapers — guía para campo

LexTrack integra dos scrapers principales contra fuentes oficiales chilenas:

- **PJUD** — `oficinajudicialvirtual.pjud.cl` — consulta de causas y movimientos.
- **Diario Oficial** — `diariooficial.interior.gob.cl` — edición electrónica diaria y búsqueda de normas.

Ambos están construidos sobre Playwright + Chromium headless. Los selectores actuales son **placeholders** que requieren verificación manual contra el DOM real antes de habilitar los flags `PJUD_SCRAPER=playwright` / `DIARIO_OFICIAL_SCRAPER=playwright` en producción.

## Arquitectura

- `api/jobs/lib/playwright-helpers.ts` — scaffolding compartido: `withBrowser`, `withRetries`, `safeSelector`, `captureDebugScreenshot`.
- `api/lib/pjud/playwright-scraper.ts` — scraper PJUD (selectores en la constante exportada `SELECTORS`).
- `api/lib/diariooficial/playwright-scraper.ts` — scraper Diario Oficial (selectores en `SELECTORS`).
- Cada scraper vive detrás de una fachada (`api/lib/<fuente>/index.ts`) que alterna entre simulador (default) y Playwright según un env flag.

## Para actualizar selectores

Workflow recomendado cuando un scraper falla porque el DOM cambió:

1. En `.env` (o exportá en la shell):
   ```bash
   PLAYWRIGHT_HEADLESS=false   # ver el browser
   SCRAPER_DEBUG=true          # guardar screenshots en ./debug
   SCRAPER_TIMEOUT_MS=60000    # más holgado para inspeccionar manualmente
   ```

2. Correr el scraper manualmente — ej. para PJUD:
   ```bash
   PJUD_SCRAPER=playwright npx tsx -e \
     'import("./api/lib/pjud/index.ts").then(m => m.consultarCausa("C-1234-2024").then(console.log))'
   ```
   Para Diario Oficial:
   ```bash
   DIARIO_OFICIAL_SCRAPER=playwright npx tsx -e \
     'import("./api/lib/diariooficial/index.ts").then(m => m.obtenerEdicionDelDia().then(console.log))'
   ```

3. Cuando falle, mirá:
   - El error en consola — incluye el selector y el label (gracias a `safeSelector`).
   - El screenshot guardado bajo `./debug/<nombre>-<timestamp>.png`.

4. Abrí el sitio real en el browser, inspeccioná el elemento que ya no responde al selector viejo, y actualizá la entrada correspondiente en el objeto `SELECTORS` al top del archivo del scraper.

5. Re-corré. Iterá hasta que el flujo completo pase.

## URLs y selectores actuales

### PJUD — `api/lib/pjud/playwright-scraper.ts`

URL base: `https://oficinajudicialvirtual.pjud.cl/indexN.htm`

| Clave | Selector placeholder | Descripción |
|---|---|---|
| `consultaCausaTab` | `a[href*='consultaCausa']` | Tab/link "Consulta unificada de causas". |
| `ritInput` | `input[name='rit']` | Input para el RIT. |
| `tribunalSelect` | `select[name='tribunal']` | Select del tribunal. |
| `submitButton` | `button[type='submit'], input[type='submit']` | Submit del formulario. |
| `resultsContainer` | `#resultados, table.resultados` | Contenedor del listado de resultados. |
| `resultsRow` | `tr.causa-row` | Fila individual de causa en el listado. |
| `noResults` | `.sin-resultados, .no-results` | Mensaje "sin resultados". |
| `captcha` | `iframe[src*='captcha'], #captcha` | Iframe / contenedor del CAPTCHA. |
| `causaCaratula` | `.caratula, td.caratula` | Carátula de la causa. |
| `causaRuc` | `.ruc, td.ruc` | RUC (Rol Único de Causa). |
| `causaTribunal` | `.tribunal, td.tribunal` | Nombre del tribunal. |
| `causaEstado` | `.estado, td.estado` | Estado procesal. |
| `causaEtapa` | `.etapa, td.etapa` | Etapa procesal. |
| `causaFechaIngreso` | `.fecha-ingreso, td.fecha-ingreso` | Fecha de ingreso. |
| `causaLitigantes` | `.litigantes li, td.litigantes` | Items del listado de litigantes. |
| `movimientoRow` | `tr.movimiento-row` | Fila de movimiento en la cronología. |
| `movimientoFecha` | `.fecha` | Fecha del movimiento. |
| `movimientoTipo` | `.tipo` | Tipo del movimiento. |
| `movimientoDescripcion` | `.descripcion` | Descripción del movimiento. |
| `movimientoFolio` | `.folio` | Folio (opcional). |
| `rutInput` | `input[name='rut']` | Input RUT en consulta por RUT. |

### Diario Oficial — `api/lib/diariooficial/playwright-scraper.ts`

URL base: `https://www.diariooficial.interior.gob.cl/edicionelectronica/`

| Clave | Selector placeholder | Descripción |
|---|---|---|
| `fechaInput` | `input[name='date'], #fecha` | Input de fecha. |
| `submitButton` | `button[type='submit'], input[type='submit']` | Submit del form de búsqueda. |
| `searchInput` | `input[name='q'], input[type='search']` | Input de búsqueda libre. |
| `resultsContainer` | `#resultados, .normas-list, table.ediciones` | Contenedor del listado de normas. |
| `normaRow` | `tr.norma-row, li.norma, .norma-item` | Fila individual de norma. |
| `normaTipo` | `.tipo, td.tipo` | Tipo de norma (Ley, Decreto, etc.). |
| `normaNumero` | `.numero, td.numero` | Número de norma. |
| `normaTitulo` | `.titulo, td.titulo, a.titulo` | Título de la norma. |
| `normaOrganismo` | `.organismo, td.organismo` | Organismo emisor. |
| `normaMateria` | `.materia, td.materia` | Materia (laboral, civil, etc.). |
| `normaFecha` | `.fecha, td.fecha` | Fecha de publicación. |
| `normaLink` | `a[href*='/edicionelectronica/']` | Link al texto completo. |
| `noResults` | `.sin-resultados, .no-results` | Mensaje "sin resultados". |

## Anti-detección

Sugerencias para mantener los scrapers funcionando contra sitios que pueden bloquear bots agresivos:

- **User-Agent**: configurar `SCRAPER_USER_AGENT` con una cadena moderna y realista; rotar entre 2-3 valores si la fuente bloquea por UA estática.
- **Throttle**: hay un `sleep` de 1s entre llamadas en `api/jobs/sync-pjud.ts` (`PJUD_CALL_DELAY_MS`). Mantener delays randomizados (±300 ms) si la fuente lo permite.
- **Rate**: no encadenar más de ~60 requests/min por scraper. PJUD y Diario Oficial no publican rate limits formales, pero un ritmo agresivo dispara CAPTCHA o bloqueo de IP.
- **`robots.txt`**: verificar `https://oficinajudicialvirtual.pjud.cl/robots.txt` y `https://www.diariooficial.interior.gob.cl/robots.txt` antes de scrapear rutas no listadas en la fachada pública.
- **Cookies y sesión**: ambos sitios funcionan sin login para consultas públicas. Si en el futuro se requiere auth, usar el flag `PLAYWRIGHT_HEADLESS=false` la primera vez para resolver CAPTCHA manualmente y exportar las cookies vía `context.storageState()`.
- **CAPTCHA**: el scraper PJUD detecta CAPTCHA y lanza `PjudCaptchaError` para que el caller decida (alertar, esperar, fallback al simulador). No intentar resolverlo programáticamente.
- **Horario**: preferir corridas nocturnas (00:00–06:00 CLT) cuando el tráfico legítimo es bajo y los sitios responden más rápido.

## Env vars de scraper

| Variable | Default | Función |
|---|---|---|
| `PLAYWRIGHT_HEADLESS` | `true` | `false` para abrir Chromium con head. |
| `SCRAPER_TIMEOUT_MS` | `30000` | Timeout default para selectores y navegación. |
| `SCRAPER_USER_AGENT` | `Mozilla/5.0 (compatible; LexTrack/1.0)` | UA string usado por el browser. |
| `SCRAPER_DEBUG` | `false` | `true` → screenshots automáticos al fallar. |
| `SCRAPER_DEBUG_DIR` | `./debug` | Carpeta destino para screenshots de debug. |
| `PJUD_SCRAPER` | `simulator` | `playwright` para usar el scraper real. |
| `DIARIO_OFICIAL_SCRAPER` | `simulator` | `playwright` para usar el scraper real. |
