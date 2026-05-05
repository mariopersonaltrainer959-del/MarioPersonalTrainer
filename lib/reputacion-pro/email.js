/**
 * ReputacionPro: envío del email de solicitud de reseña.
 * Asunto y cuerpo según especificación. Enlace a frontend/feedback/:sessionId.
 */
const { sendWithNegocio } = require('../email-negocio');
const { getPublicSiteBaseUrl } = require('../../utils/site-hosts');
const plantillasService = require('../plantillas');

const DEFAULT_TEMPLATE = {
  asunto: 'Tu opinión puede ayudar a otras personas',
  cuerpo: `Hola {{nombre_paciente}},

Gracias por tu sesión con {{nombre_negocio}}.

Tu experiencia puede ayudar a otras personas que estén buscando un profesional como tú.
Si tienes un momento, nos encantaría conocer tu valoración.

Puedes valorar tu experiencia aquí: {{feedback_url}}

Gracias por tu confianza.`
};

/**
 * Genera el HTML del email con el botón "Valorar experiencia" que enlaza a /feedback/:sessionId.
 * @param {string} nombrePaciente
 * @param {string} nombreProfesional
 * @param {string} feedbackUrl - URL completa, p. ej. https://tudominio.com/feedback/123
 */
function buildEmailHtml(asunto, cuerpoTexto, feedbackUrl) {
  const safeBody = textToHtml(cuerpoTexto || '');
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin:0; background:#f3f4f6; font-family: Arial, sans-serif; color:#111827; }
    .container { max-width: 640px; margin: 0 auto; padding: 28px 14px; }
    .card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; }
    .header { background:#1d4ed8; color:#ffffff; padding: 18px 24px; font-size: 20px; font-weight: 700; }
    .content { padding: 24px; line-height: 1.65; color:#374151; font-size:15px; }
    .btnWrap { margin: 22px 0; }
    .btn { display:inline-block; background:#2563eb; color:#ffffff !important; text-decoration:none; border-radius:10px; padding:12px 20px; font-weight:600; }
    .footer { border-top:1px solid #f3f4f6; color:#6b7280; font-size:12px; padding:16px 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">${escapeHtml(asunto || '')}</div>
      <div class="content">
        ${safeBody}
        <div class="btnWrap"><a href="${escapeHtml(feedbackUrl)}" class="btn">Valorar experiencia</a></div>
        <p style="font-size:12px;color:#6b7280;margin-top:14px;">Si el botón no funciona, copia este enlace en tu navegador:<br>${escapeHtml(feedbackUrl)}</p>
      </div>
      <div class="footer">Este es un email automático. No respondas a este mensaje.</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function textToHtml(text) {
  return escapeHtml(String(text || ''))
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Enviar email de solicitud de reseña al paciente.
 * @param {object} negocio - { nombre, email, ... } para remitente y SMTP
 * @param {object} paciente - { nombre, email }
 * @param {number} sessionId - id de la cita (para el enlace feedback)
 * @returns {Promise<void>}
 */
async function sendReviewRequestEmail(negocio, paciente, sessionId) {
  const baseUrl = getPublicSiteBaseUrl();
  const feedbackUrl = `${baseUrl.replace(/\/$/, '')}/feedback/${sessionId}`;
  const plantilla = await getTemplate(negocio.id);
  const render = plantillasService.render(plantilla, {
    nombre_paciente: paciente.nombre || 'Cliente',
    nombre_negocio: negocio.nombre || 'el profesional',
    feedback_url: feedbackUrl
  });
  const html = buildEmailHtml(render.asunto, render.cuerpo, feedbackUrl);
  await sendWithNegocio(negocio, {
    to: paciente.email,
    subject: render.asunto || DEFAULT_TEMPLATE.asunto,
    html
  });
}

async function sendReviewRequestTestEmail(negocio, toEmail) {
  const baseUrl = getPublicSiteBaseUrl();
  const feedbackUrl = `${baseUrl.replace(/\/$/, '')}/feedback/demo`;
  const plantilla = await getTemplate(negocio.id);
  const render = plantillasService.render(plantilla, {
    nombre_paciente: 'Cliente de prueba',
    nombre_negocio: negocio.nombre || 'tu negocio',
    feedback_url: feedbackUrl
  });
  const html = buildEmailHtml(render.asunto, render.cuerpo, feedbackUrl);
  await sendWithNegocio(negocio, {
    to: toEmail,
    subject: `[PRUEBA] ${render.asunto || DEFAULT_TEMPLATE.asunto}`,
    html
  });
}

async function getTemplate(negocioId) {
  const p = await plantillasService.getByName(negocioId, 'reputacion_review').catch(() => null);
  if (!p) return DEFAULT_TEMPLATE;
  return {
    asunto: p.asunto || DEFAULT_TEMPLATE.asunto,
    cuerpo: p.cuerpo || DEFAULT_TEMPLATE.cuerpo
  };
}

module.exports = {
  sendReviewRequestEmail,
  sendReviewRequestTestEmail,
  getTemplate,
  buildEmailHtml
};
