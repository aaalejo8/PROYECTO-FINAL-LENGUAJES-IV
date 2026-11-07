'use strict';
/**
 * Envío de correos con Nodemailer por SMTP (Gmail con contraseña de aplicación, Brevo, Resend,
 * Mailtrap, el SMTP de la facultad... cualquiera sirve).
 *
 * Con SMTP configurado (SMTP_HOST en el .env) los correos salen de verdad.
 * Sin SMTP se "simulan": no se envía nada, se escribe una línea en la consola y el panel marca la
 * respuesta como simulada. Así se puede desarrollar en localhost sin cuenta de correo.
 */
const nodemailer = require('nodemailer');
const config = require('./config');

let transporte;
function obtenerTransporte() {
  if (!transporte) {
    const c = config.correo;
    transporte = c.simulado
      ? nodemailer.createTransport({ jsonTransport: true })
      : nodemailer.createTransport({
          host: c.host,
          port: c.puerto,
          secure: c.seguro,
          auth: c.usuario ? { user: c.usuario, pass: c.clave } : undefined,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
        });
  }
  return transporte;
}

/**
 * Envía un correo (texto plano + versión HTML opcional). Devuelve { simulado, id }.
 * Lanza un error si el servidor SMTP lo rechaza. `asunto` y `para` ya vienen validados.
 */
async function enviar({ para, asunto, texto, html, responderA }) {
  const info = await obtenerTransporte().sendMail({
    from: config.correo.remitente,
    to: para,
    subject: asunto,
    text: texto,
    html: html || undefined,
    replyTo: responderA || undefined,
  });
  if (config.correo.simulado) {
    console.log(`[Correo simulado] Para: ${para} · Asunto: ${asunto}`);
    return { simulado: true, id: null };
  }
  return { simulado: false, id: info.messageId || null };
}

/** Verifica la conexión con el servidor SMTP (para `npm run correo:probar`). */
async function verificar() {
  if (config.correo.simulado) return { simulado: true };
  await obtenerTransporte().verify();
  return { simulado: false };
}

// ───────────────────────────── Plantillas ─────────────────────────────

const escapar = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Envoltorio HTML simple con los colores del manual de marca (los clientes de correo no leen CSS externo). */
function marco(titulo, cuerpoHtml) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#0B0F1A;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#E8ECF8">
<table role="presentation" width="100%" style="max-width:600px;margin:0 auto;background:#131A2B;border:1px solid #2A3556;border-radius:12px">
<tr><td style="padding:24px 28px;border-bottom:3px solid #C6F432"><strong style="font-size:18px;color:#C6F432">${escapar(config.sitio.nombre)}</strong>
<div style="font-size:13px;color:#9AA6C4;margin-top:4px">${escapar(titulo)}</div></td></tr>
<tr><td style="padding:24px 28px;font-size:15px;line-height:1.6;color:#E8ECF8">${cuerpoHtml}</td></tr>
<tr><td style="padding:16px 28px;font-size:12px;color:#5B6A94;border-top:1px solid #2A3556">Este correo se envió desde el portfolio de ${escapar(config.sitio.nombre)}.</td></tr>
</table></body></html>`;
}
const parrafos = (t) =>
  escapar(t)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');

/** Aviso al dueño del portfolio: llegó una consulta nueva. */
function avisoDeConsulta(c, etiquetaTipo) {
  const filas = [
    ['Código', c.codigo],
    ['Tipo', etiquetaTipo],
    ['Nombre', c.nombre],
    ['Email', c.email],
    ['Teléfono', c.telefono || '—'],
    ['Asunto', c.asunto],
  ];
  return {
    asunto: `[${config.sitio.nombre}] Nueva consulta ${c.codigo}: ${c.asunto}`,
    texto: [
      `Llegó una consulta nueva por el formulario de contacto.`,
      ``,
      ...filas.map(([k, v]) => `${(k + ':').padEnd(10)}${v}`),
      ``,
      c.mensaje,
      ``,
      `Respondela desde el panel: ${config.urlPublica}/panel?tab=consultas`,
    ].join('\n'),
    html: marco(
      'Nueva consulta desde el formulario de contacto',
      `<table role="presentation" style="font-size:14px;margin-bottom:16px">${filas
        .map(([k, v]) => `<tr><td style="color:#9AA6C4;padding:2px 12px 2px 0">${k}</td><td>${escapar(v)}</td></tr>`)
        .join('')}</table>${parrafos(c.mensaje)}
       <p><a href="${escapar(config.urlPublica)}/panel?tab=consultas" style="display:inline-block;background:#C6F432;color:#0B0F1A;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Abrir la bandeja</a></p>`
    ),
  };
}

/** Confirmación para quien escribió. */
function confirmacionAlVisitante(c, etiquetaTipo) {
  const nombre = c.nombre.split(' ')[0];
  return {
    asunto: `Recibí tu consulta (${c.codigo})`,
    texto: [
      `Hola ${nombre},`,
      ``,
      `Recibí tu ${String(etiquetaTipo || 'consulta').toLowerCase()} "${c.asunto}" y te respondo por este mismo medio lo antes posible.`,
      `Tu código de seguimiento es ${c.codigo}.`,
      ``,
      `— ${config.sitio.nombre}`,
    ].join('\n'),
    html: marco(
      'Confirmación de tu consulta',
      `<p>Hola ${escapar(nombre)},</p><p>Recibí tu ${escapar(String(etiquetaTipo || 'consulta').toLowerCase())} <strong>"${escapar(c.asunto)}"</strong> y te respondo por este mismo medio lo antes posible.</p>
       <p>Tu código de seguimiento es <strong style="color:#C6F432">${escapar(c.codigo)}</strong>.</p><p>— ${escapar(config.sitio.nombre)}</p>`
    ),
  };
}

/** Respuesta del operador a una consulta. */
function respuestaAConsulta({ consulta, cuerpo, autor }) {
  return {
    texto: `${cuerpo}\n\n—\n${autor}\n${config.sitio.nombre}\n\nConsulta ${consulta.codigo}: "${consulta.asunto}"`,
    html: marco(
      `Respuesta a tu consulta ${consulta.codigo}`,
      `${parrafos(cuerpo)}<p style="margin-top:20px">— ${escapar(autor)}<br><span style="color:#9AA6C4">${escapar(config.sitio.nombre)}</span></p>
       <p style="font-size:12px;color:#5B6A94">En respuesta a: "${escapar(consulta.asunto)}"</p>`
    ),
  };
}

module.exports = { enviar, verificar, avisoDeConsulta, confirmacionAlVisitante, respuestaAConsulta, escapar };
