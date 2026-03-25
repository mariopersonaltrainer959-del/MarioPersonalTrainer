/**
 * Servicio de facturas. Listar, crear y generar PDF.
 */
const { getQuery, runQuery, allQuery } = require('../utils/db');
const PDFDocument = require('pdfkit');

function formatEuro(n) {
  return typeof n === 'number' ? n.toFixed(2).replace('.', ',') + ' €' : (n || '0,00') + ' €';
}

/** Siguiente número de factura para el año (ej. 2025-0001) */
async function getNextNumeroFactura(negocioId) {
  const year = new Date().getFullYear();
  const prefix = year + '-';
  const row = await getQuery(
    `SELECT numero_factura FROM facturas WHERE negocio_id = ? AND numero_factura LIKE ? ORDER BY id DESC LIMIT 1`,
    [negocioId, prefix + '%']
  );
  let next = 1;
  if (row && row.numero_factura) {
    const parts = String(row.numero_factura).split('-');
    if (parts.length >= 2) next = parseInt(parts[1], 10) + 1;
  }
  return prefix + String(next).padStart(4, '0');
}

async function list(negocioId) {
  return allQuery(
    `SELECT * FROM facturas WHERE negocio_id = ? ORDER BY fecha_emision DESC, id DESC`,
    [negocioId]
  );
}

async function getById(negocioId, id) {
  return getQuery('SELECT * FROM facturas WHERE id = ? AND negocio_id = ?', [id, negocioId]);
}

async function remove(negocioId, facturaId) {
  const f = await getById(negocioId, facturaId);
  if (!f) return false;
  await runQuery('DELETE FROM facturas WHERE id = ? AND negocio_id = ?', [facturaId, negocioId]);
  return true;
}

