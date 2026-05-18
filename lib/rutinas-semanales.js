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

async function remove(negocioId, rutinaId) {
  const row = await getQuery(
    'SELECT id FROM rutinas_semanales WHERE id = ? AND negocio_id = ?',
    [rutinaId, negocioId]
  );
  if (!row) return false;
  await runQuery('DELETE FROM rutinas_semanales WHERE id = ? AND negocio_id = ?', [rutinaId, negocioId]);
  return true;
}

function fillRoundRect(doc, x, y, w, h, r, color) {
  doc.fillColor(color);
  if (typeof doc.roundedRect === 'function') doc.roundedRect(x, y, w, h, r).fill();
  else doc.rect(x, y, w, h).fill();
}

function strokeRoundRect(doc, x, y, w, h, r, strokeColor, lineWidth) {
  doc.strokeColor(strokeColor).lineWidth(lineWidth || 0.75);
  if (typeof doc.roundedRect === 'function') doc.roundedRect(x, y, w, h, r).stroke();
  else doc.rect(x, y, w, h).stroke();
}

function measureDayBlockHeight(doc, ejercicios, contentWidth) {
  const pad = 14;
  const labelH = 22;
  if (!ejercicios.length) return pad * 2 + labelH + 18;
  let h = pad + labelH + 8;
  doc.fontSize(10);
  for (const ej of ejercicios) {
    h += doc.heightOfString(ej, { width: contentWidth - 28 }) + 8;
  }
  return h + pad;
}

function drawPdfFooter(doc, contacto, pageBottom) {
  const y = pageBottom - 36;
  doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(48, y).lineTo(547, y).stroke();
  doc.fontSize(8).fillColor('#94a3b8');
  const linea = contacto.filter(Boolean).join('  ·  ');
  if (linea) {
    doc.text(linea, 48, y + 10, { width: 499, align: 'center' });
  }
  doc.text('Plan personalizado · Confidencial', 48, y + 22, { width: 499, align: 'center' });
}

function drawPdfHeader(doc, nombreNegocio) {
  doc.save();
  doc.rect(0, 0, 595.28, 108).fill('#1e40af');
  doc.rect(0, 100, 595.28, 8).fill('#3b82f6');
  doc.fillColor('#ffffff').fontSize(26).text('Plan de entrenamiento', 48, 38, { width: 500 });
  doc.fontSize(11).fillColor('#bfdbfe').text(nombreNegocio || 'Entrenador personal', 48, 72, { width: 500 });
  doc.restore();
}

function drawClientCard(doc, paciente, semanaInicio, semanaFin, y) {
  const x = 48;
  const w = 499;
  const h = 76;
  fillRoundRect(doc, x, y, w, h, 8, '#f0f9ff');
  doc.fillColor('#2563eb').rect(x, y, 6, h).fill();
  doc.fillColor('#64748b').fontSize(8).text('PREPARADO PARA', x + 20, y + 16);
  doc.fillColor('#0f172a').fontSize(18).text(paciente.nombre || '—', x + 20, y + 30, { width: w - 40 });
  doc.fillColor('#475569').fontSize(10).text(
    'Semana del ' + formatFechaDDMMYYYY(semanaInicio) + ' al ' + formatFechaDDMMYYYY(semanaFin),
    x + 20,
    y + 54
  );
  return y + h + 22;
}

function drawDayBlock(doc, diaLabel, ejercicios, y, contentX, contentW, alt) {
  const blockH = measureDayBlockHeight(doc, ejercicios, contentW);
  if (y + blockH > 740) return { y, newPage: true };

  const bg = alt ? '#f8fafc' : '#ffffff';
  fillRoundRect(doc, contentX, y, contentW, blockH, 6, bg);
  strokeRoundRect(doc, contentX, y, contentW, blockH, 6, '#e2e8f0');

  const pillW = 88;
  fillRoundRect(doc, contentX + 12, y + 12, pillW, 22, 11, '#2563eb');
  doc.fillColor('#ffffff').fontSize(10).text(diaLabel, contentX + 12, y + 17, { width: pillW, align: 'center' });

  let ey = y + 44;
  const ex = contentX + 20;
  const ew = contentW - 36;

  if (!ejercicios.length) {
    doc.fontSize(10).fillColor('#94a3b8').text('Descanso o sin ejercicios programados', ex, ey, { width: ew });
    ey += 20;
  } else {
    doc.fontSize(10);
    for (const ej of ejercicios) {
      const lineH = doc.heightOfString(ej, { width: ew - 16 });
      doc.circle(ex + 4, ey + 5, 2.5).fill('#3b82f6');
      doc.fillColor('#334155').text(ej, ex + 14, ey, { width: ew - 16 });
      ey += lineH + 10;
    }
  }

  return { y: y + blockH + 10, newPage: false };
}

function drawNotesBlock(doc, notas, y, contentX, contentW) {
  const pad = 16;
  doc.fontSize(10);
  const textH = doc.heightOfString(notas, { width: contentW - pad * 2 });
  const blockH = textH + pad * 2 + 20;
  if (y + blockH > 750) return { y, newPage: true };

  fillRoundRect(doc, contentX, y, contentW, blockH, 6, '#fffbeb');
  strokeRoundRect(doc, contentX, y, contentW, blockH, 6, '#fcd34d');
  doc.fillColor('#b45309').fontSize(9).text('NOTAS DEL ENTRENADOR', contentX + pad, y + 14);
  doc.fillColor('#78350f').fontSize(10).text(notas, contentX + pad, y + 32, { width: contentW - pad * 2 });
  return { y: y + blockH + 12, newPage: false };
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
  const telefono = (negocio && negocio.telefono) || (config && config.businessPhone) || '';
  const email = (negocio && negocio.email) || (config && config.businessEmail) || '';
  const direccion = (negocio && negocio.direccion) || (config && config.businessAddress) || '';
  const contacto = [
    telefono ? 'Tel. ' + telefono : '',
    email,
    direccion
  ];

  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const contentX = 48;
  const contentW = 499;
  const pageBottom = 842;

  await new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    drawPdfHeader(doc, nombreNegocio);
    let y = 124;
    y = drawClientCard(doc, paciente, plan.semana_inicio, plan.semana_fin, y);

    doc.fillColor('#64748b').fontSize(9).text('TU RUTINA SEMANAL', contentX, y);
    y += 22;

    let alt = false;
    for (const d of DIAS) {
      const ejercicios = plan.dias[d.key] || [];
      let result = drawDayBlock(doc, d.label, ejercicios, y, contentX, contentW, alt);
      if (result.newPage) {
        drawPdfFooter(doc, contacto, pageBottom);
        doc.addPage();
        drawPdfHeader(doc, nombreNegocio);
        y = 124;
        result = drawDayBlock(doc, d.label, ejercicios, y, contentX, contentW, alt);
      }
      y = result.y;
      alt = !alt;
    }

    if (plan.notas) {
      let notesResult = drawNotesBlock(doc, plan.notas, y, contentX, contentW);
      if (notesResult.newPage) {
        drawPdfFooter(doc, contacto, pageBottom);
        doc.addPage();
        drawPdfHeader(doc, nombreNegocio);
        y = 124;
        notesResult = drawNotesBlock(doc, plan.notas, y, contentX, contentW);
      }
      y = notesResult.y;
    }

    drawPdfFooter(doc, contacto, pageBottom);
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
  remove,
  generatePdfBuffer,
  formatFechaDDMMYYYY,
  semanaFin,
  normalizeFecha
};
