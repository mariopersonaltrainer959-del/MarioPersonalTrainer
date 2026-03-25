const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { runQuery, getQuery, allQuery } = require('../utils/db');

// Subida de imágenes para la landing: guardar en BD (PostgreSQL/SQLite) para persistir en Railway
const uploadLanding = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpe?g|png|gif|webp)$/i.test(file.mimetype);
    cb(null, !!ok);
  }
});
const { getBusinessConfig, getOpeningHours, getAppointmentDuration, isTimeSlotAvailable } = require('../utils/helpers');
const { sendTestEmail } = require('../utils/email');
const { requireAuth } = require('../middleware/auth');
const pacientesService = require('../lib/pacientes');
const citasService = require('../lib/citas');
const negocioService = require('../lib/negocio');
const { getResumenMes } = require('../lib/stats');
const plantillasService = require('../lib/plantillas');
const facturasService = require('../lib/facturas');
const { sendTestEmailWithNegocio } = require('../lib/email-negocio');
const reputacionPro = require('../lib/reputacion-pro');
const googleCalendar = require('../lib/google-calendar');

// Textos legales RGPD de ejemplo (cuando no hay nada guardado)
const TEXTOS_LEGALES_EJEMPLO = {
  politica_privacidad: `POLÍTICA DE PRIVACIDAD (ejemplo RGPD)

Responsable del tratamiento: [Nombre del profesional/centro], con domicilio en [dirección] y contacto [email].

Finalidad: Gestión de citas, relación terapéutica o profesional y comunicaciones relativas al servicio.

Legitimación: Consentimiento del interesado y, en su caso, ejecución de contrato.

Datos que tratamos: nombre, apellidos, email, teléfono y cuantos datos facilite en el formulario de reserva o en sesión.

Conservación: Los datos se conservarán mientras exista relación y, tras ella, durante los plazos legales aplicables (incluida reclamación de responsabilidades).

Destinatarios: No se ceden datos a terceros salvo obligación legal.

Derechos: Puede ejercer sus derechos de acceso, rectificación, supresión, limitación, oposición y portabilidad dirigiendo un escrito a [email] o ante la Agencia Española de Protección de Datos (www.aepd.es).`,
  consentimiento: `Consiento el tratamiento de mis datos personales (nombre, email, teléfono y los que facilite) para la gestión de la cita y la relación terapéutica/profesional, de conformidad con la política de privacidad indicada.`,
  version: '1'
};

// Aplicar autenticación a todas las rutas del dashboard
router.use(requireAuth);

// Dashboard principal
router.get('/', (req, res) => {
  res.sendFile('dashboard.html', { root: './views' });
});

// Obtener todas las citas
router.get('/api/appointments', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = `SELECT * FROM appointments WHERE status = 'confirmed'`;
    const params = [];

    if (startDate && endDate) {
      query += ` AND appointment_date >= ? AND appointment_date <= ?`;
      const endOfDay = endDate.length === 10 ? endDate + 'T23:59:59.999Z' : endDate;
      params.push(startDate.length === 10 ? startDate + 'T00:00:00.000Z' : startDate, endOfDay);
    } else {
      // Por defecto, mostrar próximas 2 semanas
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 14);
      query += ` AND appointment_date >= ? AND appointment_date <= ?`;
      params.push(start.toISOString(), end.toISOString());
    }

    query += ` ORDER BY appointment_date ASC`;

    const appointments = await allQuery(query, params);
    res.json({ appointments });
  } catch (error) {
    console.error('Error obteniendo citas:', error);
    res.status(500).json({ error: 'Error obteniendo citas' });
  }
});

