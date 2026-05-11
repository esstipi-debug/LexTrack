/**
 * Generador de Protocolo de Prevención y Procedimiento Ley Karin (Ley 21.643).
 *
 * Función pura, determinística, sin LLM. Produce Markdown a partir de los datos
 * de la empresa. El abogado puede luego editarlo y exportarlo a PDF/DOCX.
 *
 * Base legal: Ley 21.643 (Diario Oficial 15-ene-2024, vigencia 1-ago-2024).
 * Modifica arts. 2, 184, 184 bis, 211-A a 211-E del Código del Trabajo y
 * crea Título IV "De la investigación y sanción del acoso laboral, sexual y
 * violencia en el trabajo".
 */

export type CanalDenuncia =
  | "presencial"
  | "escrito_fisico"
  | "formulario_web"
  | "correo_electronico"
  | "linea_telefonica"
  | "buzon_anonimo";

export interface EmpresaInput {
  razonSocial: string;
  rut: string;
  rubro: string;
  domicilioPrincipal: string;
  dotacionTotal: number;
  sucursales: string[];

  encargadoNombre: string;
  encargadoCargo: string;
  encargadoEmail: string;
  encargadoTelefono?: string;

  encargadoSuplenteNombre?: string;
  encargadoSuplenteCargo?: string;

  canalesDenuncia: CanalDenuncia[];
  emailDenuncias?: string;
  telefonoDenuncias?: string;
  urlFormulario?: string;

  representanteLegalNombre: string;
  representanteLegalRut: string;

  /** Fecha de entrada en vigencia del protocolo (ISO yyyy-mm-dd). */
  fechaVigencia: string;
}

const CANAL_LABEL: Record<CanalDenuncia, string> = {
  presencial: "Atención presencial con el/la encargado/a de denuncias",
  escrito_fisico: "Carta o formulario físico entregado en oficina de personal",
  formulario_web: "Formulario web confidencial disponible en la intranet",
  correo_electronico: "Correo electrónico institucional dedicado",
  linea_telefonica: "Línea telefónica de denuncias",
  buzon_anonimo: "Buzón físico para denuncias anónimas",
};

