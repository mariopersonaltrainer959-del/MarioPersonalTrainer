/**
 * Rutinas semanales de ejercicios por cliente + PDF.
 */
const PDFDocument = require('pdfkit');
const { getQuery, runQuery } = require('../utils/db');
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

function semanaFin(semanaInicio) {
  const d = new Date(semanaInicio + 'T12:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
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
    semana_inicio: String(row.semana_inicio).slice(0, 10),
    semana_fin: semanaFin(String(row.semana_inicio).slice(0, 10)),
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

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  await new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    const blue = '#2563eb';
    const gris = '#6b7280';
    const border = '#e5e7eb';
    let y = 50;

    doc.fontSize(20).fillColor(blue).text('Plan de entrenamiento semanal', 50, y);
    y += 32;
    doc.fontSize(11).fillColor('#111827').text('Cliente: ' + (paciente.nombre || '—'), 50, y);
    y += 18;
    doc.fontSize(10).fillColor(gris).text(
      'Semana del ' + formatFechaDDMMYYYY(plan.semana_inicio) + ' al ' + formatFechaDDMMYYYY(plan.semana_fin),
      50,
      y
    );
    y += 10;
    if (nombreNegocio) {
      y += 14;
      doc.text('Preparado por: ' + nombreNegocio, 50, y);
    }
    y += 28;

    const colDia = 50;
    const colEj = 130;
    const tableW = 495;
    const rowPad = 10;

    doc.fontSize(10).fillColor('#111827');
    doc.rect(colDia, y, 75, 22).fillAndStroke('#f3f4f6', border);
    doc.rect(colEj, y, tableW - (colEj - colDia), 22).fillAndStroke('#f3f4f6', border);
    doc.fillColor('#111827').text('Día', colDia + 8, y + 6, { width: 60 });
    doc.text('Ejercicios', colEj + 8, y + 6);
    y += 22;

    for (const d of DIAS) {
      const ejercicios = plan.dias[d.key] || [];
      const cellH = Math.max(28, 14 + ejercicios.length * 14 + (ejercicios.length ? 8 : 4));

      if (y + cellH > 750) {
        doc.addPage();
        y = 50;
      }

      doc.rect(colDia, y, 75, cellH).stroke(border);
      doc.rect(colEj, y, tableW - (colEj - colDia), cellH).stroke(border);
      doc.fontSize(10).fillColor('#111827').text(d.label, colDia + 8, y + rowPad, { width: 62 });
      let ey = y + rowPad;
      if (ejercicios.length === 0) {
        doc.fontSize(9).fillColor(gris).text('—', colEj + 8, ey);
      } else {
        doc.fontSize(9).fillColor('#374151');
        for (const ej of ejercicios) {
          doc.text('• ' + ej, colEj + 8, ey, { width: tableW - (colEj - colDia) - 16 });
          ey += 14;
        }
      }
      y += cellH;
    }

    if (plan.notas) {
      y += 20;
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      doc.fontSize(10).fillColor('#111827').text('Notas', 50, y);
      y += 16;
      doc.fontSize(9).fillColor('#374151').text(plan.notas, 50, y, { width: tableW });
    }

    doc.end();
  });

  return Buffer.concat(chunks);
}

module.exports = {
  DIAS,
  emptyDias,
  getByPacienteSemana,
  save,
  generatePdfBuffer,
  formatFechaDDMMYYYY,
  semanaFin
};