// Obtener una cita específica
router.get('/api/appointments/:id', async (req, res) => {
  try {
    const appointment = await getQuery('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
    if (!appointment) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    res.json({ appointment });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo cita' });
  }
});

// Cancelar una cita (marca como cancelada)
router.post('/api/appointments/:id/cancel', async (req, res) => {
  try {
    await runQuery(
      'UPDATE appointments SET status = ? WHERE id = ?',
      ['cancelled', req.params.id]
    );
    res.json({ success: true, message: 'Cita cancelada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error cancelando cita' });
  }
});

// Crear cita desde el panel (centralizado con reservas)
router.post('/api/appointments', async (req, res) => {
  try {
    const { client_name, client_email, client_phone, appointment_date, duration: bodyDuration } = req.body;

    if (!client_name || !client_email || !appointment_date) {
      return res.status(400).json({ error: 'Nombre, email y fecha/hora son obligatorios' });
    }

    const duration = bodyDuration ? parseInt(bodyDuration, 10) : await getAppointmentDuration();
    if (isNaN(duration) || duration < 5) {
      return res.status(400).json({ error: 'Duración no válida' });
    }

    const appointmentDateTime = new Date(appointment_date);
    if (isNaN(appointmentDateTime.getTime())) {
      return res.status(400).json({ error: 'Fecha y hora no válidas' });
    }

    const now = new Date();
    if (appointmentDateTime < now) {
      return res.status(400).json({ error: 'No se pueden crear citas en el pasado' });
    }

    const isAvailable = await isTimeSlotAvailable(appointmentDateTime.toISOString(), duration);
    if (!isAvailable) {
      return res.status(400).json({ error: 'Ese horario no está disponible (ocupado o bloqueado)' });
    }

    const result = await runQuery(
      `INSERT INTO appointments (client_name, client_email, client_phone, appointment_date, duration, status) 
       VALUES (?, ?, ?, ?, ?, 'confirmed')`,
      [client_name.trim(), client_email.trim(), (client_phone && typeof client_phone === 'string' ? client_phone.trim() : null), appointmentDateTime.toISOString(), duration]
    );

    res.status(201).json({
      success: true,
      message: 'Cita creada correctamente',
      appointmentId: result.lastID
    });
  } catch (error) {
    console.error('Error creando cita:', error);
    res.status(500).json({ error: 'Error creando cita' });
  }
});

// Eliminar cita permanentemente (solo tras doble verificación en el cliente)
router.delete('/api/appointments/:id', async (req, res) => {
  try {
    const appointment = await getQuery('SELECT id FROM appointments WHERE id = ?', [req.params.id]);
    if (!appointment) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    await runQuery('DELETE FROM appointments WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Cita eliminada correctamente' });
  } catch (error) {
    console.error('Error eliminando cita:', error);
    res.status(500).json({ error: 'Error eliminando cita' });
  }
});

// --- Multi-negocio: Pacientes (CRM) ---
router.get('/api/pacientes', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const lista = await pacientesService.list(negocioId, { estado: req.query.estado, busqueda: req.query.busqueda });
    res.json({ pacientes: lista });
  } catch (error) {
    console.error('Error listando pacientes:', error);
    res.status(500).json({ error: 'Error obteniendo pacientes' });
  }
});

router.get('/api/pacientes/:id', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const p = await pacientesService.getById(negocioId, req.params.id);
    if (!p) return res.status(404).json({ error: 'Paciente no encontrado' });
    const [citas, proximaCita, totalSesiones, facturacion] = await Promise.all([
      pacientesService.getCitas(negocioId, req.params.id),
      pacientesService.getProximaCita(negocioId, req.params.id),
      pacientesService.getTotalSesiones(negocioId, req.params.id),
      pacientesService.getFacturacionEstimada(negocioId, req.params.id)
    ]);
    res.json({
      paciente: p,
      citas,
      proximaCita,
      totalSesiones,
      facturacionEstimada: facturacion
    });
  } catch (error) {
    console.error('Error obteniendo paciente:', error);
    res.status(500).json({ error: 'Error obteniendo paciente' });
  }
});

router.post('/api/pacientes', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const { id } = await pacientesService.create(negocioId, req.body);
    res.status(201).json({ success: true, id });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Error creando paciente' });
  }
});

router.put('/api/pacientes/:id', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    await pacientesService.update(negocioId, req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Error actualizando paciente' });
  }
});

router.delete('/api/pacientes/:id', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const ok = await pacientesService.remove(negocioId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Paciente no encontrado' });
    res.json({ success: true });
  } catch (error) {
    const msg = error.message || 'Error eliminando paciente';
    if (msg.includes('tiene citas')) return res.status(400).json({ error: msg });
    console.error('Error eliminando paciente:', error);
    res.status(500).json({ error: 'Error eliminando paciente' });
  }
});

