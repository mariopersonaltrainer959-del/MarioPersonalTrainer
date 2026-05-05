/**
 * Job diario: revisa citas del día siguiente y envía recordatorio por email usando la plantilla del negocio.
 */
const { allQuery } = require('../utils/db');
const negocioService = require('./negocio');
const plantillasService = require('./plantillas');
const { sendWithNegocio } = require('./email-negocio');

const DEFAULT_NEGOCIO_ID = 1;

async function runReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const fecha = tomorrow.toISOString().slice(0, 10);

  const citas = await allQuery(
    `SELECT c.*, p.nombre as paciente_nombre, p.email as paciente_email
     FROM citas c
     JOIN pacientes p ON p.id = c.paciente_id
     WHERE c.fecha = ? AND c.estado IN ('confirmada', 'pendiente')
     ORDER BY c.negocio_id, c.hora_inicio`,
    [fecha]
  ).catch(() => []);

  if (citas.length === 0) return { sent: 0 };

  let sent = 0;
  let lastNegocioId = null;
  let negocio = null;
  let plantilla = null;

  for (const cita of citas) {
    if (cita.negocio_id !== lastNegocioId) {
      lastNegocioId = cita.negocio_id;
      negocio = await negocioService.getById(cita.negocio_id);
      plantilla = await plantillasService.getByName(cita.negocio_id, 'recordatorio');
    }

    if (!negocio || !plantilla || !cita.paciente_email) continue;

    const { asunto, cuerpo } = plantillasService.render(plantilla, {
      nombre_paciente: cita.paciente_nombre,
      fecha: cita.fecha,
      hora: cita.hora_inicio,
      nombre_negocio: negocio.nombre
    });

    const html = `
      <div style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,sans-serif;">
        <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <div style="background:#1d4ed8;color:#fff;padding:18px 24px;font-size:20px;font-weight:700;">${String(asunto || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          <div style="padding:24px;line-height:1.65;color:#374151;font-size:15px;">${String(cuerpo || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n\n+/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>')}</div>
          <div style="border-top:1px solid #f3f4f6;color:#6b7280;font-size:12px;padding:16px 24px;">Recordatorio automático de tu próxima sesión.</div>
        </div>
      </div>`;

    try {
      await sendWithNegocio(negocio, {
        to: cita.paciente_email,
        subject: asunto,
        html
      });
      sent++;
      console.log(`✅ Recordatorio enviado a ${cita.paciente_email} (cita ${cita.fecha} ${cita.hora_inicio})`);
    } catch (err) {
      console.error(`❌ Error enviando recordatorio a ${cita.paciente_email}:`, err.message);
    }
  }

  return { sent };
}

module.exports = { runReminders };
