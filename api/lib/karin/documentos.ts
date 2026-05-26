/**
 * Generadores de documentos Ley Karin (Ley 21.643).
 *
 * Funciones puras y determinísticas — sin LLM. Producen Markdown a partir de
 * datos estructurados. El abogado puede luego editarlos y exportar a PDF/DOCX.
 *
 * Base legal: Ley 21.643, arts. 211-A a 211-E del Código del Trabajo.
 */

// ─── Tipos ──────────────────────────────────────────────────────

export interface ActaRecepcionInput {
  folio: string;
  fecha: string; // ISO yyyy-mm-dd
  hora: string; // HH:MM
  empresa: string;

  denuncianteNombre: string;
  denuncianteRut: string;
  denuncianteCargo: string;

  denunciadoNombre: string;
  denunciadoCargo: string;

  tipo: "acoso_laboral" | "acoso_sexual" | "violencia_laboral" | "discriminacion" | "otro";
  descripcionHechos: string;
  testigos?: string;
  canalDenuncia: string;
  receptor: string;
  receptorCargo: string;
}

export interface InformeFinalInput {
  folio: string;
  empresa: string;
  fecha: string; // ISO
  investigador: string;
  investigadorCargo: string;

  denuncianteNombre: string;
  denuncianteRut?: string;
  denuncianteCargo?: string;

  denunciadoNombre: string;
  denunciadoRut?: string;
  denunciadoCargo?: string;

  tipo: "acoso_laboral" | "acoso_sexual" | "violencia_laboral" | "discriminacion" | "otro";
  fechaRecepcion: string;
  fechaInicioInvestigacion: string;
  fechaCierre: string;

  descripcionHechos: string;
  actuaciones: ActuacionInforme[];
  hechosAcreditados: string;
  calificacionJuridica: string;
  conclusion: "acreditado" | "no_acreditado" | "parcialmente_acreditado";
  fundamentoConclusion: string;
  medidasPropuestas: string[];
  sancionesPropuestas: string[];
}

export interface ActuacionInforme {
  fecha: string;
  tipo: string;
  descripcion: string;
  actor?: string;
}

export interface NotificacionMedidasInput {
  folio: string;
  fecha: string; // ISO
  empresa: string;
  representanteLegal: string;

  denuncianteNombre: string;
  denuncianteRut?: string;
  denuncianteCargo?: string;

  medidas: MedidaCautelar[];
  fechaInicio: string;
  fundamentoLegal?: string;
}

export interface MedidaCautelar {
  tipo: string;
  descripcion: string;
}

// ─── Helpers ────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  acoso_laboral: "Acoso laboral",
  acoso_sexual: "Acoso sexual",
  violencia_laboral: "Violencia en el trabajo",
  discriminacion: "Discriminación",
  otro: "Otra conducta denunciada",
};

const CONCLUSION_LABEL: Record<string, string> = {
  acreditado: "ACREDITADA la conducta denunciada",
  no_acreditado: "NO ACREDITADA la conducta denunciada",
  parcialmente_acreditado: "PARCIALMENTE ACREDITADA la conducta denunciada",
};