// --- Multi-negocio: Citas (nueva tabla) ---
router.get('/api/citas', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const citas = await citasService.list(negocioId, {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      pacienteId: req.query.pacienteId
    });
    res.json({ citas });
  } catch (error) {
    console.error('Error listando citas:', error);
    res.status(500).json({ error: 'Error obteniendo citas' });
  }
});

router.get('/api/citas/slots', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const fecha = req.query.fecha;
    if (!fecha) return res.status(400).json({ error: 'fecha requerida' });
    const duracion = parseInt(req.query.duracion, 10) || await negocioService.getDuracionCitaDefault(negocioId);
    const slots = await citasService.getSlotsDisponibles(negocioId, fecha, duracion);
    res.json({ slots });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo slots' });
  }
});

router.get('/api/citas/:id', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const cita = await citasService.getById(negocioId, req.params.id);
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
    res.json({ cita });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo cita' });
  }
});

router.post('/api/citas', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const { fecha, hora_inicio } = req.body;
    if (fecha && hora_inicio) {
      const duracion = await negocioService.getDuracionCitaDefault(negocioId);
      const slots = await citasService.getSlotsDisponibles(negocioId, fecha, duracion);
      const slotValido = slots.some(s => s.hora_inicio === String(hora_inicio).trim().slice(0, 5));
      if (!slotValido) {
        return res.status(400).json({ error: 'Este horario no está disponible. Elige otro hueco de la lista.' });
      }
    }
    const { id } = await citasService.create(negocioId, req.body);
    googleCalendar.syncNewCita(negocioId, id).catch((e) => console.error('[Google Calendar] syncNewCita:', e.message));
    res.status(201).json({ success: true, id });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Error creando cita' });
  }
});

router.put('/api/citas/:id', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const citaAntes = await citasService.getById(negocioId, req.params.id);
    const estadoAnterior = citaAntes && citaAntes.estado;
    await citasService.update(negocioId, req.params.id, req.body);
    if (req.body.estado === 'completada' && estadoAnterior !== 'completada') {
      reputacionPro.jobs.scheduleReviewJob(negocioId, req.params.id).catch((e) => console.error('[ReputacionPro] Error programando job:', e.message));
    }
    if (citaAntes && citaAntes.google_calendar_event_id) {
      const citaDespues = await citasService.getById(negocioId, req.params.id);
      if (citaDespues && req.body.estado !== 'cancelada') {
        googleCalendar.updateEvent(negocioId, citaAntes.google_calendar_event_id, {
          fecha: citaDespues.fecha,
          hora_inicio: citaDespues.hora_inicio,
          hora_fin: citaDespues.hora_fin,
          pacienteNombre: citaDespues.paciente_nombre
        }).catch((e) => console.error('[Google Calendar] updateEvent:', e.message));
      } else if (req.body.estado === 'cancelada') {
        googleCalendar.deleteEvent(negocioId, citaAntes.google_calendar_event_id).catch((e) => console.error('[Google Calendar] deleteEvent:', e.message));
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Error actualizando cita' });
  }
});

router.post('/api/citas/:id/cancel', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const cita = await citasService.getById(negocioId, req.params.id);
    const ok = await citasService.cancel(negocioId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Cita no encontrada' });
    if (cita && cita.google_calendar_event_id) {
      googleCalendar.deleteEvent(negocioId, cita.google_calendar_event_id).catch((e) => console.error('[Google Calendar] deleteEvent:', e.message));
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error cancelando cita' });
  }
});

router.delete('/api/citas/:id', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const cita = await citasService.getById(negocioId, req.params.id);
    const ok = await citasService.remove(negocioId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Cita no encontrada' });
    if (cita && cita.google_calendar_event_id) {
      googleCalendar.deleteEvent(negocioId, cita.google_calendar_event_id).catch((e) => console.error('[Google Calendar] deleteEvent:', e.message));
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando cita' });
  }
});

// --- Estadísticas dashboard ---
router.get('/api/stats', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const resumen = await getResumenMes(negocioId);
    res.json(resumen);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

// --- Negocio (config) ---
router.get('/api/negocio', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const negocio = await negocioService.getById(negocioId);
    if (!negocio) return res.status(404).json({ error: 'Negocio no encontrado' });
    const openingHours = await getOpeningHours(negocioId);
    res.json({ ...negocio, openingHours });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo negocio' });
  }
});

