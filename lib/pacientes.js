/**
 * Servicio de pacientes (mini CRM). Todas las operaciones por negocio_id.
 */
const { getQuery, runQuery, allQuery } = require('../utils/db');

const ESTADOS = ['activo', 'en_proceso', 'alta_terapeutica', 'inactivo'];
const TIPO_SESION = ['online', 'presencial'];

function sanitizeEstado(estado) {
  return ESTADOS.includes(estado) ? estado : 'activo';
}

function sanitizeTipoSesion(tipo) {
  return tipo && TIPO_SESION.includes(tipo) ? tipo : null;
}

async function list(negocioId, filters = {}) {
  let query = 'SELECT * FROM pacientes WHERE negocio_id = ?';
  const params = [negocioId];
  if (filters.estado) {
    query += ' AND estado = ?';
    params.push(sanitizeEstado(filters.estado));
  }
  if (filters.busqueda) {
    query += ' AND (nombre LIKE ? OR email LIKE ? OR telefono LIKE ?)';
    const term = '%' + String(filters.busqueda).trim() + '%';
    params.push(term, term, term);
  }
  query += ' ORDER BY nombre ASC';
  return allQuery(query, params);
}

async function getById(negocioId, pacienteId) {
  return getQuery('SELECT * FROM pacientes WHERE id = ? AND negocio_id = ?', [pacienteId, negocioId]);
}

/** Histórico de citas del paciente (no canceladas para facturación; todas para histórico) */
async function getCitas(negocioId, pacienteId, soloNoCanceladas = false) {
  let q = `SELECT c.* FROM citas c WHERE c.negocio_id = ? AND c.paciente_id = ?`;
  const params = [negocioId, pacienteId];
  if (soloNoCanceladas) q += ` AND c.estado NOT IN ('cancelada')`;
  q += ' ORDER BY c.fecha DESC, c.hora_inicio DESC';
  return allQuery(q, params);
}

/** Próxima cita (fecha >= hoy, no cancelada) */
async function getProximaCita(negocioId, pacienteId) {
  const hoy = new Date().toISOString().slice(0, 10);
  return getQuery(
    `SELECT * FROM citas WHERE negocio_id = ? AND paciente_id = ? AND fecha >= ? AND estado NOT IN ('cancelada') ORDER BY fecha ASC, hora_inicio ASC LIMIT 1`,
    [negocioId, pacienteId, hoy]
  );
}

/** Total sesiones realizadas (estado pasada) */
async function getTotalSesiones(negocioId, pacienteId) {
  const r = await getQuery(
    `SELECT COUNT(*) as total FROM citas WHERE negocio_id = ? AND paciente_id = ? AND estado = 'pasada'`,
    [negocioId, pacienteId]
  );
  return (r && r.total) || 0;
}

/** Facturación estimada: suma precio_sesion de citas con estado pasada */
async function getFacturacionEstimada(negocioId, pacienteId) {
  const citas = await allQuery(
    `SELECT c.id, p.precio_sesion FROM citas c JOIN pacientes p ON p.id = c.paciente_id WHERE c.negocio_id = ? AND c.paciente_id = ? AND c.estado = 'pasada'`,
    [negocioId, pacienteId]
  );
  let total = 0;
  for (const c of citas) {
    total += (c.precio_sesion != null && !isNaN(parseFloat(c.precio_sesion))) ? parseFloat(c.precio_sesion) : 0;
  }
  return Math.round(total * 100) / 100;
}

