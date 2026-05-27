// ─── Email templates ───────────────────────────────────────────────
// All copy in Spanish. Returns { subject, html, text } for each template.
// HTML uses only inline styles — no external CSS framework.

const APP_URL = process.env.APP_URL ?? "https://app.lextrack.cl";

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// ── Shared layout helpers ──────────────────────────────────────────

function htmlWrap(body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:24px 32px;">
            <span style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:1px;">LexTrack</span>
            <span style="font-size:12px;color:#a0b4c8;margin-left:8px;">Gestión Legal Inteligente</span>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:32px;">${body}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f4f6f8;padding:16px 32px;text-align:center;font-size:12px;color:#6b7280;">
            LexTrack &mdash; Sistema de gestión legal para abogados chilenos<br>
            <a href="${APP_URL}" style="color:#1e3a5f;text-decoration:none;">${APP_URL}</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#1e3a5f;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;margin-top:16px;">${label}</a>`;
}

// ── Template 1: Nuevos movimientos PJUD ───────────────────────────

export interface AlertaNuevosMovimientosPJUDParams {
  abogado: string;
  causa: { rit: string; id: number | string };
  movimientos: Array<{ fecha: string; tipo: string; descripcion: string }>;
}

export function alertaNuevosMovimientosPJUD(
  p: AlertaNuevosMovimientosPJUDParams,
): EmailTemplate {
  const subject = `[LexTrack] Nuevos movimientos en causa ${p.causa.rit}`;
  const causaUrl = `${APP_URL}/causas/${p.causa.id}`;

  const movRows = p.movimientos
    .map(
      (m) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;white-space:nowrap;">${m.fecha}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;">${m.tipo}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${m.descripcion}</td>
        </tr>`,
    )
    .join("");

  const html = htmlWrap(`
    <h2 style="margin-top:0;font-size:18px;color:#1e3a5f;">Nuevos movimientos en causa ${p.causa.rit}</h2>
    <p style="font-size:14px;color:#374151;">Hola <strong>${p.abogado}</strong>,</p>
    <p style="font-size:14px;color:#374151;">Se registraron <strong>${p.movimientos.length}</strong> nuevo(s) movimiento(s) en la causa <strong>${p.causa.rit}</strong>:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin:16px 0;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Fecha</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Tipo</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Descripción</th>
        </tr>
      </thead>
      <tbody>${movRows}</tbody>
    </table>
    ${btn(causaUrl, "Ver causa en LexTrack")}
  `);

  const movText = p.movimientos
    .map((m) => `  - [${m.fecha}] ${m.tipo}: ${m.descripcion}`)
    .join("\n");

  const text = `${subject}\n\nHola ${p.abogado},\n\nSe registraron ${p.movimientos.length} nuevo(s) movimiento(s) en la causa ${p.causa.rit}:\n\n${movText}\n\nVer causa: ${causaUrl}\n\n— LexTrack`;

  return { subject, html, text };
}

// ── Template 2: Nueva norma laboral Diario Oficial ─────────────────

export interface AlertaNormaLaboralParams {
  titulo: string;
  fechaPublicacion: string;
  url: string;
  usuarioNombre: string;
}

export function alertaNormaLaboral(p: AlertaNormaLaboralParams): EmailTemplate {
  const subject = `[LexTrack] Nueva norma laboral en Diario Oficial: ${p.titulo}`;

  const html = htmlWrap(`
    <h2 style="margin-top:0;font-size:18px;color:#1e3a5f;">Nueva norma laboral publicada</h2>
    <p style="font-size:14px;color:#374151;">Hola <strong>${p.usuarioNombre}</strong>,</p>
    <p style="font-size:14px;color:#374151;">Se publicó una nueva norma laboral en el <strong>Diario Oficial</strong> que puede ser de tu interés:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#6b7280;width:140px;">Título</td>
        <td style="padding:6px 0;font-size:13px;font-weight:600;">${p.titulo}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#6b7280;">Fecha publicación</td>
        <td style="padding:6px 0;font-size:13px;">${p.fechaPublicacion}</td>
      </tr>
    </table>
    ${btn(p.url, "Ver norma en Diario Oficial")}
    <p style="font-size:12px;color:#9ca3af;margin-top:24px;">
      Puedes gestionar tus alertas desde tu panel en LexTrack.
    </p>
  `);

  const text = `${subject}\n\nHola ${p.usuarioNombre},\n\nSe publicó una nueva norma laboral en el Diario Oficial:\n\nTítulo: ${p.titulo}\nFecha: ${p.fechaPublicacion}\nURL: ${p.url}\n\n— LexTrack`;

  return { subject, html, text };
}

// ── Template 3: Bienvenida ─────────────────────────────────────────

export interface BienvenidaParams {
  nombre: string;
  email: string;
}

export function bienvenida(p: BienvenidaParams): EmailTemplate {
  const subject = `Bienvenido/a a LexTrack, ${p.nombre}`;
  const dashboardUrl = `${APP_URL}/dashboard`;

  const features = [
    {
      icon: "⚖️",
      title: "Monitoreo de causas PJUD",
      desc: "Sincroniza automáticamente tus causas del Poder Judicial y recibe alertas ante nuevos movimientos.",
    },
    {
      icon: "📋",
      title: "Gestión de honorarios y tareas",
      desc: "Registra tus honorarios, programa tareas y lleva el control de vencimientos importantes.",
    },
    {
      icon: "📰",
      title: "Alertas Diario Oficial",
      desc: "Mantente al día con las nuevas normas laborales publicadas en el Diario Oficial.",
    },
  ];

  const featureHtml = features
    .map(
      (f) =>
        `<tr>
          <td style="padding:12px 0;vertical-align:top;width:36px;font-size:22px;">${f.icon}</td>
          <td style="padding:12px 0 12px 12px;">
            <strong style="font-size:14px;color:#1e3a5f;">${f.title}</strong><br>
            <span style="font-size:13px;color:#6b7280;">${f.desc}</span>
          </td>
        </tr>`,
    )
    .join("");

  const html = htmlWrap(`
    <h2 style="margin-top:0;font-size:20px;color:#1e3a5f;">¡Bienvenido/a a LexTrack, ${p.nombre}!</h2>
    <p style="font-size:14px;color:#374151;">
      Tu cuenta ha sido creada exitosamente con el correo <strong>${p.email}</strong>.
      LexTrack es tu plataforma de gestión legal inteligente, diseñada para abogados chilenos.
    </p>
    <h3 style="font-size:15px;color:#1e3a5f;margin-top:24px;">Qué puedes hacer con LexTrack:</h3>
    <table width="100%" cellpadding="0" cellspacing="0">${featureHtml}</table>
    ${btn(dashboardUrl, "Ir a mi panel")}
    <p style="font-size:13px;color:#9ca3af;margin-top:24px;">
      Si tienes dudas, responde este correo y te ayudaremos.
    </p>
  `);

  const text = `¡Bienvenido/a a LexTrack, ${p.nombre}!\n\nTu cuenta fue creada con ${p.email}.\n\nLexTrack te ofrece:\n- Monitoreo automático de causas PJUD\n- Gestión de honorarios y tareas\n- Alertas del Diario Oficial\n\nAccede a tu panel: ${dashboardUrl}\n\n— LexTrack`;

  return { subject, html, text };
}

// ── Template 4: Resumen semanal ────────────────────────────────────

export interface ResumenSemanalParams {
  nombre: string;
  causasActivas: number;
  tareasVencidas: number;
  alertasNoLeidas: number;
}

export function resumenSemanal(p: ResumenSemanalParams): EmailTemplate {
  const subject = `[LexTrack] Tu resumen semanal`;
  const dashboardUrl = `${APP_URL}/dashboard`;
  const tareasUrl = `${APP_URL}/tareas`;
  const alertasUrl = `${APP_URL}/alertas`;

  const stats = [
    {
      label: "Causas activas",
      value: p.causasActivas,
      color: "#1e3a5f",
      url: `${APP_URL}/causas`,
    },
    {
      label: "Tareas vencidas",
      value: p.tareasVencidas,
      color: p.tareasVencidas > 0 ? "#dc2626" : "#16a34a",
      url: tareasUrl,
    },
    {
      label: "Alertas no leídas",
      value: p.alertasNoLeidas,
      color: p.alertasNoLeidas > 0 ? "#d97706" : "#16a34a",
      url: alertasUrl,
    },
  ];

  const statsHtml = stats
    .map(
      (s) =>
        `<td style="text-align:center;padding:16px;">
          <a href="${s.url}" style="text-decoration:none;">
            <div style="font-size:32px;font-weight:bold;color:${s.color};">${s.value}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">${s.label}</div>
          </a>
        </td>`,
    )
    .join("");

  const vencidasMsg =
    p.tareasVencidas > 0
      ? `<p style="font-size:14px;color:#374151;background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;">
          Tienes <strong>${p.tareasVencidas} tarea(s) vencida(s)</strong>. Te recomendamos revisarlas lo antes posible.
        </p>`
      : `<p style="font-size:14px;color:#374151;background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;">
          ¡Sin tareas vencidas esta semana! Buen trabajo.
        </p>`;

  const html = htmlWrap(`
    <h2 style="margin-top:0;font-size:18px;color:#1e3a5f;">Resumen semanal — ${p.nombre}</h2>
    <p style="font-size:14px;color:#374151;">Aquí tienes un resumen de tu actividad en LexTrack esta semana:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f9fafb;border-radius:8px;"
      ><tr>${statsHtml}</tr></table>
    ${vencidasMsg}
    ${btn(dashboardUrl, "Ver mi panel")}
  `);

  const text = `[LexTrack] Tu resumen semanal\n\nHola ${p.nombre},\n\nResumen de esta semana:\n- Causas activas: ${p.causasActivas}\n- Tareas vencidas: ${p.tareasVencidas}\n- Alertas no leídas: ${p.alertasNoLeidas}\n\nAccede a tu panel: ${dashboardUrl}\n\n— LexTrack`;

  return { subject, html, text };
}
