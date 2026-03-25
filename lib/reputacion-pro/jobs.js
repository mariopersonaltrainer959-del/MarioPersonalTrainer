/**
 * ReputacionPro: programar y ejecutar envío de email 3h después de cita completada.
 * - Al marcar cita como completada se inserta un job en reputacion_jobs (programado_para = now + 3h).
 * - Un cron/interval procesa jobs vencidos y envía el email.
 */
const { runQuery, getQuery, allQuery } = require('../../utils/db');
const { getConfig } = require('./config');
const { sendReviewRequestEmail } = require('./email');
const negocioService = require('../negocio');
const citasService = require('../citas');

const DELAY_MS = 3 * 60 * 60 * 1000; // 3 horas

/**
 * Programar envío de solicitud de reseña 3 horas después de marcar la cita como completada.
 * Solo si el negocio tiene googleReviewUrl y reputacionActiva.
 * @param {number} negocioId
 * @param {number} citaId
 */
async function scheduleReviewJob(negocioId, citaId) {
  const config = await getConfig(negocioId);
  if (!config.googleReviewUrl || !config.reputacionActiva) return;
  const programadoPara = new Date(Date.now() + DELAY_MS);
  const isPg = !!process.env.DATABASE_URL;
  const programadoStr = isPg ? programadoPara.toISOString() : programadoPara.toISOString();
  await runQuery(
    `INSERT INTO reputacion_jobs (cita_id, negocio_id, programado_para, enviado) VALUES (?, ?, ?, 0)`,
    [citaId, negocioId, programadoStr]
  );
}

/**
 * Procesar jobs vencidos: enviar email y marcar enviado. Crear review_request con email_enviado=true.
 */
async function processDueJobs() {
  const now = new Date().toISOString();
  const isPg = !!process.env.DATABASE_URL;
  const jobs = await allQuery(
    `SELECT id, cita_id, negocio_id FROM reputacion_jobs WHERE programado_para <= ? AND enviado = 0`,
    [now]
  );
  for (const job of jobs) {
    try {
      const cita = await citasService.getById(job.negocio_id, job.cita_id);
      if (!cita) {
        await markJobSent(job.id);
        continue;
      }
      const negocio = await negocioService.getById(job.negocio_id);
      if (!negocio) {
        await markJobSent(job.id);
        continue;
      }
      const config = await getConfig(job.negocio_id);
      if (!config.googleReviewUrl || !config.reputacionActiva) {
        await markJobSent(job.id);
        continue;
      }
      await sendReviewRequestEmail(negocio, {
        nombre: cita.paciente_nombre,
        email: cita.paciente_email
      }, job.cita_id);
      await runQuery(
        `INSERT INTO review_requests (session_id, professional_id, email_enviado, fecha) VALUES (?, ?, 1, ?)`,
        [job.cita_id, job.negocio_id, now]
      );
      await markJobSent(job.id);
    } catch (err) {
      console.error('[ReputacionPro] Error procesando job', job.id, err.message);
    }
  }
}

function markJobSent(jobId) {
  const isPg = !!process.env.DATABASE_URL;
  return runQuery(
    `UPDATE reputacion_jobs SET enviado = ? WHERE id = ?`,
    [isPg ? true : 1, jobId]
  );
}

module.exports = { scheduleReviewJob, processDueJobs, DELAY_MS };
