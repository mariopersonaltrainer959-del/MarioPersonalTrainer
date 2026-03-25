/**
 * Envío de emails usando la configuración SMTP del negocio (o fallback a config/Resend).
 */
const nodemailer = require('nodemailer');
const config = require('../config');

async function getTransporterFromNegocio(negocio) {
  const useResend = !!process.env.RESEND_API_KEY;
  if (useResend) return null;

  const host = negocio?.smtp_host || config.smtpConfig?.host;
  const port = negocio?.smtp_port != null ? negocio.smtp_port : config.smtpConfig?.port;
  const user = negocio?.smtp_user || config.smtpConfig?.auth?.user;
  const pass = negocio?.smtp_password || config.smtpConfig?.auth?.pass;

  if (!host || !user || !pass) {
    throw new Error('SMTP no configurado: indica host, usuario y contraseña en Configuración del negocio.');
  }

  return nodemailer.createTransport({
    host,
    port: port || 587,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000
  });
}

async function sendWithNegocio(negocio, { to, subject, html, text }) {
  const useResend = !!process.env.RESEND_API_KEY;
  const from = negocio?.nombre_remitente
    ? `"${negocio.nombre_remitente}" <${negocio.email_remitente || negocio.email}>`
    : (negocio?.email_remitente || negocio?.email || config.emailConfig?.from);

  if (useResend) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: html || text
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || `Resend ${res.status}`);
    return;
  }

  const transporter = await getTransporterFromNegocio(negocio);
  await transporter.sendMail({
    from,
    to,
    subject,
    html: html || text
  });
}

/** Enviar email de prueba usando SMTP del negocio */
async function sendTestEmailWithNegocio(negocio, toEmail) {
  const html = `
    <p>Este es un email de prueba del sistema de reservas.</p>
    <p>Si lo recibes, la configuración SMTP del negocio <strong>${negocio.nombre || ''}</strong> es correcta.</p>
  `;
  await sendWithNegocio(negocio, {
    to: toEmail,
    subject: 'Prueba de email - Sistema de reservas',
    html
  });
}

module.exports = {
  getTransporterFromNegocio,
  sendWithNegocio,
  sendTestEmailWithNegocio
};