function formatFecha(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function listaCanales(empresa: EmpresaInput): string {
  return empresa.canalesDenuncia
    .map((c) => {
      let detalle = CANAL_LABEL[c];
      if (c === "correo_electronico" && empresa.emailDenuncias) {
        detalle += ` (${empresa.emailDenuncias})`;
      }
      if (c === "linea_telefonica" && empresa.telefonoDenuncias) {
        detalle += ` (${empresa.telefonoDenuncias})`;
      }
      if (c === "formulario_web" && empresa.urlFormulario) {
        detalle += ` (${empresa.urlFormulario})`;
      }
      return `- ${detalle}`;
    })
    .join("\n");
}

export function generarProtocoloKarin(empresa: EmpresaInput): string {
  const sucursalesTxt =
    empresa.sucursales.length > 0
      ? empresa.sucursales.map((s) => `- ${s}`).join("\n")
      : "- No aplica (domicilio único)";

  const suplente =
    empresa.encargadoSuplenteNombre && empresa.encargadoSuplenteCargo
      ? `En caso de ausencia, impedimento o cuando la denuncia involucre al/la encargado/a titular, actuará como **suplente**:\n\n- **Nombre:** ${empresa.encargadoSuplenteNombre}\n- **Cargo:** ${empresa.encargadoSuplenteCargo}`
      : "_(No se ha designado encargado/a suplente. Se recomienda hacerlo para casos de inhabilidad o conflicto de interés.)_";

  return `# PROTOCOLO DE PREVENCIÓN Y PROCEDIMIENTO DE INVESTIGACIÓN DEL ACOSO LABORAL, ACOSO SEXUAL Y VIOLENCIA EN EL TRABAJO

**Empresa:** ${empresa.razonSocial}
**RUT:** ${empresa.rut}
**Rubro:** ${empresa.rubro}
**Domicilio principal:** ${empresa.domicilioPrincipal}
**Dotación total:** ${empresa.dotacionTotal} trabajadores
**Vigencia:** desde ${formatFecha(empresa.fechaVigencia)}

**Marco legal:** Ley N° 21.643 (Ley Karin), que modifica el Código del Trabajo, el Estatuto Administrativo y el Estatuto Administrativo para Funcionarios Municipales, en materia de prevención, investigación y sanción del acoso laboral, sexual y de la violencia en el trabajo.

---

## 1. Objeto

El presente Protocolo establece la política de **${empresa.razonSocial}** (en adelante "la Empresa") en materia de prevención, investigación y sanción del acoso laboral, el acoso sexual y la violencia en el trabajo, dando cumplimiento a las obligaciones contenidas en la Ley N° 21.643 y en los artículos 2, 184, 184 bis y 211-A a 211-E del Código del Trabajo.

## 2. Ámbito de aplicación

Este Protocolo se aplica a **todas las personas trabajadoras** de la Empresa, incluyendo personal de planta, contrata, honorarios, plazo fijo, indefinido, jornada parcial, practicantes y todo aquel que preste servicios bajo vínculo de subordinación o dependencia, en cualquier sucursal o establecimiento de la Empresa:

${sucursalesTxt}

También se aplica a las relaciones con terceros (clientes, proveedores, usuarios) en el contexto de la **violencia en el trabajo** ejercida por personas ajenas a la relación laboral.

## 3. Política de tolerancia cero

La Empresa **rechaza y prohíbe expresamente** toda conducta constitutiva de acoso laboral, acoso sexual o violencia en el trabajo, sin importar la jerarquía, antigüedad o relación de quien la cometa. Toda denuncia será recibida, investigada y resuelta conforme a los principios de **confidencialidad, imparcialidad, celeridad, debido proceso y no represalia**.

## 4. Definiciones (artículo 2° del Código del Trabajo, reformado por Ley 21.643)

### 4.1 Acoso laboral
Toda conducta que constituya **agresión u hostigamiento** ejercida por el empleador o por uno o más trabajadores, contra otro u otros trabajadores, por cualquier medio, ya sea que se manifieste **una sola vez o de manera reiterada**, y que tenga como resultado para el o los afectados su menoscabo, maltrato o humillación, o bien que amenace o perjudique su situación laboral o sus oportunidades en el empleo.

### 4.2 Acoso sexual
El que una persona realice en forma indebida, por cualquier medio, **requerimientos de carácter sexual, no consentidos** por quien los recibe y que amenacen o perjudiquen su situación laboral o sus oportunidades en el empleo.

### 4.3 Violencia en el trabajo
Aquella ejercida por **terceras personas ajenas a la relación laboral** (clientes, proveedores, usuarios u otros) que afecten a la persona trabajadora con motivo de la prestación de servicios.

## 5. Medidas de prevención

La Empresa adoptará al menos las siguientes medidas preventivas:

1. **Difusión** de este Protocolo a toda la dotación, en formato físico y digital, al ingreso y al menos una vez al año.
2. **Capacitación obligatoria** anual sobre acoso laboral, acoso sexual, violencia en el trabajo y enfoque de género, en horario de trabajo, sin costo para la persona trabajadora.
3. **Evaluación periódica de riesgos psicosociales** conforme al Protocolo de Vigilancia de Riesgos Psicosociales en el Trabajo del Ministerio de Salud (CEAL-SM SUSESO).
4. **Cláusula expresa** en los contratos de trabajo y en el Reglamento Interno de Orden, Higiene y Seguridad que prohíbe las conductas reguladas por este Protocolo.
5. **Canales de denuncia accesibles, confidenciales y seguros** (ver sección 7).
6. **Designación formal de encargado/a** de recibir, dar curso e investigar denuncias (ver sección 6).

## 6. Persona encargada de recibir e investigar denuncias

Se designa como encargado/a titular para recibir, dar curso e investigar las denuncias formuladas en el marco de este Protocolo:

- **Nombre:** ${empresa.encargadoNombre}
- **Cargo:** ${empresa.encargadoCargo}
- **Correo electrónico:** ${empresa.encargadoEmail}
${empresa.encargadoTelefono ? `- **Teléfono:** ${empresa.encargadoTelefono}` : ""}

${suplente}

El/la encargado/a deberá actuar con **imparcialidad, reserva y diligencia**. Cuando la denuncia recaiga sobre el/la propio/a encargado/a o exista conflicto de interés, intervendrá el/la suplente o, en su defecto, la Empresa designará a otra persona idónea.

## 7. Canales de denuncia

La denuncia podrá presentarse de manera **verbal o escrita**, en forma **directa o anónima**, a través de los siguientes canales:

${listaCanales(empresa)}

Toda denuncia debe contener al menos: identificación de quien denuncia (salvo denuncia anónima), descripción de los hechos, identificación de la o las personas denunciadas, fechas y lugares aproximados, testigos si los hubiera y antecedentes de respaldo si existieran.

## 8. Procedimiento de investigación (arts. 211-A a 211-E del Código del Trabajo)

### 8.1 Recepción y registro
La denuncia se recibirá de manera **inmediata** y se levantará acta con folio único, hora y fecha.

### 8.2 Notificación
El/la encargado/a notificará al empleador y a la persona denunciada **dentro de los 3 días hábiles** siguientes a la recepción, salvo cuando ello pueda comprometer la investigación, en cuyo caso podrá diferirse fundadamente.

### 8.3 Medidas de resguardo
Dentro de los **3 días corridos** siguientes a la recepción, la Empresa adoptará **medidas de resguardo** respecto de la presunta víctima, considerando criterios de **proporcionalidad** y **enfoque de género**. Podrán incluir, entre otras:

- Separación de espacios físicos de la víctima y la persona denunciada.
- Modificación de turnos, jornada o lugar de prestación de servicios.
- Reasignación de funciones o de jefatura.
- Permiso o licencia médica preventiva.
- Derivación a asistencia psicológica.

### 8.4 Plazo de investigación
La investigación deberá concluir en un plazo máximo de **30 días corridos** contados desde la recepción de la denuncia. Por causa justificada y documentada, podrá prorrogarse fundadamente.

### 8.5 Confidencialidad
Toda la información recabada se mantendrá en estricta **reserva**. Quienes intervengan en la investigación están obligados a guardar confidencialidad sobre los hechos y antecedentes. La infracción a este deber será sancionada conforme al Reglamento Interno.

### 8.6 Debido proceso
Se garantizará a denunciante y denunciado/a:
- Audiencia.
- Derecho a presentar descargos, prueba y testigos.
- Asistencia y acompañamiento (sindical, gremial o persona de confianza).
- Información sobre el estado del procedimiento.

### 8.7 Informe final
Concluida la investigación, el/la encargado/a emitirá un **informe escrito y fundado** con los hechos acreditados, calificación jurídica, medidas y sanciones propuestas.

### 8.8 Resolución y sanciones
La Empresa adoptará las medidas correctivas y sanciones que correspondan en un plazo máximo de **15 días corridos** desde la emisión del informe, entre ellas: amonestación escrita, multa conforme al Reglamento Interno o **despido por las causales de los artículos 160 N° 1 letra b) o f), N° 7 u otra que corresponda**, sin perjuicio de las acciones civiles y penales.

### 8.9 Remisión a la Dirección del Trabajo
Si la Empresa no cumple con investigar dentro de plazo, o si la denunciante así lo solicita, los antecedentes serán remitidos a la **Dirección del Trabajo**, la que deberá emitir pronunciamiento en **30 días corridos**.

## 9. Prohibición de represalias

Queda **expresamente prohibida** toda represalia, directa o indirecta, contra quien denuncie, declare como testigo o participe en una investigación regulada por este Protocolo. Toda represalia será considerada infracción grave y sancionada con arreglo al Reglamento Interno y a la legislación vigente.

## 10. Asistencia y acompañamiento

La Empresa pondrá a disposición de las personas afectadas:
- Información sobre derechos y procedimientos.
- Derivación a asistencia psicológica y de salud mental.
- Coordinación con la mutualidad respectiva para evaluar accidente del trabajo de origen psicosocial cuando corresponda.

## 11. Vigencia, modificación y revisión

Este Protocolo entra en vigencia a contar del **${formatFecha(empresa.fechaVigencia)}** y será revisado al menos **una vez al año** o cuando ocurran modificaciones legales relevantes. Toda modificación será comunicada a la totalidad del personal y archivada con la versión anterior para fines de trazabilidad.

## 12. Sanciones a la Empresa por incumplimiento

El incumplimiento por parte del empleador de las obligaciones de prevención, investigación o sanción establecidas en la Ley N° 21.643 será sancionado por la Dirección del Trabajo conforme al artículo 506 del Código del Trabajo, sin perjuicio de las indemnizaciones que correspondan a la víctima.

---

**Firma del representante legal**

${empresa.representanteLegalNombre}
RUT: ${empresa.representanteLegalRut}
${empresa.razonSocial}

Fecha: ${formatFecha(empresa.fechaVigencia)}

---

_Documento generado con LexTrack — asistente legal para abogados laboralistas. Este protocolo es una plantilla base sujeta a revisión profesional. No reemplaza el criterio del abogado a cargo._
`;
}

/**
 * Versión corta para checklist de cumplimiento a entregar junto al protocolo.
 */
export function generarChecklistKarin(empresa: EmpresaInput): string {
  return `# CHECKLIST DE CUMPLIMIENTO LEY KARIN — ${empresa.razonSocial}

Fecha de vigencia del protocolo: ${formatFecha(empresa.fechaVigencia)}

## Acciones obligatorias

- [ ] Protocolo de prevención difundido a toda la dotación (físico y digital)
- [ ] Reglamento Interno de Orden, Higiene y Seguridad actualizado con cláusulas Ley Karin
- [ ] Cláusula contractual incorporada en contratos de trabajo nuevos y existentes
- [ ] Encargado/a titular designado/a formalmente y notificado/a (${empresa.encargadoNombre})
- [ ] Encargado/a suplente designado/a (${empresa.encargadoSuplenteNombre || "PENDIENTE"})
- [ ] Canales de denuncia operativos y comunicados (${empresa.canalesDenuncia.length} canales configurados)
- [ ] Capacitación inicial al personal completada y registrada
- [ ] Plan anual de capacitación 2026 definido
- [ ] Evaluación de riesgos psicosociales (CEAL-SM SUSESO) agendada
- [ ] Convenio o protocolo con mutualidad para derivación psicológica
- [ ] Formato de acta de recepción de denuncia preparado
- [ ] Formato de medidas de resguardo preparado
- [ ] Formato de informe final de investigación preparado
- [ ] Registro confidencial de denuncias habilitado
- [ ] Calendario de revisión anual del protocolo definido

## Hitos de plazo a recordar

| Hito | Plazo legal |
|---|---|
| Notificación a empleador y denunciado | 3 días hábiles desde recepción |
| Medidas de resguardo | 3 días corridos desde recepción |
| Conclusión de la investigación | 30 días corridos desde recepción |
| Aplicación de medidas/sanciones | 15 días corridos desde informe |
| Pronunciamiento DT si interviene | 30 días corridos |
`;
}
