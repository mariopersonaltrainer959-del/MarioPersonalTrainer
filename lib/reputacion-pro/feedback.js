/**
 * ReputacionPro: registro de valoración y redirección a Google.
 * - Validar sessionId (cita existente y del mismo flujo).
 * - No permitir modificar valoración ya enviada.
 */
const { getQuery, runQuery } = require('../../utils/db');
const citasService = require('../citas');
const negocioService = require('../negocio');

const isPg = !!process.env.DATABASE_URL;

/**
 * Obtener datos mínimos de la sesión para la página de feedback (sin datos sensibles).
 * @param {string} sessionId - id de la cita
 * @returns {{ valid: boolean, googleReviewUrl?: string|null, negocioId?: number }}
 */
async function getSessionForFeedback(sessionId) {
  const id = parseInt(sessionId, 10);
  if (!id || id <= 0) return { valid: false };
  const { getQuery } = require('../../utils/db');
  const citaRow = await getQuery('SELECT id, negocio_id FROM citas WHERE id = ?', [id]);
  if (!citaRow) return { valid: false };
  const negocioId = citaRow.negocio_id;
  const negocio = await negocioService.getById(negocioId);
  const googleReviewUrl = negocio && negocio.google_review_url ? negocio.google_review_url : null;
  return { valid: true, googleReviewUrl, negocioId };
}

/**
 * Comprobar si ya existe una valoración/feedback para esta sesión (no permitir modificar).
 */
async function hasExistingFeedback(sessionId) {
  const row = await getQuery(
    'SELECT id FROM review_requests WHERE session_id = ? AND (rating IS NOT NULL OR comentario IS NOT NULL)',
    [sessionId]
  );
  return !!row;
}

/**
 * Registrar valoración (1-5). Si 4-5 se puede redirigir a Google después; si 1-2-3 se guarda comentario.
 * Crea o actualiza review_requests.
 */
async function submitRating(negocioId, sessionId, rating, comentario = null) {
  const id = parseInt(sessionId, 10);
  if (!id || rating < 1 || rating > 5) throw new Error('Datos no válidos');
  const exists = await hasExistingFeedback(String(id));
  if (exists) throw new Error('Ya has enviado tu valoración');
  const cita = await citasService.getById(negocioId, id);
  if (!cita) throw new Error('Sesión no encontrada');
  const existing = await getQuery(
    'SELECT id FROM review_requests WHERE session_id = ? AND professional_id = ?',
    [id, negocioId]
  );
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (existing) {
    await runQuery(
      `UPDATE review_requests SET rating = ?, comentario = ?, fecha = ? WHERE session_id = ? AND professional_id = ?`,
      [rating, comentario || null, now, id, negocioId]
    );
  } else {
    await runQuery(
      `INSERT INTO review_requests (session_id, professional_id, email_enviado, rating, comentario, fecha) VALUES (?, ?, 0, ?, ?, ?)`,
      [id, negocioId, rating, comentario || null, now]
    );
  }
}

/**
 * Marcar que el usuario hizo clic en "Dejar reseña en Google".
 */
async function recordRedirectToGoogle(negocioId, sessionId) {
  const id = parseInt(sessionId, 10);
  if (!id) throw new Error('Sesión no válida');
  const cita = await citasService.getById(negocioId, id);
  if (!cita) throw new Error('Sesión no encontrada');
  const existing = await getQuery(
    'SELECT id FROM review_requests WHERE session_id = ? AND professional_id = ?',
    [id, negocioId]
  );
  const redir = isPg ? true : 1;
  if (existing) {
    await runQuery(
      `UPDATE review_requests SET redirigido_a_google = ? WHERE session_id = ? AND professional_id = ?`,
      [redir, id, negocioId]
    );
  } else {
    await runQuery(
      `INSERT INTO review_requests (session_id, professional_id, email_enviado, redirigido_a_google, fecha) VALUES (?, ?, 0, ?, ?)`,
      [id, negocioId, redir, new Date().toISOString().slice(0, 19).replace('T', ' ')]
    );
  }
}

module.exports = {
  getSessionForFeedback,
  hasExistingFeedback,
  submitRating,
  recordRedirectToGoogle
};
