/**
 * ReputacionPro: envío del email de solicitud de reseña.
 * Asunto y cuerpo según especificación. Enlace a frontend/feedback/:sessionId.
 */
const { sendWithNegocio } = require('../email-negocio');

const ASUNTO = 'Tu opinión puede ayudar a otras personas';

/**
 * Genera el HTML del email con el botón "Valorar experiencia" que enlaza a /feedback/:sessionId.
 * @param {string} nombrePaciente
 * @param {string} nombreProfesional
 * @param {string} feedbackUrl - URL completa, p. ej. https://tudominio.com/feedback/123
 */
function buildEmailHtml(nombrePaciente, nombreProfesional, feedbackUrl) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .content { padding: 20px 0; }
    .btn { display: inline-block; background: #2563eb; color: #fff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; margin: 16px 0; }
    .btn:hover { background: #1d4ed8; }
    .footer { color: #666; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <p>Hola ${escapeHtml(nombrePaciente)},</p>
      <p>Gracias por tu sesión con ${escapeHtml(nombreProfesional)}.</p>
      <p>Tu experiencia puede ayudar a otras personas que estén buscando apoyo psicológico.</p>
      <p>Si tienes un momento, nos encantaría conocer tu valoración.</p>
      <p><a href="${escapeHtml(feedbackUrl)}" class="btn">Valorar experiencia</a></p>
      <p>Gracias por tu confianza.</p>
    </div>
    <div class="footer">Este es un email automático. No respondas a este mensaje.</div>
  </div>
</body>
</html>
  `.trim();
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
  const baseUrl = process.env.FRONTEND_URL || process.env.BASE_URL || process.env.APP_URL || 'http://localhost:3000';
  const feedbackUrl = `${baseUrl.replace(/\/$/, '')}/feedback/${sessionId}`;
  const html = buildEmailHtml(
    paciente.nombre || 'Paciente',
    negocio.nombre || 'el profesional',
    feedbackUrl
  );
  await sendWithNegocio(negocio, {
    to: paciente.email,
    subject: ASUNTO,
    html
  });
}

module.exports = { sendReviewRequestEmail, buildEmailHtml, ASUNTO };
