/**
 * Plantillas de email por negocio. Variables: {{nombre_paciente}}, {{fecha}}, {{hora}}, {{nombre_negocio}}
 */
const { getQuery, runQuery, allQuery } = require('../utils/db');

function aplicarVariables(texto, vars) {
  if (!texto || typeof texto !== 'string') return '';
  let out = texto;
  Object.keys(vars).forEach((key) => {
    const val = vars[key] != null ? String(vars[key]) : '';
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), val);
  });
  return out;
}

async function list(negocioId) {
  return allQuery('SELECT id, nombre, asunto, cuerpo, updated_at FROM plantillas_email WHERE negocio_id = ? ORDER BY nombre', [negocioId]);
}

async function getByName(negocioId, nombre) {
  return getQuery('SELECT * FROM plantillas_email WHERE negocio_id = ? AND nombre = ?', [negocioId, nombre]);
}

async function getById(negocioId, id) {
  return getQuery('SELECT * FROM plantillas_email WHERE id = ? AND negocio_id = ?', [id, negocioId]);
}

async function upsert(negocioId, nombre, asunto, cuerpo) {
  const exist = await getByName(negocioId, nombre);
  if (exist) {
    await runQuery(
      'UPDATE plantillas_email SET asunto = ?, cuerpo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND negocio_id = ?',
      [String(asunto || '').trim(), String(cuerpo || '').trim(), exist.id, negocioId]
    );
    return { id: exist.id };
  }
  const r = await runQuery(
    'INSERT INTO plantillas_email (negocio_id, nombre, asunto, cuerpo) VALUES (?, ?, ?, ?)',
    [negocioId, String(nombre).trim(), String(asunto || '').trim(), String(cuerpo || '').trim()]
  );
  return { id: r.lastID };
}

/**
 * Renderiza asunto y cuerpo con variables para un paciente y cita.
 */
function render(plantilla, { nombre_paciente, fecha, hora, nombre_negocio }) {
  const vars = {
    nombre_paciente: nombre_paciente || '',
    fecha: fecha || '',
    hora: hora || '',
    nombre_negocio: nombre_negocio || ''
  };
  return {
    asunto: aplicarVariables(plantilla.asunto, vars),
    cuerpo: aplicarVariables(plantilla.cuerpo, vars)
  };
}

module.exports = {
  list,
  getByName,
  getById,
  upsert,
  render,
  aplicarVariables
};
