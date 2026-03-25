/**
 * Estadísticas del dashboard por negocio (mes actual).
 */
const { getQuery } = require('../utils/db');
const citasService = require('./citas');

async function getResumenMes(negocioId) {
  await citasService.actualizarEstadoPasada(negocioId);
  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().slice(0, 10);

  const sesionesRealizadas = await getQuery(
    `SELECT COUNT(*) as total FROM citas WHERE negocio_id = ? AND fecha >= ? AND fecha <= ? AND estado = 'pasada'`,
    [negocioId, primerDia, ultimoDia]
  ).then(r => (r && r.total) || 0);

  const facturacion = await getQuery(
    `SELECT COALESCE(SUM(p.precio_sesion), 0) as total
     FROM citas c
     JOIN pacientes p ON p.id = c.paciente_id
     WHERE c.negocio_id = ? AND c.fecha >= ? AND c.fecha <= ? AND c.estado = 'pasada' AND p.precio_sesion IS NOT NULL`,
    [negocioId, primerDia, ultimoDia]
  ).then(r => (r && r.total != null) ? parseFloat(r.total) : 0);

  const cancelaciones = await getQuery(
    `SELECT COUNT(*) as total FROM citas WHERE negocio_id = ? AND fecha >= ? AND fecha <= ? AND estado = 'cancelada'`,
    [negocioId, primerDia, ultimoDia]
  ).then(r => (r && r.total) || 0);

  const pacientesActivos = await getQuery(
    `SELECT COUNT(DISTINCT paciente_id) as total FROM citas c
     WHERE c.negocio_id = ? AND c.fecha >= ? AND c.fecha <= ? AND c.estado NOT IN ('cancelada')`,
    [negocioId, primerDia, ultimoDia]
  ).then(r => (r && r.total) || 0);

  return {
    sesionesRealizadas: Number(sesionesRealizadas),
    facturacionEstimada: Math.round(facturacion * 100) / 100,
    cancelaciones: Number(cancelaciones),
    pacientesActivos: Number(pacientesActivos),
    periodo: { inicio: primerDia, fin: ultimoDia }
  };
}

module.exports = { getResumenMes };