router.post('/api/negocio', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    await negocioService.update(negocioId, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Error actualizando negocio' });
  }
});

// Plantillas de email
router.get('/api/plantillas', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const list = await plantillasService.list(negocioId);
    res.json({ plantillas: list });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo plantillas' });
  }
});

router.get('/api/plantillas/:nombre', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const p = await plantillasService.getByName(negocioId, req.params.nombre);
    if (!p) return res.status(404).json({ error: 'Plantilla no encontrada' });
    res.json({ plantilla: p });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo plantilla' });
  }
});

router.post('/api/plantillas', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const { nombre, asunto, cuerpo } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre de plantilla requerido' });
    const { id } = await plantillasService.upsert(negocioId, nombre, asunto || '', cuerpo || '');
    res.json({ success: true, id });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Error guardando plantilla' });
  }
});

// Textos legales (RGPD)
router.get('/api/textos-legales', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const row = await getQuery('SELECT * FROM textos_legales WHERE negocio_id = ?', [negocioId]);
    const vacio = (t) => t == null || String(t).trim() === '';
    if (!row || (vacio(row.politica_privacidad) && vacio(row.consentimiento))) {
      return res.json({ ...TEXTOS_LEGALES_EJEMPLO, ...(row && { id: row.id }) });
    }
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo textos legales' });
  }
});

router.post('/api/textos-legales', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const { politica_privacidad, consentimiento, version } = req.body;
    const pol = politica_privacidad || '';
    const cons = consentimiento || '';
    const ver = version || '1';
    const existing = await getQuery('SELECT id FROM textos_legales WHERE negocio_id = ?', [negocioId]);
    if (existing) {
      await runQuery(
        'UPDATE textos_legales SET politica_privacidad = ?, consentimiento = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE negocio_id = ?',
        [pol, cons, ver, negocioId]
      );
    } else {
      await runQuery(
        'INSERT INTO textos_legales (negocio_id, politica_privacidad, consentimiento, version) VALUES (?, ?, ?, ?)',
        [negocioId, pol, cons, ver]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error guardando textos legales' });
  }
});

// Landing page (contenido editable de la web pública)
router.get('/api/landing', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const row = await getQuery('SELECT content FROM landing_page WHERE negocio_id = ?', [negocioId]);
    if (!row || !row.content) {
      return res.json({
        hero_title: '',
        hero_subtitle: '',
        hero_image_url: '',
        about_title: '',
        about_text: '',
        about_image_url: '',
        cta_text: 'Reservar cita',
        sections: []
      });
    }
    const content = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
    res.json(content);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo landing' });
  }
});

router.post('/api/landing', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const content = req.body;
    const contentStr = JSON.stringify({
      hero_title: content.hero_title || '',
      hero_subtitle: content.hero_subtitle || '',
      hero_image_url: content.hero_image_url || '',
      about_title: content.about_title || '',
      about_text: content.about_text || '',
      about_image_url: content.about_image_url || '',
      cta_text: content.cta_text || 'Reservar cita',
      sections: Array.isArray(content.sections) ? content.sections : []
    });
    const existing = await getQuery('SELECT negocio_id FROM landing_page WHERE negocio_id = ?', [negocioId]);
    if (existing) {
      await runQuery('UPDATE landing_page SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE negocio_id = ?', [contentStr, negocioId]);
    } else {
      await runQuery('INSERT INTO landing_page (negocio_id, content) VALUES (?, ?)', [negocioId, contentStr]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error guardando landing' });
  }
});

