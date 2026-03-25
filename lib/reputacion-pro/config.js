/**
 * ReputacionPro: configuración (enlace Google, activación).
 * Guardado en negocio: google_review_url, reputacion_activa.
 */
const { getQuery, runQuery } = require('../../utils/db');

/**
 * Obtener configuración de reputación del negocio.
 * @param {number} negocioId
 * @returns {{ googleReviewUrl: string|null, reputacionActiva: boolean }}
 */
async function getConfig(negocioId) {
  const row = await getQuery(
    'SELECT google_review_url, reputacion_activa FROM negocio WHERE id = ?',
    [negocioId]
  );
  if (!row) return { googleReviewUrl: null, reputacionActiva: false };
  const activa = row.reputacion_activa !== undefined
    ? (row.reputacion_activa === 1 || row.reputacion_activa === true)
    : !!row.google_review_url;
  return {
    googleReviewUrl: row.google_review_url ? String(row.google_review_url).trim() : null,
    reputacionActiva: !!activa
  };
}

/**
 * Guardar configuración. reputacionActiva = true por defecto si hay enlace.
 * @param {number} negocioId
 * @param {{ googleReviewUrl?: string|null }} data
 */
async function saveConfig(negocioId, data) {
  const url = data.googleReviewUrl != null ? String(data.googleReviewUrl).trim() || null : undefined;
  if (url === undefined) return;
  const reputacionActiva = url ? 1 : 0;
  await runQuery(
    `UPDATE negocio SET google_review_url = ?, reputacion_activa = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [url || null, reputacionActiva, negocioId]
  );
}

module.exports = { getConfig, saveConfig };
