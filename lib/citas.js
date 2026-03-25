/**
 * Servicio de citas (nueva tabla). Sin solapamientos.
 * Estados: confirmada, pendiente, cancelada, pasada, no_asistio, completada.
 * Al marcar 'completada' se programa el envío de solicitud de reseña (ReputacionPro) 3h después.
 */
const { getQuery, runQuery, allQuery } = require('../utils/db');

const ESTADOS = ['confirmada', 'pendiente', 'cancelada', 'pasada', 'no_asistio', 'completada'];
const TIPO_SESION = ['online', 'presencial'];

function sanitizeEstado(estado) {
  return ESTADOS.includes(estado) ? estado : 'confirmada';
}

function sanitizeTipoSesion(tipo) {
  return tipo && TIPO_SESION.includes(tipo) ? tipo : null;
}

/** Marcar como 'pasada' las citas cuya fecha ya pasó */
async function actualizarEstadoPasada(negocioId) {
  const hoy = new Date().toISOString().slice(0, 10);
  const ahora = new Date().toTimeString().slice(0, 5);
  await runQuery(
    `UPDATE citas SET estado = 'pasada', updated_at = CURRENT_TIMESTAMP WHERE negocio_id = ? AND estado IN ('confirmada', 'pendiente') AND (fecha < ? OR (fecha = ? AND hora_fin <= ?))`,
    [negocioId, hoy, hoy, ahora]
  );
}

async function list(negocioId, { startDate, endDate, pacienteId } = {}) {
  await actualizarEstadoPasada(negocioId);
  let query = `SELECT c.*, p.nombre as paciente_nombre, p.email as paciente_email, p.telefono as paciente_telefono
    FROM citas c
    JOIN pacientes p ON p.id = c.paciente_id
    WHERE c.negocio_id = ?`;
  const params = [negocioId];
  if (startDate) { query += ' AND c.fecha >= ?'; params.push(startDate); }
  if (endDate) { query += ' AND c.fecha <= ?'; params.push(endDate); }
  if (pacienteId) { query += ' AND c.paciente_id = ?'; params.push(pacienteId); }
  query += ' ORDER BY c.fecha ASC, c.hora_inicio ASC';
  return allQuery(query, params);
}

async function getById(negocioId, citaId) {
  return getQuery(
    `SELECT c.*, p.nombre as paciente_nombre, p.email as paciente_email, p.telefono as paciente_telefono
     FROM citas c JOIN pacientes p ON p.id = c.paciente_id
     WHERE c.id = ? AND c.negocio_id = ?`,
    [citaId, negocioId]
  );
}

/** Comprobar solapamiento: otra cita (distinta de excludeCitaId) en el mismo negocio con mismo día y rangos que se solapan */
async function haySolapamiento(negocioId, fecha, horaInicio, horaFin, excludeCitaId = null) {
  let q = `SELECT id FROM citas WHERE negocio_id = ? AND fecha = ? AND estado NOT IN ('cancelada')
    AND ( (hora_inicio < ? AND hora_fin > ?) OR (hora_inicio < ? AND hora_fin > ?) OR (hora_inicio >= ? AND hora_fin <= ?) )`;
  const params = [negocioId, fecha, horaFin, horaInicio, horaFin, horaInicio, horaInicio, horaFin];
  if (excludeCitaId) { q += ' AND id != ?'; params.push(excludeCitaId); }
  const row = await getQuery(q, params);
  return !!row;
}

/** Comprobar si el slot está dentro de horarios de apertura y no está en blocked_slots */
async function slotDentroHorarios(negocioId, fecha, horaInicio, horaFin) {
  const [y, m, d] = fecha.split('-').map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay();
  const hours = await allQuery(
    'SELECT start_hour, end_hour FROM opening_hours WHERE negocio_id = ? AND day_of_week = ?',
    [negocioId, dayOfWeek]
  );
  const hi = horaInicio.slice(0, 5);
  const hf = horaFin.slice(0, 5);
  const inRange = hours.some(({ start_hour, end_hour }) => {
    const [sh, sm] = [start_hour, 0];
    const [eh, em] = [end_hour, 0];
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const [hhi, mmi] = hi.split(':').map(Number);
    const [hhf, mmf] = hf.split(':').map(Number);
    const slotStart = hhi * 60 + mmi;
    const slotEnd = hhf * 60 + mmf;
    return slotStart >= startMin && slotEnd <= endMin;
  });
  if (!inRange) return false;
  const startDt = `${fecha}T${horaInicio}:00`;
  const endDt = `${fecha}T${horaFin}:00`;
  const blocked = await allQuery(
    `SELECT id FROM blocked_slots WHERE negocio_id = ?
     AND ( (start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?) )`,
    [negocioId, startDt, startDt, endDt, endDt]
  );
  return blocked.length === 0;
}

