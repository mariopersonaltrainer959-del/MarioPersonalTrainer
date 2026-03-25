/**
 * Módulo ReputacionPro: solicitudes de reseña automáticas tras cita completada.
 * - Configuración: enlace Google, activación.
 * - Trigger: 3h después de marcar cita como completada → email al paciente.
 * - Página feedback: estrellas 1-5; 4-5 → botón Google; 1-2-3 → formulario comentario.
 * - Dashboard: estadísticas (solicitudes, valoraciones, clics Google, media).
 *
 * Preparado para futura integración con Google Business Profile API (place_id, etc.).
 */
const config = require('./config');
const email = require('./email');
const jobs = require('./jobs');
const stats = require('./stats');
const feedback = require('./feedback');

module.exports = {
  config,
  email,
  jobs,
  stats,
  feedback
};
