/**
 * Rutinas semanales de ejercicios por cliente + PDF.
 */
const PDFDocument = require('pdfkit');
const { getQuery, runQuery, allQuery } = require('../utils/db');
const pacientesService = require('./pacientes');

const DIAS = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' }
];

function emptyDias() {
  return Object.fromEntries(DIAS.map((d) => [d.key, []]));
}

function parseDiasJson(str) {
  try {
    const o = typeof str === 'string' ? JSON.parse(str || '{}') : (str || {});
    const out = emptyDias();
    for (const d of DIAS) {
      const v = o[d.key];
      if (Array.isArray(v)) out[d.key] = v.map((x) => String(x).trim()).filter(Boolean);
      else if (v) out[d.key] = [String(v).trim()].filter(Boolean);
    }
    return out;
  } catch {
    return emptyDias();
  }
}

function normalizeDiasInput(dias) {
  const out = emptyDias();
  if (!dias || typeof dias !== 'object') return out;
  for (const d of DIAS) {
    const raw = dias[d.key];
    if (Array.isArray(raw)) {
      out[d.key] = raw.map((s) => String(s).trim()).filter(Boolean);
    } else if (typeof raw === 'string') {
      out[d.key] = raw.split('\n').map((s) => s.trim()).filter(Boolean);
    }
  }
  return out;
}

function normalizeSemanaInicio(value) {
  const s = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Fecha de semana no válida');
  return s;
}

function formatFechaDDMMYYYY(fecha) {
  const s = String(fecha || '').slice(0, 10);
  if (s.length < 10) return '';
  const [yy, mm, dd] = s.split('-');
  return `${dd}/${mm}/${yy}`;
}