async function create(negocioId, data) {
  const { paciente_id, fecha, hora_inicio, hora_fin, tipo_sesion, estado, notas } = data;
  if (!paciente_id || !fecha || !hora_inicio || !hora_fin) throw new Error('paciente_id, fecha, hora_inicio y hora_fin son obligatorios');

  const hi = String(hora_inicio).trim().slice(0, 5);
  const hf = String(hora_fin).trim().slice(0, 5);
  const tipo = sanitizeTipoSesion(tipo_sesion);
  const est = sanitizeEstado(estado || 'confirmada');
  const notasVal = notas ? String(notas).trim() : null;

  const overlap = await haySolapamiento(negocioId, fecha, hi, hf, null);
  if (overlap) throw new Error('El horario se solapa con otra cita');

  const dentro = await slotDentroHorarios(negocioId, fecha, hi, hf);
  if (!dentro) throw new Error('El horario no está dentro del horario de atención o está bloqueado');

  const result = await runQuery(
    `INSERT INTO citas (negocio_id, paciente_id, fecha, hora_inicio, hora_fin, tipo_sesion, estado, notas)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [negocioId, paciente_id, fecha, hi, hf, tipo, est, notasVal]
  );
  return { id: result.lastID };
}

async function update(negocioId, citaId, data) {
  const c = await getById(negocioId, citaId);
  if (!c) return null;

  const fecha = data.fecha !== undefined ? data.fecha : c.fecha;
  const hora_inicio = (data.hora_inicio !== undefined ? data.hora_inicio : c.hora_inicio).toString().trim().slice(0, 5);
  const hora_fin = (data.hora_fin !== undefined ? data.hora_fin : c.hora_fin).toString().trim().slice(0, 5);
  const tipo_sesion = data.tipo_sesion !== undefined ? sanitizeTipoSesion(data.tipo_sesion) : c.tipo_sesion;
  const estado = data.estado !== undefined ? sanitizeEstado(data.estado) : c.estado;
  const notas = data.notas !== undefined ? (data.notas ? String(data.notas).trim() : null) : c.notas;

  if (estado !== 'cancelada') {
    const overlap = await haySolapamiento(negocioId, fecha, hora_inicio, hora_fin, citaId);
    if (overlap) throw new Error('El horario se solapa con otra cita');
    const dentro = await slotDentroHorarios(negocioId, fecha, hora_inicio, hora_fin);
    if (!dentro) throw new Error('El horario no está dentro del horario de atención o está bloqueado');
  }

  await runQuery(
    `UPDATE citas SET fecha=?, hora_inicio=?, hora_fin=?, tipo_sesion=?, estado=?, notas=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND negocio_id=?`,
    [fecha, hora_inicio, hora_fin, tipo_sesion, estado, notas, citaId, negocioId]
  );
  return { success: true };
}

async function cancel(negocioId, citaId) {
  const c = await getById(negocioId, citaId);
  if (!c) return false;
  await runQuery(`UPDATE citas SET estado = 'cancelada', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND negocio_id = ?`, [citaId, negocioId]);
  return true;
}

async function remove(negocioId, citaId) {
  const c = await getById(negocioId, citaId);
  if (!c) return false;
  await runQuery('DELETE FROM citas WHERE id = ? AND negocio_id = ?', [citaId, negocioId]);
  return true;
}

/**
 * Comprueba si un slot [hora_inicio, hora_fin] se solapa con algún rango busy (Google Calendar).
 */
function slotSolapaConBusy(fecha, horaInicio, horaFin, busyRanges) {
  if (!busyRanges || busyRanges.length === 0) return false;
  const slotStart = new Date(`${fecha}T${horaInicio}`).getTime();
  const slotEnd = new Date(`${fecha}T${horaFin}`).getTime();
  return busyRanges.some((b) => {
    const bStart = b.start.getTime();
    const bEnd = b.end.getTime();
    return slotStart < bEnd && slotEnd > bStart;
  });
}

/**
 * Slots disponibles para un día: única fuente de verdad para "qué horas se pueden reservar".
 * Solo devuelve huecos que: están en horario de atención, no están bloqueados, no se solapan con ninguna cita (salvo canceladas) y son en el futuro.
 * Si el negocio tiene Google Calendar conectado con "sync busy", también se excluyen los huecos ocupados en Google.
 */
async function getSlotsDisponibles(negocioId, fecha, duracionMinutos) {
  const { getOpeningHours } = require('../utils/helpers');
  const hours = await getOpeningHours(negocioId);
  const dayOfWeek = new Date(fecha + 'T12:00:00').getDay();
  const dayHours = hours[dayOfWeek] || [];
  if (dayHours.length === 0) return [];

  let busyRanges = [];
  try {
    const googleCalendar = require('./google-calendar');
    if (await googleCalendar.isSyncBusyEnabled(negocioId)) {
      busyRanges = await googleCalendar.getBusyRanges(negocioId, fecha);
    }
  } catch (_) {}

  const slots = [];
  for (const [startHour, endHour] of dayHours) {
    let h = startHour;
    let m = 0;
    while (h < endHour || (h === endHour && m === 0)) {
      const hi = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const endMin = h * 60 + m + duracionMinutos;
      const eh = Math.floor(endMin / 60);
      const em = endMin % 60;
      if (eh > endHour || (eh === endHour && em > 0)) break;
      const hf = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
      const overlap = await haySolapamiento(negocioId, fecha, hi, hf, null);
      const dentro = await slotDentroHorarios(negocioId, fecha, hi, hf);
      const ocupadoEnGoogle = slotSolapaConBusy(fecha, hi, hf, busyRanges);
      if (!overlap && dentro && !ocupadoEnGoogle) {
        const now = new Date();
        const slotDate = new Date(`${fecha}T${hi}`);
        if (slotDate > now) slots.push({ hora_inicio: hi, hora_fin: hf, display: hi });
      }
      m += duracionMinutos;
      if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
    }
  }
  return slots;
}

module.exports = {
  list,
  getById,
  create,
  update,
  cancel,
  remove,
  getSlotsDisponibles,
  haySolapamiento,
  slotDentroHorarios,
  actualizarEstadoPasada,
  ESTADOS,
  TIPO_SESION
};
