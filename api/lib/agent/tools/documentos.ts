import type { ToolInput, AgentContext } from "../types";

export async function executeGenerarDocumento(input: ToolInput, _ctx: AgentContext): Promise<string> {
  const tipo = String(input.tipo);
  const hoy = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
  const trabajador = String(input.trabajador ?? "[NOMBRE TRABAJADOR]");
  const rutTrab = String(input.rut_trabajador ?? "[RUT]");
  const empresa = String(input.empresa ?? "[EMPRESA]");
  const rutEmp = String(input.rut_empresa ?? "[RUT EMPRESA]");
  const representante = String(input.representante ?? "[REPRESENTANTE LEGAL]");
  const remuneracion = Number(input.remuneracion) || 0;
  const anios = Number(input.anios_servicio) || 0;
  const fechaIngreso = String(input.fecha_ingreso ?? "[FECHA INGRESO]");
  const fechaTermino = String(input.fecha_termino ?? "[FECHA TÉRMINO]");
  const causal = String(input.causal ?? "");
  const hechos = String(input.hechos ?? "");
  const tribunal = String(input.tribunal ?? "[TRIBUNAL]");
  const rit = String(input.rit ?? "[RIT]");
  const datosAdicionales = String(input.datos_adicionales ?? "");

  const UF = 37200;
  const remCalc = Math.min(remuneracion, 90 * UF);
  const totalAnios = Math.min(anios, 11);
  const indemnizacion = totalAnios * remCalc;
  const avisoPrevio = remCalc;
  const fmtCLP = (n: number) => `$${n.toLocaleString("es-CL")}`;

  let documento = "";

  switch (tipo) {
    case "carta_aviso_despido":
      documento = `# CARTA DE AVISO DE TÉRMINO DE CONTRATO DE TRABAJO

**Fecha:** ${hoy}

**Señor(a):** ${trabajador}
**RUT:** ${rutTrab}
**Presente**

**De:** ${empresa} (RUT: ${rutEmp})

**REF:** Comunicación de término de relación laboral conforme al Art. 162 del Código del Trabajo.

---

Por medio de la presente, y de conformidad con lo dispuesto en los artículos 159, 160 y/o 161 del Código del Trabajo, se comunica a usted que su contrato de trabajo terminará con fecha **${fechaTermino}**.

## CAUSAL INVOCADA

${causal || "Necesidades de la empresa, Art. 161 inciso 1° del Código del Trabajo."}

## HECHOS QUE FUNDAMENTAN LA CAUSAL

${hechos || "[Describir circunstancias fácticas que configuran la causal invocada]"}

## INDEMNIZACIONES OFRECIDAS

| Concepto | Monto |
|----------|-------|
| Indemnización por años de servicio (Art. 163 CT) | ${remuneracion ? fmtCLP(indemnizacion) : "[CALCULAR]"} |
| Indemnización sustitutiva del aviso previo (Art. 161 inc. 2° CT) | ${remuneracion ? fmtCLP(avisoPrevio) : "[CALCULAR]"} |
| Feriado proporcional (Art. 73 CT) | [CALCULAR según días pendientes] |
| Remuneraciones adeudadas | [Si aplica] |
| **TOTAL ESTIMADO** | ${remuneracion ? fmtCLP(indemnizacion + avisoPrevio) : "[CALCULAR]"} |

## DATOS DEL CONTRATO

- Fecha de ingreso: ${fechaIngreso}
- Fecha de término: ${fechaTermino}
- Antigüedad: ${anios ? `${anios} años` : "[CALCULAR]"}
- Última remuneración: ${remuneracion ? fmtCLP(remuneracion) : "[MONTO]"}

## INFORMACIÓN AL TRABAJADOR

Se le informa que tiene derecho a:
1. **Firmar bajo protesta** conforme al Art. 169 letra a) del CT, reservándose el derecho a reclamar judicialmente.
2. **Reclamar judicialmente** dentro del plazo de **60 días hábiles** desde la separación (Art. 168 CT).
3. **Cobrar el seguro de cesantía** si corresponde (Ley 19.728).

---

**${representante}**
Representante Legal — ${empresa}

cc: Inspección del Trabajo competente (Art. 162 inc. 6° CT)
${datosAdicionales ? `\nNota: ${datosAdicionales}` : ""}

---
*Documento generado por LexTrack. Sujeto a revisión profesional.*`;
      break;

    case "demanda_indemnizacion":
      documento = `# DEMANDA DE INDEMNIZACIÓN POR DESPIDO INJUSTIFICADO, INDEBIDO O IMPROCEDENTE

**Tribunal:** ${tribunal}
**RIT:** ${rit}
**Materia:** Despido injustificado — Cobro de prestaciones laborales

---

## EN LO PRINCIPAL: Demanda de despido injustificado y cobro de indemnizaciones.
## PRIMER OTROSÍ: Acompaña documentos.
## SEGUNDO OTROSÍ: Patrocinio y poder.

---

**S.J.L. DEL TRABAJO**

**${trabajador}**, RUT ${rutTrab}, trabajador, domiciliado en [DOMICILIO], a US. respetuosamente digo:

## I. PARTES

**Demandante:** ${trabajador}, RUT ${rutTrab}
**Demandado:** ${empresa}, RUT ${rutEmp}, representada legalmente por ${representante}, domiciliada en [DOMICILIO EMPRESA]

## II. RELACIÓN LABORAL

El demandante prestó servicios para la demandada desde el **${fechaIngreso}** hasta el **${fechaTermino}**, desempeñándose como [CARGO]. Su última remuneración mensual ascendía a ${remuneracion ? fmtCLP(remuneracion) : "[MONTO]"}.

## III. HECHOS

${hechos || `1. Con fecha ${fechaTermino}, la demandada procedió a poner término a la relación laboral invocando la causal del Art. 161 del Código del Trabajo.
2. La causal invocada carece de fundamento fáctico suficiente, toda vez que [DESCRIBIR POR QUÉ NO SE CONFIGURA LA CAUSAL].
3. En subsidio, la demandada no cumplió con las formalidades del Art. 162 del CT [si aplica].`}

## IV. DERECHO

1. **Art. 168 CT**: El trabajador cuyo contrato termine por aplicación injustificada de las causales de los Arts. 159, 160 o 161 CT tiene derecho a las indemnizaciones establecidas en los Arts. 162 a 163 CT, con los incrementos del Art. 168.
2. **Art. 163 CT**: Indemnización por años de servicio equivalente a 30 días de última remuneración por cada año y fracción superior a 6 meses, con tope de 11 años (330 días).
3. **Art. 172 CT**: Para los efectos del cálculo, la última remuneración comprende toda cantidad que estuviere percibiendo el trabajador.
4. **Art. 168 inc. 3° CT**: Las indemnizaciones se incrementarán en un 30% si se declara injustificado (Art. 161), 50% si se declara injustificado (Art. 159/160), u 80% si no se invocó causal o no se cumplieron formalidades.

## V. PRESTACIONES DEMANDADAS

| Concepto | Base de cálculo | Monto |
|----------|----------------|-------|
| Indemnización por años de servicio (${anios} años) | ${remuneracion ? fmtCLP(remCalc) : "[MONTO]"} × ${totalAnios} | ${remuneracion ? fmtCLP(indemnizacion) : "[CALCULAR]"} |
| Indemnización sustitutiva aviso previo | ${remuneracion ? fmtCLP(remCalc) : "[MONTO]"} | ${remuneracion ? fmtCLP(avisoPrevio) : "[CALCULAR]"} |
| Recargo 30% Art. 168 (si Art. 161) | — | ${remuneracion ? fmtCLP(Math.round(indemnizacion * 0.3)) : "[CALCULAR]"} |
| Feriado proporcional | — | [CALCULAR] |
| Remuneraciones adeudadas | — | [Si aplica] |
| Cotizaciones previsionales impagas | — | [Si aplica, Art. 162 inc. 5°] |
| **TOTAL** | | ${remuneracion ? fmtCLP(Math.round(indemnizacion + avisoPrevio + indemnizacion * 0.3)) : "[CALCULAR]"} |

## VI. PETITORIO

**POR TANTO**, en mérito de lo expuesto, normas legales citadas y demás pertinentes:

**RUEGO A US.:** tener por interpuesta demanda de despido injustificado en contra de **${empresa}**, representada por **${representante}**, y en definitiva declarar:

1. Que el despido ha sido **injustificado** (o indebido/improcedente).
2. Condenar a la demandada al pago de las indemnizaciones señaladas en el punto V, con los recargos del Art. 168 CT.
3. Condenar al pago de las cotizaciones previsionales adeudadas, si las hubiere.
4. Condenar al pago de intereses y reajustes conforme al Art. 63 CT.
5. Condenar en costas.

---

**PRIMER OTROSÍ:** Acompaño los siguientes documentos:
1. Contrato de trabajo
2. Liquidaciones de sueldo (últimos 3 meses)
3. Carta de despido
4. [Otros documentos relevantes]

**SEGUNDO OTROSÍ:** Designo abogado patrocinante y confiero poder a don/doña [ABOGADO], RUT [RUT ABOGADO].

${datosAdicionales ? `\n---\nAntecedentes adicionales: ${datosAdicionales}` : ""}

---
*Documento generado por LexTrack. REQUIERE revisión profesional antes de presentación.*`;
      break;

    case "finiquito":
      documento = `# FINIQUITO DE TRABAJO

**Fecha:** ${hoy}

---

En Santiago de Chile, a ${hoy}, entre **${empresa}**, RUT ${rutEmp}, representada por **${representante}**, en adelante "el Empleador", y **${trabajador}**, RUT ${rutTrab}, en adelante "el Trabajador", se celebra el siguiente finiquito:

## PRIMERO: ANTECEDENTES

El Trabajador prestó servicios para el Empleador desde el **${fechaIngreso}** hasta el **${fechaTermino}**, en calidad de [CARGO].

## SEGUNDO: CAUSAL DE TÉRMINO

El contrato de trabajo terminó por la causal del **${causal || "Art. 161 inc. 1° del Código del Trabajo (necesidades de la empresa)"}**.

## TERCERO: PRESTACIONES

El Empleador paga al Trabajador las siguientes sumas:

| Concepto | Monto |
|----------|-------|
| Remuneración proporcional (días trabajados mes actual) | [CALCULAR] |
| Indemnización por años de servicio (Art. 163 CT) | ${remuneracion ? fmtCLP(indemnizacion) : "[CALCULAR]"} |
| Indemnización sustitutiva aviso previo (Art. 161 CT) | ${remuneracion ? fmtCLP(avisoPrevio) : "[CALCULAR]"} |
| Feriado legal proporcional (Art. 73 CT) | [CALCULAR] |
| Gratificación proporcional (Art. 47 CT) | [Si aplica] |
| Otros: [detallar] | [MONTO] |
| **TOTAL BRUTO** | ${remuneracion ? fmtCLP(indemnizacion + avisoPrevio) + " + otros" : "[CALCULAR]"} |
| Descuentos legales (impuestos, cotizaciones) | [CALCULAR] |
| **TOTAL LÍQUIDO** | [CALCULAR] |

## CUARTO: DECLARACIONES

El Trabajador declara que con el pago de las sumas indicadas, el Empleador ha cumplido íntegramente con todas sus obligaciones laborales, previsionales y de seguridad social, declarándose total y completamente pagado de todo concepto.

## QUINTO: RESERVA DE DERECHOS

${datosAdicionales?.includes("protesta") ? "El Trabajador firma el presente finiquito haciendo expresa reserva de sus derechos conforme al Art. 169 letra a) del Código del Trabajo." : "El Trabajador no formula reserva alguna respecto de las prestaciones recibidas."}

## SEXTO: RATIFICACIÓN

El presente finiquito se ratificará ante la Inspección del Trabajo / Notario Público / Presidente del Sindicato, conforme al Art. 177 del Código del Trabajo.

---

| | |
|---|---|
| **EL EMPLEADOR** | **EL TRABAJADOR** |
| ${representante} | ${trabajador} |
| RUT: ${rutEmp} | RUT: ${rutTrab} |
| | |
| _________________________ | _________________________ |
| Firma | Firma |

**MINISTRO DE FE:**

_________________________
[Nombre y cargo del ministro de fe]

---
*Documento generado por LexTrack. REQUIERE ratificación conforme al Art. 177 CT.*`;
      break;

    case "carta_amonestacion":
      documento = `# CARTA DE AMONESTACIÓN

**Fecha:** ${hoy}

**Señor(a):** ${trabajador}
**RUT:** ${rutTrab}
**Cargo:** [CARGO]
**Presente**

**De:** ${empresa} (RUT: ${rutEmp})

---

Por medio de la presente se le comunica que, conforme al Reglamento Interno de Orden, Higiene y Seguridad de la empresa, se ha resuelto aplicar a usted una **amonestación ${causal?.includes("grave") ? "grave" : "escrita"}** por los siguientes hechos:

## HECHOS

${hechos || "[Describir conducta específica, fecha, hora, lugar y circunstancias]"}

## NORMA INFRINGIDA

${causal || "[Indicar artículo del Reglamento Interno, obligación contractual o norma legal infringida]"}

## ADVERTENCIA

Se le informa que de reiterarse esta conducta, la empresa podrá aplicar sanciones más graves, incluyendo el término de la relación laboral conforme a las causales del Art. 160 del Código del Trabajo.

Usted tiene derecho a responder por escrito a la presente comunicación dentro de [PLAZO según Reglamento Interno].

---

**${representante}**
Representante Legal — ${empresa}

**Recepción del trabajador:**

Nombre: ${trabajador}
Fecha: ___/___/______
Firma: _________________________

cc: Carpeta personal del trabajador
${datosAdicionales ? `\nObservaciones: ${datosAdicionales}` : ""}

---
*Documento generado por LexTrack. Sujeto a revisión profesional.*`;
      break;

    case "recurso_nulidad":
      documento = `# RECURSO DE NULIDAD LABORAL

**Tribunal:** Ilustrísima Corte de Apelaciones de [CIUDAD]
**Ingreso Corte:** [POR ASIGNAR]
**RIT origen:** ${rit}
**Tribunal origen:** ${tribunal}

---

## EN LO PRINCIPAL: Deduce recurso de nulidad.
## OTROSÍ: Patrocinio y poder.

---

**ILUSTRÍSIMA CORTE DE APELACIONES**

**${trabajador}**, RUT ${rutTrab}, representado por su abogado **${representante}**, en los autos RIT ${rit} del ${tribunal}, a US. Ilustrísima respetuosamente digo:

Que, dentro del plazo legal de **10 días hábiles** contados desde la notificación de la sentencia definitiva (Art. 479 CT), vengo en deducir **recurso de nulidad** en contra de la sentencia de fecha [FECHA SENTENCIA], por las siguientes causales:

## I. CAUSAL INVOCADA

${causal || `**Art. 477 del Código del Trabajo** — La sentencia ha sido dictada con infracción de ley que ha influido sustancialmente en lo dispositivo del fallo.

**Norma infringida:** [Indicar artículo específico]

**En subsidio, Art. 478 letra [X] CT:** [Causal subsidiaria si aplica]`}

## II. HECHOS

${hechos || "[Describir los hechos establecidos en la sentencia que se impugnan y la forma en que se configura la causal de nulidad]"}

## III. INFLUENCIA EN LO DISPOSITIVO

[Explicar cómo la infracción de ley influyó sustancialmente en la parte resolutiva de la sentencia]

## IV. PETITORIO

**POR TANTO**, de conformidad con los Arts. 477, 478 y 479 del Código del Trabajo:

**RUEGO A US. ILUSTRÍSIMA:**
1. Tener por deducido recurso de nulidad en contra de la sentencia de fecha [FECHA].
2. Declarar la nulidad de la sentencia recurrida.
3. Dictar sentencia de reemplazo que [INDICAR LO SOLICITADO], o en subsidio, determinar el estado en que ha de quedar el proceso y ordenar la remisión del mismo al tribunal no inhabilitado que corresponda.

---

${datosAdicionales ? `Antecedentes adicionales: ${datosAdicionales}\n\n---` : ""}
*Documento generado por LexTrack. REQUIERE revisión profesional obligatoria antes de presentación. Plazo fatal: 10 días hábiles desde notificación (Art. 479 CT).*`;
      break;

    case "recurso_apelacion":
      documento = `# RECURSO DE APELACIÓN

**RIT:** ${rit}
**Tribunal:** ${tribunal}

---

**S.J.L. DEL TRABAJO**

En los autos RIT **${rit}**, **${trabajador}** (RUT ${rutTrab}), representado por **${representante}**, a US. respetuosamente digo:

Que, dentro del plazo legal de **5 días hábiles** (Art. 476 CT), vengo en apelar de la resolución de fecha [FECHA RESOLUCIÓN], por causar agravio a mi representado.

## AGRAVIO

${hechos || "[Explicar el agravio causado por la resolución apelada y los fundamentos de la apelación]"}

## PETICIONES CONCRETAS

${causal || "Se solicita revocar la resolución apelada y en su lugar [INDICAR LO SOLICITADO]."}

**POR TANTO**, ruego a US. tener por interpuesto recurso de apelación, concederlo y elevar los antecedentes al tribunal superior.

---
*Nota: En materia laboral, la apelación procede solo contra resoluciones expresamente señaladas en el Art. 476 CT (sentencias interlocutorias que pongan término al juicio o hagan imposible su continuación, y las que se pronuncien sobre medidas cautelares).*

${datosAdicionales ? `\nAntecedentes: ${datosAdicionales}` : ""}

---
*Documento generado por LexTrack. REQUIERE revisión profesional.*`;
      break;

    case "carta_renuncia":
      documento = `# CARTA DE RENUNCIA VOLUNTARIA

**Fecha:** ${hoy}

**Señor(a):** ${representante || "[REPRESENTANTE EMPRESA]"}
**${empresa}**
**Presente**

---

De mi consideración:

Por medio de la presente, yo **${trabajador}**, RUT ${rutTrab}, comunico a usted mi renuncia voluntaria al cargo que desempeño en ${empresa}, con efectividad a contar del **${fechaTermino || "[FECHA]"}**.

${hechos ? `Motivo: ${hechos}` : ""}

Solicito se sirva proceder con el finiquito correspondiente conforme al Art. 177 del Código del Trabajo, dentro del plazo de 10 días hábiles contados desde la separación efectiva.

Agradezco la oportunidad laboral brindada durante ${anios ? `${anios} años` : "el tiempo"} de servicio.

---

**${trabajador}**
RUT: ${rutTrab}

Firma: _________________________

---

**Recepción del empleador:**
Nombre: _________________________
Fecha: ___/___/______
Firma: _________________________

---
*Documento generado por LexTrack.*`;
      break;

    case "acta_comparendo":
      documento = `# ACTA DE COMPARENDO DE CONCILIACIÓN

**RIT:** ${rit}
**Tribunal:** ${tribunal}
**Fecha:** ${hoy}

---

En ${tribunal}, siendo las [HORA] horas del día ${hoy}, se lleva a efecto la audiencia de conciliación en los autos RIT ${rit}, compareciendo:

**Demandante:** ${trabajador}, RUT ${rutTrab}, representado por [ABOGADO DEMANDANTE].
**Demandado:** ${empresa}, RUT ${rutEmp}, representado por ${representante}.

---

## PROPOSICIÓN DE BASES DE CONCILIACIÓN

El tribunal propone las siguientes bases de arreglo:

${hechos || "[Describir las bases de conciliación propuestas]"}

## RESULTADO

${causal || "[ ] Las partes ACEPTAN las bases propuestas.\n[ ] Las partes NO logran acuerdo. Se cita a audiencia de juicio."}

## ACUERDO (si aplica)

${datosAdicionales || "[Describir los términos del acuerdo alcanzado, montos, plazos de pago, etc.]"}

---

Firma demandante: _________________________
Firma demandado: _________________________
Firma juez: _________________________

---
*Documento generado por LexTrack. Formato referencial.*`;
      break;

    default:
      documento = `Tipo de documento "${tipo}" no reconocido. Tipos disponibles: carta_aviso_despido, demanda_indemnizacion, finiquito, carta_amonestacion, recurso_nulidad, recurso_apelacion, carta_renuncia, acta_comparendo.`;
  }

  return JSON.stringify({
    tipo,
    documento,
    advertencia: "Este documento es un borrador generado automáticamente. REQUIERE revisión y ajuste por un abogado antes de su uso. No constituye asesoría legal.",
    datosUsados: { trabajador, empresa, remuneracion, anios, causal: causal || null },
  });
}
