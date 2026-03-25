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

    const html = `<div style="font-family: sans-serif; white-space: pre-wrap;">${String(cuerpo).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>`;

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