function normalizeFecha(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function semanaFin(semanaInicio) {
  const base = normalizeFecha(semanaInicio);
  if (!base) return '';
  const d = new Date(base + 'T12:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

async function list(negocioId) {
  const rows = await allQuery(
    `SELECT r.id, r.paciente_id, r.semana_inicio, r.notas, r.updated_at,
            p.nombre AS paciente_nombre
     FROM rutinas_semanales r
     INNER JOIN pacientes p ON p.id = r.paciente_id AND p.negocio_id = r.negocio_id
     WHERE r.negocio_id = ?
     ORDER BY r.semana_inicio DESC, p.nombre ASC`,
    [negocioId]
  );
  return rows.map((row) => {
    const semana = normalizeFecha(row.semana_inicio);
    return {
      id: row.id,
      paciente_id: row.paciente_id,
      paciente_nombre: row.paciente_nombre,
      semana_inicio: semana,
      semana_fin: semanaFin(semana),
      notas: row.notas || '',
      updated_at: row.updated_at
    };
  });
}

async function getByPacienteSemana(negocioId, pacienteId, semanaInicio) {
  const semana = normalizeSemanaInicio(semanaInicio);
  const row = await getQuery(
    'SELECT * FROM rutinas_semanales WHERE negocio_id = ? AND paciente_id = ? AND semana_inicio = ?',
    [negocioId, pacienteId, semana]
  );
  if (!row) {
    return {
      id: null,
      paciente_id: Number(pacienteId),
      semana_inicio: semana,
      semana_fin: semanaFin(semana),
      dias: emptyDias(),
      notas: ''
    };
  }
  return {
    id: row.id,
    paciente_id: row.paciente_id,
    semana_inicio: normalizeFecha(row.semana_inicio),
    semana_fin: semanaFin(row.semana_inicio),
    dias: parseDiasJson(row.dias_json),
    notas: row.notas || ''
  };
}

async function save(negocioId, data) {
  const pacienteId = parseInt(data.paciente_id, 10);
  if (!pacienteId) throw new Error('Cliente obligatorio');
  const paciente = await pacientesService.getById(negocioId, pacienteId);
  if (!paciente) throw new Error('Cliente no encontrado');

  const semana = normalizeSemanaInicio(data.semana_inicio);
  const dias = normalizeDiasInput(data.dias);
  const diasJson = JSON.stringify(dias);
  const notas = data.notas != null ? String(data.notas).trim() : '';

  const existing = await getQuery(
    'SELECT id FROM rutinas_semanales WHERE negocio_id = ? AND paciente_id = ? AND semana_inicio = ?',
    [negocioId, pacienteId, semana]
  );

  if (existing) {
    await runQuery(
      'UPDATE rutinas_semanales SET dias_json = ?, notas = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND negocio_id = ?',
      [diasJson, notas, existing.id, negocioId]
    );
    return { id: existing.id };
  }

  const result = await runQuery(
    'INSERT INTO rutinas_semanales (negocio_id, paciente_id, semana_inicio, dias_json, notas) VALUES (?, ?, ?, ?, ?)',
    [negocioId, pacienteId, semana, diasJson, notas]
  );
  return { id: result.lastID || result.insertId };
}

async function generatePdfBuffer(negocioId, pacienteId, semanaInicio) {
  const paciente = await pacientesService.getById(negocioId, pacienteId);
  if (!paciente) return null;

  const plan = await getByPacienteSemana(negocioId, pacienteId, semanaInicio);
  const negocio = await require('./negocio').getById(negocioId);
  const { getBusinessConfig } = require('../utils/helpers');
  const config = await getBusinessConfig();
  const nombreNegocio = (config && config.businessName)
    ? String(config.businessName).trim()
    : (negocio && negocio.nombre) || 'Entrenador personal';

  const doc = new PDFDocument({ size: 'A4', margin: 60 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  await new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    const blue = '#2563eb';
    const gris = '#6b7280';
    const lineHeight = 16;
    const blockGap = 20;
    let y = 55;

    doc.fontSize(22).fillColor(blue).text('PLAN DE ENTRENAMIENTO', 60, y);
    y += 30;
    doc.fontSize(11).fillColor('#111827').text('Cliente: ' + (paciente.nombre || '—'), 60, y);
    y += lineHeight;
    doc.fontSize(10).fillColor(gris).text(
      'Semana del ' + formatFechaDDMMYYYY(plan.semana_inicio) + ' al ' + formatFechaDDMMYYYY(plan.semana_fin),
      60,
      y
    );
    y += lineHeight;
    if (nombreNegocio) {
      doc.text('Preparado por: ' + nombreNegocio, 60, y);
      y += lineHeight;
    }
    y += blockGap;

    doc.fontSize(10).fillColor('#111827');
    doc.text('Día', 60, y);
    doc.text('Ejercicios', 150, y);
    y += lineHeight + 4;
    doc.strokeColor('#e5e7eb').moveTo(60, y).lineTo(535, y).stroke();
    y += 12;

    for (const d of DIAS) {
      const ejercicios = plan.dias[d.key] || [];
      if (y > 720) {
        doc.addPage();
        y = 55;
      }
      doc.fontSize(10).fillColor('#111827').text(d.label, 60, y, { width: 80 });
      const startY = y;
      if (ejercicios.length === 0) {
        doc.fontSize(9).fillColor(gris).text('—', 150, y);
        y += lineHeight;
      } else {
        doc.fontSize(9).fillColor('#374151');
        for (const ej of ejercicios) {
          if (y > 720) {
            doc.addPage();
            y = 55;
          }
          doc.text('• ' + ej, 150, y, { width: 375 });
          y += lineHeight;
        }
      }
      y = Math.max(y, startY + lineHeight);
      y += 6;
      doc.strokeColor('#f3f4f6').moveTo(60, y).lineTo(535, y).stroke();
      y += 10;
    }

    if (plan.notas) {
      y += blockGap;
      if (y > 700) {
        doc.addPage();
        y = 55;
      }
      doc.fontSize(10).fillColor('#111827').text('Notas', 60, y);
      y += lineHeight;
      doc.fontSize(9).fillColor('#374151').text(plan.notas, 60, y, { width: 475 });
    }

    doc.end();
  });

  return Buffer.concat(chunks);
}

module.exports = {
  DIAS,
  emptyDias,
  list,
  getByPacienteSemana,
  save,
  generatePdfBuffer,
  formatFechaDDMMYYYY,
  semanaFin,
  normalizeFecha
};
