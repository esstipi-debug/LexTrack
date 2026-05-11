# LexTrack — Estrategia de producto

> Asistente IA para abogados laboralistas chilenos.
> No es ChatGPT legal. Es el sistema operativo del estudio laboral.

## 1. Quién es el cliente

**Abogado laboralista chileno** independiente o estudio chico (1–15 abogados). Atiende a empleadores y/o trabajadores. Vive en demandas, finiquitos, cartas de despido, cálculos de indemnización, jurisprudencia laboral y dictámenes de la Dirección del Trabajo.

**Su dolor diario:**
- Finiquito en Excel: 20 min.
- Demanda laboral: 2 horas de copy/paste y revisión.
- Buscar jurisprudencia análoga: 30 min en vLex/LegalPublishing.
- Mantenerse al día con Diario Oficial: nunca lo hace.
- Ley Karin: protocolos pendientes, sin tiempo.

## 2. Qué hace LexTrack — 4 botones

1. **Preguntar** — RAG real sobre Código del Trabajo + leyes especiales + jurisprudencia + dictámenes DT. Respuesta con cita verificada (`[Art. 162 CT]`, `[Rol N°… / Corte Suprema / fecha]`). Si el modelo intenta citar algo que no existe en los chunks recuperados, el verificador lo rechaza.
2. **Calcular** — Indemnización por años de servicio, sustitutiva de aviso previo, feriado proporcional, horas extra, semana corrida, gratificación. Matemática local, sin LLM, gratis e ilimitado. PDF con citas legales.
3. **Escribir** — Generadores estructurados (no chat libre): carta de despido art. 162, demanda de despido injustificado, finiquito, contestación, transacción. Input por formulario, output editable.
4. **Avisar** — Email diario con cambios del Diario Oficial filtrados por materia laboral. Semanal con nueva jurisprudencia relevante a sus causas.

**Feature punta de lanza comercial:** Ley Karin (Ley 21.643). Wizard de protocolo + reglamento interno + plan de capacitación. Todos los empleadores con >1 trabajador la necesitan. Abogados desbordados.

## 3. Lo que NO hace (foco láser)

- ❌ Chat libre tipo ChatGPT — eso ya lo tienen gratis.
- ❌ Gestión completa de causas — compite con Lemontech/Abogest, no ganamos.
- ❌ Otras materias (civil, penal, familia, tributario).
- ❌ App móvil en MVP.

## 4. Pricing Chile

| Plan | Precio/mes | Consultas IA | Cálculos | Escritos | Usuarios |
|------|------------|--------------|----------|----------|----------|
| **Solo** | **CLP 59.000** | 200 | ilimitado | 30 | 1 |
| **Estudio** | **CLP 189.000** | 1.000 | ilimitado | 150 | 3-5 |
| **Firma** | **CLP 449.000** | 5.000 | ilimitado | ilimitado | 6-15 |

**Anclaje de venta:** *"menos que una hora de tu tiempo facturado al mes"*.

Costo variable Plan Solo ≈ CLP 13.000. Margen bruto ~78%.

## 5. La promesa del Plan Solo

### "59 lucas al mes. 7 horas más a la semana. El asistente que tu estudio no tiene."

**Uso típico mensual y ahorro:**

| Tarea | Cantidad/mes | Manual | LexTrack | Ahorro |
|-------|--------------|--------|----------|--------|
| Escritos largos (demandas) | 12 | 2h c/u | 10 min | 22h |
| Escritos cortos (cartas, finiquitos) | 15 | 20 min c/u | 2 min | 4,5h |
| Cálculos | 20 | 20 min c/u | 1 min | 6h |
| Consultas / jurisprudencia | 80 | 12 min c/u | 1 min | 15h |
| **Total** | | | | **≈ 47h/mes** |

Conservador: **30h/mes ≈ 7h/semana**.
ROI vs hora facturada CLP 30.000: **~15x**.

## 6. Diferenciador defendible (moat)

1. **Corpus legal chileno laboral curado y fresco** — scraping centralizado a Poder Judicial, Diario Oficial, Dirección del Trabajo. Un solo worker, base compartida. Cada usuario nuevo cuesta ~0 en ingesta.
2. **Verificación de citas** — anti-alucinación. Una sola cita inventada y perdemos al cliente. El sistema sabe decir "no lo sé".
3. **Calculadoras laborales chilenas** — tope 11 años, recargos art. 168, semana corrida, gratificación art. 50 vs 47, etc. Difícil de copiar bien.
4. **Foco vertical** — laboral chileno, no genérico. Imposible de hacer bien para un competidor horizontal.

## 7. Métricas de validación

**Pre-MVP (no codear sin esto):** demo a 10 abogados. Pregunta clave: *"¿pagarías CLP 59.000/mes por esto?"* Si <6/10 dicen sí, ajustar antes de construir.

**Post-launch — North Star:** escritos generados por usuario/semana. Si <3, no hay retención.

**Métricas secundarias:**
- Activación: % de usuarios que generan su primer escrito en <24h del signup.
- Retención semana 4.
- Citas verificadas vs rechazadas (proxy de calidad RAG).

## 8. Riesgo legal cubierto desde día 1

- Disclaimer visible en cada output: *"Asistente, no reemplaza tu criterio profesional."*
- Logs auditables de cada respuesta con sus citas.
- T&C que limiten responsabilidad por errores del modelo.
- No retener PII de clientes finales del abogado más allá de lo necesario.