async function create(negocioId, data) {
  const {
    cliente_nombre, cliente_nif, cliente_direccion, cliente_cp, cliente_ciudad, cliente_provincia,
    concepto, descripcion, totalPagado, ivaPct, forma_pago
  } = data;
  const total = parseFloat(totalPagado) || 0;
  const ivaPctNum = parseFloat(ivaPct) || 21;
  const precioBase = Math.round((total / (1 + ivaPctNum / 100)) * 100) / 100;
  const ivaEur = Math.round((total - precioBase) * 100) / 100;
  const numero = await getNextNumeroFactura(negocioId);
  const fecha = new Date().toISOString().slice(0, 10);
  await runQuery(
    `INSERT INTO facturas (negocio_id, numero_factura, fecha_emision, cliente_nombre, cliente_nif, cliente_direccion, cliente_cp, cliente_ciudad, cliente_provincia, concepto, descripcion, precio_base, iva_pct, iva_eur, total, forma_pago)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      negocioId, numero, fecha,
      String(cliente_nombre || '').trim(),
      cliente_nif ? String(cliente_nif).trim() : null,
      cliente_direccion ? String(cliente_direccion).trim() : null,
      cliente_cp ? String(cliente_cp).trim() : null,
      cliente_ciudad ? String(cliente_ciudad).trim() : null,
      cliente_provincia ? String(cliente_provincia).trim() : null,
      String(concepto || '').trim(),
      descripcion ? String(descripcion).trim() : null,
      precioBase, ivaPctNum, ivaEur, total,
      forma_pago ? String(forma_pago).trim() : null
    ]
  );
  const row = await getQuery('SELECT id FROM facturas WHERE negocio_id = ? AND numero_factura = ?', [negocioId, numero]);
  return { id: row.id, numero_factura: numero };
}

/** Fecha en formato DD/MM/YYYY */
function formatFechaDDMMYYYY(fecha) {
  if (!fecha) return '';
  const s = typeof fecha === 'string' ? fecha.slice(0, 10) : new Date(fecha).toISOString().slice(0, 10);
  if (s.length < 10) return '';
  const [yy, mm, dd] = s.split('-');
  return `${dd}/${mm}/${yy}`;
}

/** Genera el buffer PDF de la factura (estilo claro, espaciado, nombre negocio desde config) */
async function generatePdfBuffer(negocioId, facturaId) {
  const factura = await getById(negocioId, facturaId);
  if (!factura) return null;
  const negocio = await require('./negocio').getById(negocioId);
  if (!negocio) return null;
  const { getBusinessConfig } = require('../utils/helpers');
  const config = await getBusinessConfig();
  const nombreNegocio = (config && config.businessName) ? String(config.businessName).trim() : (negocio.nombre || '');

  const doc = new PDFDocument({ size: 'A4', margin: 60 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  await new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    const blue = '#2563eb';
    const gris = '#6b7280';
    const lineHeight = 16;
    const blockGap = 28;

    doc.fontSize(22).fillColor(blue).text('FACTURA', 60, 55);
    doc.fontSize(10).fillColor(gris);
    doc.text(`Nº ${factura.numero_factura}`, 60, 55, { width: 450, align: 'right' });
    doc.text(`Fecha: ${formatFechaDDMMYYYY(factura.fecha_emision)}`, 60, 72, { width: 450, align: 'right' });

    let yEmisor = 115;
    doc.fontSize(11).fillColor('#111827');
    doc.text('EMISOR', 60, yEmisor);
    yEmisor += lineHeight + 4;
    doc.fontSize(10).fillColor('#374151');
    doc.text(nombreNegocio || '—', 60, yEmisor, { width: 240 });
    yEmisor += lineHeight;
    if (negocio.nif) { doc.text('NIF: ' + negocio.nif, 60, yEmisor); yEmisor += lineHeight; }
    if (negocio.direccion) { doc.text(negocio.direccion, 60, yEmisor, { width: 240 }); yEmisor += lineHeight; }
    if (negocio.telefono) { doc.text('Tel: ' + negocio.telefono, 60, yEmisor); yEmisor += lineHeight; }
    if (negocio.email) { doc.text('Email: ' + negocio.email, 60, yEmisor, { width: 240 }); yEmisor += lineHeight; }

    let yCliente = 115;
    doc.fontSize(11).fillColor('#111827');
    doc.text('CLIENTE', 330, yCliente);
    yCliente += lineHeight + 4;
    doc.fontSize(10).fillColor('#374151');
    doc.text(factura.cliente_nombre || '—', 330, yCliente, { width: 230 });
    yCliente += lineHeight;
    if (factura.cliente_nif) { doc.text('NIF: ' + factura.cliente_nif, 330, yCliente); yCliente += lineHeight; }
    const dirParts = [factura.cliente_direccion, factura.cliente_cp, factura.cliente_ciudad, factura.cliente_provincia].filter(Boolean);
    if (dirParts.length) { doc.text(dirParts.join(', '), 330, yCliente, { width: 230 }); yCliente += lineHeight; }

    let y = Math.max(yEmisor, yCliente) + blockGap;
    doc.fontSize(10).fillColor('#111827');
    doc.text('Concepto', 60, y);
    doc.text('Precio Base', 300, y);
    doc.text('IVA', 400, y);
    doc.text('Total', 480, y);
    y += lineHeight + 6;
    doc.moveTo(60, y).lineTo(535, y).stroke();
    y += 14;
    doc.fillColor('#374151');
    doc.fontSize(10).text(factura.concepto || '', 60, y, { width: 230 });
    const conceptY = y;
    if (factura.descripcion) doc.fontSize(9).fillColor(gris).text(factura.descripcion, 60, y + 14, { width: 230 });
    doc.fontSize(10).fillColor('#374151').text(formatEuro(factura.precio_base), 300, conceptY);
    doc.text(formatEuro(factura.iva_eur), 400, conceptY);
    doc.text(formatEuro(factura.total), 480, conceptY);
    y += (factura.descripcion ? 28 : 20) + blockGap;
    doc.moveTo(60, y).lineTo(535, y).stroke();
    y += 18;
    doc.fontSize(10).fillColor('#374151');
    doc.text('Subtotal: ' + formatEuro(factura.precio_base), 400, y);
    y += lineHeight;
    doc.text(`IVA (${factura.iva_pct}%): ${formatEuro(factura.iva_eur)}`, 400, y);
    y += lineHeight;
    doc.fontSize(11).fillColor(blue).text('TOTAL: ' + formatEuro(factura.total), 400, y);
    y += blockGap + 10;
    if (factura.forma_pago) {
      doc.fontSize(9).fillColor('#374151').text('Forma de pago: ' + factura.forma_pago, 60, y);
      y += lineHeight + 8;
    }
    y += 12;
    doc.fontSize(9).fillColor(gris).text('Gracias por su confianza.', 60, y);
    y += lineHeight;
    doc.fontSize(8).fillColor('#9ca3af').text('Factura generada automáticamente por ' + (nombreNegocio || 'el emisor') + '.', 60, y);
    doc.end();
  });
  return Buffer.concat(chunks);
}

module.exports = {
  list,
  getById,
  create,
  remove,
  getNextNumeroFactura,
  generatePdfBuffer,
  formatEuro
};
