import type { Honorario } from "@db/schema";
import { calcularInteresMora, type InteresCalculo } from "./intereses";

// ─── Helpers ─────────────────────────────────────────────────────

function fmt(n: number): string {
  return "$" + n.toLocaleString("es-CL");
}

function hoy(): string {
  return new Date().toISOString().split("T")[0];
}

function diasMora(h: Honorario): number {
  if (!h.fechaVencimiento) return 0;
  const diff =
    new Date().getTime() - new Date(h.fechaVencimiento).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function pendiente(h: Honorario): number {
  return h.monto - (h.montoPagado || 0);
}

// ─── a) Estado de Cuenta ─────────────────────────────────────────

export function generarEstadoCuenta(
  cliente: string,
  honorariosCliente: Honorario[],
): string {
  const fecha = hoy();

  // Calculate interest for each overdue item
  const filas = honorariosCliente.map((h) => {
    const pend = pendiente(h);
    const mora = diasMora(h);
    let interes: InteresCalculo | null = null;
    if (h.fechaVencimiento && mora > 0 && pend > 0) {
      interes = calcularInteresMora({
        monto: h.monto,
        montoPagado: h.montoPagado || 0,
        fechaVencimiento: h.fechaVencimiento,
      });
    }
    return { h, pend, mora, interes };
  });

  // Subtotals by estado
  const porEstado = new Map<string, { count: number; monto: number; pagado: number }>();
  for (const { h } of filas) {
    const prev = porEstado.get(h.estado) || { count: 0, monto: 0, pagado: 0 };
    prev.count++;
    prev.monto += h.monto;
    prev.pagado += h.montoPagado || 0;
    porEstado.set(h.estado, prev);
  }

  const totalMonto = filas.reduce((a, f) => a + f.h.monto, 0);
  const totalPagado = filas.reduce((a, f) => a + (f.h.montoPagado || 0), 0);
  const totalPendiente = filas.reduce((a, f) => a + f.pend, 0);
  const totalInteres = filas.reduce(
    (a, f) => a + (f.interes?.interesCalculado || 0),
    0,
  );

  let md = `# Estado de Cuenta\n\n`;
  md += `**Cliente:** ${cliente}  \n`;
  md += `**Fecha:** ${fecha}  \n`;
  md += `**Periodo:** Todos los registros vigentes  \n\n`;

  md += `## Detalle de Honorarios\n\n`;
  md += `| # | Concepto | Estado | Monto | Pagado | Pendiente | Mora (dias) | Interes |\n`;
  md += `|---|----------|--------|-------|--------|-----------|-------------|--------|\n`;

  filas.forEach((f, i) => {
    md += `| ${i + 1} | ${f.h.concepto} | ${f.h.estado} | ${fmt(f.h.monto)} | ${fmt(f.h.montoPagado || 0)} | ${fmt(f.pend)} | ${f.mora} | ${fmt(f.interes?.interesCalculado || 0)} |\n`;
  });

  md += `\n## Subtotales por Estado\n\n`;
  md += `| Estado | Cantidad | Monto | Pagado | Pendiente |\n`;
  md += `|--------|----------|-------|--------|-----------|\n`;
  for (const [estado, data] of porEstado) {
    md += `| ${estado} | ${data.count} | ${fmt(data.monto)} | ${fmt(data.pagado)} | ${fmt(data.monto - data.pagado)} |\n`;
  }

  md += `\n## Totales\n\n`;
  md += `| Concepto | Monto |\n`;
  md += `|----------|-------|\n`;
  md += `| Total Facturado | ${fmt(totalMonto)} |\n`;
  md += `| Total Pagado | ${fmt(totalPagado)} |\n`;
  md += `| Total Pendiente | ${fmt(totalPendiente)} |\n`;
  md += `| Intereses por Mora | ${fmt(totalInteres)} |\n`;
  md += `| **Total con Intereses** | **${fmt(totalPendiente + totalInteres)}** |\n`;

  md += `\n---\n\n`;
  md += `### Instrucciones de Pago\n\n`;
  md += `- **Transferencia bancaria:** Solicitar datos al estudio.  \n`;
  md += `- **Referencia:** Estado de cuenta ${cliente} - ${fecha}  \n`;
  md += `- **Consultas:** Contactar al area de cobranza del estudio.  \n`;
  md += `\n*Base normativa: Art. 63 CT, Art. 1559 CC. Intereses calculados a tasa legal 1.5% mensual.*\n`;

  return md;
}

// ─── b) Reporte de Cobranza ──────────────────────────────────────

export interface AgingBucket {
  label: string;
  min: number;
  max: number;
  count: number;
  monto: number;
}

export interface ReporteCobranzaData {
  markdown: string;
  totalFacturado: number;
  totalCobrado: number;
  totalPendiente: number;
  totalMoroso: number;
  tasaCobro: number;
  aging: AgingBucket[];
  topMorosos: { cliente: string; monto: number }[];
}

export function generarReporteCobranza(
  todos: Honorario[],
): ReporteCobranzaData {
  const totalFacturado = todos.reduce((a, h) => a + h.monto, 0);
  const totalCobrado = todos.reduce((a, h) => a + (h.montoPagado || 0), 0);
  const totalPendiente = totalFacturado - totalCobrado;

  const morosos = todos.filter(
    (h) =>
      h.estado === "moroso" ||
      h.estado === "cobranza" ||
      h.estado === "vencido",
  );
  const totalMoroso = morosos.reduce((a, h) => a + pendiente(h), 0);
  const tasaCobro =
    totalFacturado > 0
      ? Math.round((totalCobrado / totalFacturado) * 10000) / 100
      : 0;

  // Aging buckets
  const pendientes = todos.filter(
    (h) => h.estado !== "pagado" && pendiente(h) > 0,
  );
  const buckets: AgingBucket[] = [
    { label: "0-30 dias", min: 0, max: 30, count: 0, monto: 0 },
    { label: "31-60 dias", min: 31, max: 60, count: 0, monto: 0 },
    { label: "61-90 dias", min: 61, max: 90, count: 0, monto: 0 },
    { label: "90+ dias", min: 91, max: Infinity, count: 0, monto: 0 },
  ];

  for (const h of pendientes) {
    const d = diasMora(h);
    for (const b of buckets) {
      if (d >= b.min && d <= b.max) {
        b.count++;
        b.monto += pendiente(h);
        break;
      }
    }
  }

  // Top 5 morosos by amount
  const clienteMap = new Map<string, number>();
  for (const h of pendientes) {
    const prev = clienteMap.get(h.cliente) || 0;
    clienteMap.set(h.cliente, prev + pendiente(h));
  }
  const topMorosos = Array.from(clienteMap.entries())
    .map(([cliente, monto]) => ({ cliente, monto }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5);

  // Build markdown
  let md = `# Reporte de Cobranza\n\n`;
  md += `**Fecha:** ${hoy()}  \n\n`;

  md += `## Resumen General\n\n`;
  md += `| Indicador | Valor |\n`;
  md += `|-----------|-------|\n`;
  md += `| Total Facturado | ${fmt(totalFacturado)} |\n`;
  md += `| Total Cobrado | ${fmt(totalCobrado)} |\n`;
  md += `| Total Pendiente | ${fmt(totalPendiente)} |\n`;
  md += `| Total Moroso | ${fmt(totalMoroso)} |\n`;
  md += `| Tasa de Cobro | ${tasaCobro}% |\n`;

  md += `\n## Antiguedad de Deuda (Aging)\n\n`;
  md += `| Periodo | Cantidad | Monto |\n`;
  md += `|---------|----------|-------|\n`;
  for (const b of buckets) {
    md += `| ${b.label} | ${b.count} | ${fmt(b.monto)} |\n`;
  }

  md += `\n## Top 5 Morosos por Monto\n\n`;
  md += `| # | Cliente | Monto Pendiente |\n`;
  md += `|---|---------|----------------|\n`;
  topMorosos.forEach((m, i) => {
    md += `| ${i + 1} | ${m.cliente} | ${fmt(m.monto)} |\n`;
  });

  md += `\n---\n*Reporte generado automaticamente por LexTrack.*\n`;

  return {
    markdown: md,
    totalFacturado,
    totalCobrado,
    totalPendiente,
    totalMoroso,
    tasaCobro,
    aging: buckets,
    topMorosos,
  };
}

// ─── c) Carta de Cobranza ────────────────────────────────────────

export function generarCartaCobranza(
  honorario: Honorario,
  numero: number,
): string {
  const fecha = hoy();
  const pend = pendiente(honorario);
  const mora = diasMora(honorario);

  let interes: InteresCalculo | null = null;
  if (honorario.fechaVencimiento && mora > 0) {
    interes = calcularInteresMora({
      monto: honorario.monto,
      montoPagado: honorario.montoPagado || 0,
      fechaVencimiento: honorario.fechaVencimiento,
    });
  }

  const totalDeuda = interes ? interes.totalConInteres : pend;

  // Plazo segun numero de carta
  const plazosDias: Record<number, number> = { 1: 15, 2: 10, 3: 5 };
  const plazo = plazosDias[numero] || 15;

  const fechaPlazo = new Date();
  fechaPlazo.setDate(fechaPlazo.getDate() + plazo);
  const fechaPlazoStr = fechaPlazo.toISOString().split("T")[0];

  // Tone escalation
  const encabezados: Record<number, string> = {
    1: "PRIMERA CARTA DE COBRANZA - Recordatorio de Pago",
    2: "SEGUNDA CARTA DE COBRANZA - Aviso Urgente de Pago",
    3: "TERCERA Y ULTIMA CARTA DE COBRANZA - Aviso Previo a Cobranza Judicial",
  };

  const saludos: Record<number, string> = {
    1: `Mediante la presente, nos permitimos recordarle que mantiene una obligacion de pago pendiente con nuestro estudio, segun el detalle que se indica a continuacion.`,
    2: `Lamentamos informarle que, pese a nuestra comunicacion anterior, aun no hemos recibido el pago correspondiente a la obligacion que se detalla. Le solicitamos regularizar esta situacion a la brevedad.`,
    3: `Pese a nuestros reiterados requerimientos de pago, a la fecha no hemos recibido abono alguno respecto de la deuda que se indica. Le informamos que, de no mediar pago dentro del plazo senalado, procederemos a iniciar las acciones judiciales correspondientes.`,
  };

  const cierres: Record<number, string> = {
    1: `Agradecemos su pronta atencion a este asunto. Quedamos a su disposicion para cualquier consulta o para coordinar modalidades de pago.`,
    2: `Le instamos a regularizar esta situacion dentro del plazo indicado para evitar acciones adicionales de cobranza y el devengamiento de mayores intereses.`,
    3: `**AVISO LEGAL:** De no recibir el pago total dentro del plazo indicado, procederemos a ejercer las acciones judiciales de cobranza que correspondan, incluyendo la demanda ejecutiva por cobro de honorarios, con costas a su cargo, conforme a lo dispuesto en los articulos 434 y siguientes del Codigo de Procedimiento Civil y el articulo 63 del Codigo del Trabajo.\n\nLos gastos judiciales, costas procesales e intereses adicionales seran de su exclusiva responsabilidad.`,
  };

  let md = `# ${encabezados[numero] || encabezados[1]}\n\n`;
  md += `**Fecha:** ${fecha}  \n`;
  md += `**Carta N.:** ${numero}  \n\n`;

  md += `---\n\n`;
  md += `**Senor(a):** ${honorario.cliente}  \n`;
  md += `**Presente**  \n\n`;

  md += `${saludos[numero] || saludos[1]}\n\n`;

  md += `## Detalle de la Deuda\n\n`;
  md += `| Concepto | Detalle |\n`;
  md += `|----------|--------|\n`;
  md += `| Concepto | ${honorario.concepto} |\n`;
  md += `| Monto Original | ${fmt(honorario.monto)} |\n`;
  md += `| Monto Pagado | ${fmt(honorario.montoPagado || 0)} |\n`;
  md += `| Saldo Pendiente | ${fmt(pend)} |\n`;
  if (honorario.fechaVencimiento) {
    md += `| Fecha de Vencimiento | ${honorario.fechaVencimiento} |\n`;
    md += `| Dias en Mora | ${mora} |\n`;
  }
  if (interes) {
    md += `| Intereses por Mora (${interes.tasaMensual}% mensual) | ${fmt(interes.interesCalculado)} |\n`;
  }
  md += `| **Total Adeudado** | **${fmt(totalDeuda)}** |\n`;

  md += `\n**Plazo de pago:** ${fechaPlazoStr} (${plazo} dias habiles)  \n\n`;

  md += `${cierres[numero] || cierres[1]}\n\n`;

  md += `---\n\n`;
  md += `Atentamente,  \n`;
  md += `**Estudio Juridico**  \n`;
  md += `Area de Cobranza  \n\n`;
  md += `*Base normativa: ${interes?.baseNormativa || "Art. 63 CT, Art. 1559 CC"}*\n`;

  return md;
}