async function create(negocioId, data) {
  const nombre = String(data.nombre || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  if (!nombre || !email) throw new Error('Nombre y email son obligatorios');

  const telefono = data.telefono ? String(data.telefono).trim() : null;
  const fecha_nacimiento = data.fecha_nacimiento || null;
  const tipo_sesion_habitual = sanitizeTipoSesion(data.tipo_sesion_habitual);
  const estado = sanitizeEstado(data.estado || 'activo');
  const motivo_consulta = data.motivo_consulta ? String(data.motivo_consulta).trim() : null;
  const notas_privadas = data.notas_privadas ? String(data.notas_privadas).trim() : null;
  const precio_sesion = data.precio_sesion != null && !isNaN(parseFloat(data.precio_sesion)) ? parseFloat(data.precio_sesion) : null;
  const metodo_pago = data.metodo_pago ? String(data.metodo_pago).trim() : null;

  const result = await runQuery(
    `INSERT INTO pacientes (negocio_id, nombre, email, telefono, fecha_nacimiento, tipo_sesion_habitual, estado, motivo_consulta, notas_privadas, precio_sesion, metodo_pago)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [negocioId, nombre, email, telefono, fecha_nacimiento, tipo_sesion_habitual, estado, motivo_consulta, notas_privadas, precio_sesion, metodo_pago]
  );
  return { id: result.lastID };
}

async function update(negocioId, pacienteId, data) {
  const p = await getById(negocioId, pacienteId);
  if (!p) return null;

  const nombre = data.nombre !== undefined ? String(data.nombre).trim() : p.nombre;
  const email = data.email !== undefined ? String(data.email).trim().toLowerCase() : p.email;
  if (!nombre || !email) throw new Error('Nombre y email son obligatorios');

  const telefono = data.telefono !== undefined ? (data.telefono ? String(data.telefono).trim() : null) : p.telefono;
  const fecha_nacimiento = data.fecha_nacimiento !== undefined ? data.fecha_nacimiento : p.fecha_nacimiento;
  const tipo_sesion_habitual = data.tipo_sesion_habitual !== undefined ? sanitizeTipoSesion(data.tipo_sesion_habitual) : p.tipo_sesion_habitual;
  const estado = data.estado !== undefined ? sanitizeEstado(data.estado) : p.estado;
  const motivo_consulta = data.motivo_consulta !== undefined ? (data.motivo_consulta ? String(data.motivo_consulta).trim() : null) : p.motivo_consulta;
  const notas_privadas = data.notas_privadas !== undefined ? (data.notas_privadas ? String(data.notas_privadas).trim() : null) : p.notas_privadas;
  const precio_sesion = data.precio_sesion !== undefined ? (data.precio_sesion != null && !isNaN(parseFloat(data.precio_sesion)) ? parseFloat(data.precio_sesion) : null) : p.precio_sesion;
  const metodo_pago = data.metodo_pago !== undefined ? (data.metodo_pago ? String(data.metodo_pago).trim() : null) : p.metodo_pago;

  await runQuery(
    `UPDATE pacientes SET nombre=?, email=?, telefono=?, fecha_nacimiento=?, tipo_sesion_habitual=?, estado=?, motivo_consulta=?, notas_privadas=?, precio_sesion=?, metodo_pago=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND negocio_id=?`,
    [nombre, email, telefono, fecha_nacimiento, tipo_sesion_habitual, estado, motivo_consulta, notas_privadas, precio_sesion, metodo_pago, pacienteId, negocioId]
  );
  return { success: true };
}

async function remove(negocioId, pacienteId) {
  const p = await getById(negocioId, pacienteId);
  if (!p) return false;
  const citasCount = await getQuery(
    'SELECT COUNT(*) as total FROM citas WHERE negocio_id = ? AND paciente_id = ?',
    [negocioId, pacienteId]
  );
  if (citasCount && Number(citasCount.total) > 0) {
    throw new Error('No se puede eliminar: el paciente tiene citas. Cancela o elimina sus citas primero.');
  }
  // Borrar consentimientos (FK a pacientes) para poder eliminar al paciente
  await runQuery('DELETE FROM consentimientos WHERE paciente_id = ?', [pacienteId]);
  await runQuery('DELETE FROM pacientes WHERE id = ? AND negocio_id = ?', [pacienteId, negocioId]);
  return true;
}

/** Buscar o crear paciente por email (para reserva pública) */
async function getOrCreateByEmail(negocioId, { nombre, email, telefono }) {
  const emailNorm = String(email).trim().toLowerCase();
  let p = await getQuery('SELECT * FROM pacientes WHERE negocio_id = ? AND email = ?', [negocioId, emailNorm]);
  if (p) return p;
  const { id } = await create(negocioId, { nombre: nombre || 'Sin nombre', email: emailNorm, telefono: telefono || null, estado: 'activo' });
  return getQuery('SELECT * FROM pacientes WHERE id = ?', [id]);
}

module.exports = {
  list,
  getById,
  getCitas,
  getProximaCita,
  getTotalSesiones,
  getFacturacionEstimada,
  create,
  update,
  remove,
  getOrCreateByEmail,
  ESTADOS,
  TIPO_SESION
};