function formatFecha(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatFechaCorta(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── Acta de Recepción de Denuncia ──────────────────────────────

export function generarActaRecepcion(data: ActaRecepcionInput): string {
  const tipoLabel = TIPO_LABEL[data.tipo] || data.tipo;
  const testigosTxt = data.testigos
    ? data.testigos
    : "No se identifican testigos al momento de la recepción.";

  return `# ACTA DE RECEPCIÓN DE DENUNCIA — LEY KARIN (LEY 21.643)

**FOLIO:** ${data.folio}
**EMPRESA:** ${data.empresa}

---

## I. DATOS DE LA RECEPCIÓN

| Campo | Detalle |
|---|---|
| **Fecha de recepción** | ${formatFecha(data.fecha)} |
| **Hora de recepción** | ${data.hora} hrs. |
| **Canal de denuncia** | ${data.canalDenuncia} |
| **Receptor/a** | ${data.receptor} — ${data.receptorCargo} |

## II. IDENTIFICACIÓN DEL/LA DENUNCIANTE

| Campo | Detalle |
|---|---|
| **Nombre completo** | ${data.denuncianteNombre} |
| **RUT** | ${data.denuncianteRut} |
| **Cargo** | ${data.denuncianteCargo} |

## III. IDENTIFICACIÓN DEL/LA DENUNCIADO/A

| Campo | Detalle |
|---|---|
| **Nombre completo** | ${data.denunciadoNombre} |
| **Cargo** | ${data.denunciadoCargo} |

## IV. TIPO DE CONDUCTA DENUNCIADA

**${tipoLabel}**

(Conforme a las definiciones del artículo 2° del Código del Trabajo, modificado por Ley N° 21.643)

## V. DESCRIPCIÓN DE LOS HECHOS

${data.descripcionHechos}

## VI. TESTIGOS

${testigosTxt}

## VII. ADVERTENCIA DE CONFIDENCIALIDAD

Se informa al/a la denunciante que, conforme a lo dispuesto en la Ley N° 21.643 y los artículos 211-A a 211-E del Código del Trabajo:

1. **Confidencialidad:** La denuncia y toda la información recabada durante la investigación se mantendrán en estricta reserva. Todas las personas que intervengan en el procedimiento están obligadas a guardar confidencialidad sobre los hechos y antecedentes.

2. **Medidas de resguardo:** Dentro de los **3 días corridos** siguientes a esta recepción, la empresa adoptará medidas de resguardo respecto del/la denunciante, conforme al artículo 211-B inciso 3° del Código del Trabajo.

3. **Plazo de investigación:** La investigación deberá concluir en un plazo máximo de **30 días corridos** contados desde esta fecha de recepción.

4. **Debido proceso:** Se garantiza a ambas partes el derecho a audiencia, presentación de descargos, prueba y testigos, y acompañamiento durante el proceso.

5. **Prohibición de represalias:** Queda expresamente prohibida toda represalia, directa o indirecta, contra quien denuncie, declare como testigo o participe en la investigación.

6. **Remisión a la Dirección del Trabajo:** El/la denunciante tiene derecho a solicitar que los antecedentes sean remitidos directamente a la Dirección del Trabajo en cualquier momento.

## VIII. FIRMAS

**Denunciante:**

Nombre: ${data.denuncianteNombre}
RUT: ${data.denuncianteRut}
Firma: ________________________________________

**Receptor/a de la denuncia:**

Nombre: ${data.receptor}
Cargo: ${data.receptorCargo}
Firma: ________________________________________

**Lugar y fecha:** ${formatFecha(data.fecha)}, ${data.hora} hrs.

---

_Documento generado con LexTrack — Folio ${data.folio}. Acta sujeta a revisión profesional._
`;
}

// ─── Informe Final de Investigación ─────────────────────────────

export function generarInformeFinal(data: InformeFinalInput): string {
  const tipoLabel = TIPO_LABEL[data.tipo] || data.tipo;
  const conclusionLabel = CONCLUSION_LABEL[data.conclusion] || data.conclusion;

  const actuacionesTxt = data.actuaciones
    .map(
      (a, i) =>
        `| ${i + 1} | ${formatFechaCorta(a.fecha)} | ${a.tipo} | ${a.descripcion} | ${a.actor || "—"} |`
    )
    .join("\n");

  const medidasTxt =
    data.medidasPropuestas.length > 0
      ? data.medidasPropuestas.map((m) => `- ${m}`).join("\n")
      : "- No se proponen medidas adicionales.";

  const sancionesTxt =
    data.sancionesPropuestas.length > 0
      ? data.sancionesPropuestas.map((s) => `- ${s}`).join("\n")
      : "- No se proponen sanciones.";

  return `# INFORME FINAL DE INVESTIGACIÓN — LEY KARIN (LEY 21.643)

**FOLIO:** ${data.folio}
**EMPRESA:** ${data.empresa}
**FECHA DEL INFORME:** ${formatFecha(data.fecha)}

**Base legal:** Artículos 211-A a 211-E del Código del Trabajo, modificados por Ley N° 21.643.

---

## I. ANTECEDENTES

### 1.1 Datos de la denuncia

| Campo | Detalle |
|---|---|
| **Folio** | ${data.folio} |
| **Tipo de conducta** | ${tipoLabel} |
| **Fecha de recepción** | ${formatFecha(data.fechaRecepcion)} |
| **Fecha inicio investigación** | ${formatFecha(data.fechaInicioInvestigacion)} |
| **Fecha cierre investigación** | ${formatFecha(data.fechaCierre)} |

### 1.2 Identificación de las partes

**Denunciante:**
- Nombre: ${data.denuncianteNombre}
${data.denuncianteRut ? `- RUT: ${data.denuncianteRut}` : ""}
${data.denuncianteCargo ? `- Cargo: ${data.denuncianteCargo}` : ""}

**Denunciado/a:**
- Nombre: ${data.denunciadoNombre}
${data.denunciadoRut ? `- RUT: ${data.denunciadoRut}` : ""}
${data.denunciadoCargo ? `- Cargo: ${data.denunciadoCargo}` : ""}

### 1.3 Investigador/a designado/a

- Nombre: ${data.investigador}
- Cargo: ${data.investigadorCargo}

## II. HECHOS DENUNCIADOS

${data.descripcionHechos}

## III. DILIGENCIAS PRACTICADAS

| N° | Fecha | Tipo | Descripción | Actor |
|---|---|---|---|---|
${actuacionesTxt}

## IV. HECHOS ACREDITADOS

${data.hechosAcreditados}

## V. CALIFICACIÓN JURÍDICA

${data.calificacionJuridica}

## VI. CONCLUSIONES

### Resultado de la investigación:

**${conclusionLabel}**

### Fundamentación:

${data.fundamentoConclusion}

## VII. MEDIDAS PROPUESTAS

### 7.1 Medidas correctivas

${medidasTxt}

### 7.2 Sanciones propuestas

${sancionesTxt}

**Plazo para aplicación:** La empresa deberá adoptar las medidas correctivas y sanciones dentro de los **15 días corridos** siguientes a la emisión de este informe, conforme al procedimiento establecido en el artículo 211-E del Código del Trabajo.

## VIII. RESERVA Y CONFIDENCIALIDAD

Este informe y toda la documentación que lo respalda tienen carácter **estrictamente confidencial**. Su divulgación no autorizada constituye infracción al deber de reserva establecido en la Ley N° 21.643 y será sancionada conforme al Reglamento Interno de Orden, Higiene y Seguridad de la empresa.

## IX. FIRMA DEL INVESTIGADOR/A

Nombre: ${data.investigador}
Cargo: ${data.investigadorCargo}
Firma: ________________________________________

Fecha: ${formatFecha(data.fecha)}

---

_Documento generado con LexTrack — Folio ${data.folio}. Informe sujeto a revisión profesional. No reemplaza el criterio del abogado a cargo._
`;
}

// ─── Notificación de Medidas Cautelares ─────────────────────────

export function generarNotificacionMedidas(data: NotificacionMedidasInput): string {
  const medidasList = data.medidas
    .map(
      (m, i) =>
        `${i + 1}. **${m.tipo}:** ${m.descripcion}`
    )
    .join("\n");

  const fundamento =
    data.fundamentoLegal ||
    "Artículo 211-B inciso 3° del Código del Trabajo, modificado por Ley N° 21.643, que establece la obligación del empleador de adoptar medidas de resguardo dentro de los 3 días corridos siguientes a la recepción de la denuncia, considerando criterios de proporcionalidad y enfoque de género.";

  return `# NOTIFICACIÓN DE MEDIDAS CAUTELARES — LEY KARIN (LEY 21.643)

**FOLIO:** ${data.folio}
**EMPRESA:** ${data.empresa}
**FECHA:** ${formatFecha(data.fecha)}

---

## I. DESTINATARIO/A

| Campo | Detalle |
|---|---|
| **Nombre** | ${data.denuncianteNombre} |
${data.denuncianteRut ? `| **RUT** | ${data.denuncianteRut} |` : ""}
${data.denuncianteCargo ? `| **Cargo** | ${data.denuncianteCargo} |` : ""}

## II. FUNDAMENTO LEGAL

${fundamento}

## III. MEDIDAS DE RESGUARDO ADOPTADAS

Las siguientes medidas de resguardo han sido adoptadas por **${data.empresa}** para proteger al/a la denunciante, con fecha de inicio **${formatFecha(data.fechaInicio)}**:

${medidasList}

## IV. VIGENCIA

Las medidas indicadas entrarán en vigencia a contar del **${formatFecha(data.fechaInicio)}** y se mantendrán mientras dure la investigación o hasta que sean modificadas o revocadas por resolución fundada.

## V. DERECHOS DEL/LA TRABAJADOR/A

Se informa al/a la trabajador/a que:

1. Estas medidas tienen como **único propósito** su protección y resguardo durante el proceso de investigación.
2. Las medidas **no constituyen sanción** y no afectan sus derechos laborales ni remuneracionales.
3. Si considera que las medidas son insuficientes o inadecuadas, puede solicitar su revisión o complementación ante el/la encargado/a de la investigación.
4. Tiene derecho a solicitar la intervención de la **Dirección del Trabajo** si estima que las medidas no son proporcionales o suficientes.
5. Queda **expresamente prohibida** toda represalia en su contra por haber formulado la denuncia.

## VI. FIRMAS

**Por la empresa:**

Nombre: ${data.representanteLegal}
Cargo: Representante legal
Firma: ________________________________________

**Notificado/a:**

Nombre: ${data.denuncianteNombre}
Firma: ________________________________________

**Fecha de notificación:** ${formatFecha(data.fecha)}

---

_Documento generado con LexTrack — Folio ${data.folio}. Notificación sujeta a revisión profesional._
`;
}