// Subir imagen para la landing (hero o about). Guarda en BD y devuelve URL /api/landing-image/:id
router.post('/api/upload-landing-image', uploadLanding.single('image'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No se envió ninguna imagen. Usa un archivo JPG, PNG, GIF o WebP (máx. 5 MB).' });
    }
    const negocioId = req.negocioId || 1;
    const ext = (path.extname(req.file.originalname) || '').toLowerCase() || '.jpg';
    const safe = /^\.(jpe?g|png|gif|webp)$/i.test(ext) ? ext : '.jpg';
    const filename = `landing-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safe}`;
    const mimetype = req.file.mimetype || 'image/jpeg';
    const result = await runQuery(
      'INSERT INTO landing_images (negocio_id, filename, mimetype, data) VALUES (?, ?, ?, ?)',
      [negocioId, filename, mimetype, req.file.buffer]
    );
    const id = result.lastID;
    if (!id) return res.status(500).json({ error: 'Error guardando la imagen en la base de datos' });
    res.json({ url: '/api/landing-image/' + id });
  } catch (error) {
    console.error('Error subiendo imagen landing:', error);
    res.status(500).json({ error: 'Error subiendo la imagen' });
  }
});

// Obtener configuración del negocio
router.get('/api/config', async (req, res) => {
  try {
    const config = await getBusinessConfig();
    const negocioId = req.negocioId || 1;
    const openingHours = await getOpeningHours(negocioId);
    const duration = await getAppointmentDuration();
    
    res.json({
      ...config,
      openingHours,
      appointmentDuration: duration
    });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo configuración' });
  }
});

