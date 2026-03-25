/**
 * ReputacionPro: estadísticas para el dashboard del profesional.
 * - Solicitudes enviadas este mes
 * - Valoraciones internas recibidas
 * - Clics al botón Google
 * - Media de valoración interna
 */
const { getQuery, allQuery } = require('../../utils/db');

const isPg = !!process.env.DATABASE_URL;

/**
 * Obtener estadísticas del mes actual para un negocio.
 * @param {number} negocioId
 * @returns {Promise<{ solicitudesEnviadasMes: number, valoracionesInternas: number, clicsGoogle: number, mediaValoracion: number|null }>}
 */
async function getStats(negocioId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startStr = startOfMonth.toISOString().slice(0, 19).replace('T', ' ');

  const envBoolean = isPg ? 'true' : '1';
  const redirBoolean = isPg ? 'true' : '1';

  const [solicitudes, valoraciones, clics, mediaRow] = await Promise.all([
    allQuery(
      `SELECT COUNT(*) as c FROM review_requests WHERE professional_id = ? AND email_enviado = ? AND fecha >= ?`,
      [negocioId, envBoolean, startStr]
    ),
    allQuery(
      `SELECT COUNT(*) as c FROM review_requests WHERE professional_id = ? AND rating IS NOT NULL AND fecha >= ?`,
      [negocioId, startStr]
    ),
    allQuery(
      `SELECT COUNT(*) as c FROM review_requests WHERE professional_id = ? AND redirigido_a_google = ? AND fecha >= ?`,
      [negocioId, redirBoolean, startStr]
    ),
    getQuery(
      `SELECT AVG(rating) as media FROM review_requests WHERE professional_id = ? AND rating IS NOT NULL AND fecha >= ?`,
      [negocioId, startStr]
    )
  ]);

  const solicitudesEnviadasMes = (solicitudes[0] && solicitudes[0].c) ? Number(solicitudes[0].c) : 0;
  const valoracionesInternas = (valoraciones[0] && valoraciones[0].c) ? Number(valoraciones[0].c) : 0;
  const clicsGoogle = (clics[0] && clics[0].c) ? Number(clics[0].c) : 0;
  const mediaValoracion = mediaRow && mediaRow.media != null ? Math.round(parseFloat(mediaRow.media) * 10) / 10 : null;

  return {
    solicitudesEnviadasMes,
    valoracionesInternas,
    clicsGoogle,
    mediaValoracion
  };
}

module.exports = { getStats };