// Actualizar configuración del negocio
router.post('/api/config', async (req, res) => {
  try {
    const { businessName, businessPhone, businessEmail, appointmentDuration } = req.body;

    const updates = [];
    if (businessName) updates.push(['businessName', businessName]);
    if (businessPhone) updates.push(['businessPhone', businessPhone]);
    if (businessEmail) updates.push(['businessEmail', businessEmail]);
    if (appointmentDuration) updates.push(['appointmentDuration', appointmentDuration.toString()]);

    for (const [key, value] of updates) {
      await runQuery(
        `INSERT INTO business_config (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
        [key, value, value]
      );
    }

    res.json({ success: true, message: 'Configuración actualizada correctamente' });
  } catch (error) {
    console.error('Error actualizando configuración:', error);
    res.status(500).json({ error: 'Error actualizando configuración' });
  }
});

// Obtener horarios de apertura
router.get('/api/opening-hours', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const hours = await getOpeningHours(negocioId);
    res.json({ openingHours: hours });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo horarios' });
  }
});

// Actualizar horarios de apertura
router.post('/api/opening-hours', async (req, res) => {
  try {
    const { openingHours } = req.body;
    const negocioId = req.negocioId || 1;

    // Eliminar horarios existentes de este negocio (si tiene columna negocio_id)
    try {
      await runQuery('DELETE FROM opening_hours WHERE negocio_id = ?', [negocioId]);
    } catch (_) {
      await runQuery('DELETE FROM opening_hours');
    }

    // Insertar nuevos horarios
    for (const [day, ranges] of Object.entries(openingHours)) {
      if (Array.isArray(ranges) && ranges.length > 0) {
        for (const range of ranges) {
          if (Array.isArray(range) && range.length === 2) {
            try {
              await runQuery(
                'INSERT INTO opening_hours (negocio_id, day_of_week, start_hour, end_hour) VALUES (?, ?, ?, ?)',
                [negocioId, parseInt(day), range[0], range[1]]
              );
            } catch (e) {
              await runQuery(
                'INSERT INTO opening_hours (day_of_week, start_hour, end_hour) VALUES (?, ?, ?)',
                [parseInt(day), range[0], range[1]]
              );
            }
          }
        }
      }
    }

    res.json({ success: true, message: 'Horarios actualizados correctamente' });
  } catch (error) {
    console.error('Error actualizando horarios:', error);
    res.status(500).json({ error: 'Error actualizando horarios' });
  }
});

// Obtener slots bloqueados
router.get('/api/blocked-slots', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const negocioId = req.negocioId || 1;
    let query = 'SELECT * FROM blocked_slots WHERE negocio_id = ?';
    const params = [negocioId];
    if (startDate && endDate) {
      query += ' AND start_time >= ? AND end_time <= ?';
      params.push(startDate, endDate);
    }
    query += ' ORDER BY start_time ASC';
    const slots = await allQuery(query, params).catch(() => allQuery('SELECT * FROM blocked_slots ORDER BY start_time ASC'));
    res.json({ blockedSlots: slots });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo slots bloqueados' });
  }
});

// Crear slot bloqueado
router.post('/api/blocked-slots', async (req, res) => {
  try {
    const { startTime, endTime, reason } = req.body;
    const negocioId = req.negocioId || 1;
    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'Fecha de inicio y fin requeridas' });
    }
    try {
      await runQuery(
        'INSERT INTO blocked_slots (negocio_id, start_time, end_time, reason) VALUES (?, ?, ?, ?)',
        [negocioId, startTime, endTime, reason || null]
      );
    } catch (e) {
      await runQuery(
        'INSERT INTO blocked_slots (start_time, end_time, reason) VALUES (?, ?, ?)',
        [startTime, endTime, reason || null]
      );
    }
    res.json({ success: true, message: 'Horario bloqueado correctamente' });
  } catch (error) {
    console.error('Error bloqueando slot:', error);
    res.status(500).json({ error: 'Error bloqueando horario' });
  }
});

// Eliminar slot bloqueado
router.delete('/api/blocked-slots/:id', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    try {
      await runQuery('DELETE FROM blocked_slots WHERE id = ? AND negocio_id = ?', [req.params.id, negocioId]);
    } catch (_) {
      await runQuery('DELETE FROM blocked_slots WHERE id = ?', [req.params.id]);
    }
    res.json({ success: true, message: 'Bloqueo eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando bloqueo' });
  }
});

// --- Facturas ---
router.get('/api/facturas', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const facturas = await facturasService.list(negocioId);
    res.json({ facturas });
  } catch (error) {
    console.error('Error listando facturas:', error);
    res.status(500).json({ error: 'Error obteniendo facturas' });
  }
});

router.post('/api/facturas', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const result = await facturasService.create(negocioId, req.body);
    res.json({ success: true, id: result.id, numero_factura: result.numero_factura });
  } catch (error) {
    console.error('Error creando factura:', error);
    res.status(400).json({ error: error.message || 'Error creando factura' });
  }
});

router.get('/api/facturas/:id/pdf', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const buffer = await facturasService.generatePdfBuffer(negocioId, req.params.id);
    if (!buffer) return res.status(404).send('Factura no encontrada');
    const factura = await facturasService.getById(negocioId, req.params.id);
    const filename = `factura-${(factura && factura.numero_factura) || req.params.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error generando PDF factura:', error);
    res.status(500).send('Error generando PDF');
  }
});

router.delete('/api/facturas/:id', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const ok = await facturasService.remove(negocioId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando factura:', error);
    res.status(500).json({ error: 'Error eliminando factura' });
  }
});

// Crear nuevo usuario (solo desde dashboard autenticado)
router.post('/api/users', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Verificar si el email ya existe
    const existingUser = await getQuery('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Este email ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const negocioId = req.negocioId != null ? req.negocioId : 1;
    try {
      await runQuery(
        'INSERT INTO users (email, password, name, negocio_id) VALUES (?, ?, ?, ?)',
        [email, hashedPassword, name, negocioId]
      );
    } catch (e) {
      await runQuery(
        'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
        [email, hashedPassword, name]
      );
    }

    res.json({ success: true, message: 'Usuario creado correctamente' });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ error: 'Error creando usuario' });
  }
});

// Obtener usuarios
router.get('/api/users', async (req, res) => {
  try {
    const users = await allQuery('SELECT id, email, name, created_at FROM users ORDER BY created_at DESC');
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo usuarios' });
  }
});

// Enviar email de prueba (SMTP del negocio o Resend/env)
router.post('/api/test-email', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const negocio = await negocioService.getById(negocioId);
    const to = (negocio?.email || (await getBusinessConfig()).businessEmail || '').trim();
    if (!to) {
      return res.status(400).json({ error: 'Guarda el Email del negocio y pulsa «Guardar» antes de enviar la prueba.' });
    }
    const useNegocioSmtp = negocio?.smtp_host && negocio?.smtp_user && negocio?.smtp_password;
    if (useNegocioSmtp) {
      await sendTestEmailWithNegocio(negocio, to);
    } else {
      const useResend = !!process.env.RESEND_API_KEY;
      if (!useResend && (!process.env.SMTP_USER || !process.env.SMTP_PASS)) {
        return res.status(400).json({
          error: 'Configura SMTP en la sección de abajo (Host, Usuario, Contraseña) o usa Resend/SMTP en variables de entorno.'
        });
      }
      await sendTestEmail(to);
    }
    res.json({ success: true, message: `Email de prueba enviado a ${to}. Revisa la bandeja (y spam).` });
  } catch (error) {
    const msg = error.message || error.response || (error.responseCode ? `Código ${error.responseCode}` : '') || '';
    const isTimeout = /timeout|ETIMEDOUT|ECONNRESET|socket hang up/i.test(String(msg));
    let detail = msg ? `: ${msg}` : '';
    if (!process.env.RESEND_API_KEY && isTimeout) {
      detail += ' En Railway plan Hobby el SMTP está bloqueado (puertos 465/587). Usa Resend (API) o pásate a Railway Pro. Ver ZOHO_MAIL_RAILWAY.md.';
    } else if (!process.env.RESEND_API_KEY) {
      detail += detail ? '. Revisa SMTP_* y EMAIL_FROM en Railway.' : ' Revisa SMTP_* y EMAIL_FROM en Railway.';
    } else {
      detail += detail ? '. Revisa RESEND_API_KEY y EMAIL_FROM.' : ' Revisa RESEND_API_KEY y EMAIL_FROM en Railway.';
    }
    console.error('Error en test-email', detail, error);
    res.status(500).json({ error: `No se pudo enviar${detail}` });
  }
});

// --- Google Calendar: OAuth y sincronización ---
router.get('/api/google-calendar/auth-url', (req, res) => {
  const negocioId = req.negocioId || 1;
  const baseUrl = googleCalendar.getBaseUrl(req);
  const redirectUri = `${baseUrl.replace(/\/$/, '')}/dashboard/api/google-calendar/callback`;
  const url = googleCalendar.getAuthUrl(negocioId, redirectUri);
  if (!url) return res.status(503).json({ error: 'Google Calendar no configurado. Añade GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el servidor.' });
  res.json({ url });
});

router.get('/api/google-calendar/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const baseUrl = googleCalendar.getBaseUrl(req);
  const redirectUri = `${baseUrl.replace(/\/$/, '')}/dashboard/api/google-calendar/callback`;
  if (error) {
    return res.redirect('/dashboard?google_calendar=error&message=' + encodeURIComponent(error === 'access_denied' ? 'Has cancelado la autorización' : error));
  }
  const negocioId = state ? parseInt(state, 10) : (req.negocioId || 1);
  try {
    await googleCalendar.exchangeCodeForTokens(negocioId, code, redirectUri);
    res.redirect('/dashboard?google_calendar=ok');
  } catch (err) {
    res.redirect('/dashboard?google_calendar=error&message=' + encodeURIComponent(err.message || 'Error al conectar'));
  }
});

router.get('/api/google-calendar/status', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const connected = await googleCalendar.isConnected(negocioId);
    const syncBusy = await googleCalendar.isSyncBusyEnabled(negocioId);
    res.json({ connected, syncBusy });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/google-calendar/disconnect', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    await googleCalendar.disconnect(negocioId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/google-calendar/sync-busy', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const enabled = !!req.body.enabled;
    await googleCalendar.setSyncBusy(negocioId, enabled);
    res.json({ success: true, syncBusy: enabled });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- ReputacionPro: configuración y estadísticas ---
router.get('/api/reputacion-pro', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const config = await reputacionPro.config.getConfig(negocioId);
    res.json(config);
  } catch (error) {
    console.error('Error obteniendo config ReputacionPro:', error);
    res.status(500).json({ error: 'Error obteniendo configuración' });
  }
});

router.post('/api/reputacion-pro', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    await reputacionPro.config.saveConfig(negocioId, { googleReviewUrl: req.body.googleReviewUrl });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Error guardando configuración' });
  }
});

router.get('/api/reputacion-pro/stats', async (req, res) => {
  try {
    const negocioId = req.negocioId || 1;
    const stats = await reputacionPro.stats.getStats(negocioId);
    res.json(stats);
  } catch (error) {
    console.error('Error obteniendo stats ReputacionPro:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

// Cerrar sesión
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error cerrando sesión' });
    }
    res.json({ success: true });
  });
});

module.exports = router;
