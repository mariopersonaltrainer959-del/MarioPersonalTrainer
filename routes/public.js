const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { runQuery, allQuery, getQuery } = require('../utils/db');
const { getBusinessConfig, getAvailableTimeSlots, getAppointmentDuration } = require('../utils/helpers');
const { sendConfirmationEmail, sendNotificationToPsychologist } = require('../utils/email');
const pacientesService = require('../lib/pacientes');
const citasService = require('../lib/citas');
const negocioService = require('../lib/negocio');
const reputacionPro = require('../lib/reputacion-pro');

const NEGOCIO_ID = 1;

// Servir imagen de la landing desde la BD (persistente en Railway)
router.get('/api/landing-image/:id', async (req, res) => {
  try {
    const row = await getQuery('SELECT mimetype, data FROM landing_images WHERE id = ?', [req.params.id]);
    if (!row || !row.data) return res.status(404).send('Imagen no encontrada');
    res.set('Content-Type', row.mimetype || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data));
  } catch (error) {
    console.error('Error sirviendo imagen landing:', error);
    res.status(500).send('Error');
  }
});

// Landing pública (página editable + reserva)
router.get('/', async (req, res) => {
  res.sendFile('landing.html', { root: './views' });
});

// Contenido de la landing (hero, bloques, CTA) para la web pública
router.get('/api/landing', async (req, res) => {
  try {
    const row = await getQuery('SELECT content FROM landing_page WHERE negocio_id = ?', [NEGOCIO_ID]);
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
    console.error('Error obteniendo landing:', error);
    res.json({
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
});

// Obtener configuración pública (para el frontend)
router.get('/api/config', async (req, res) => {
  try {
    const config = await getBusinessConfig();
    res.json({
      businessName: config.businessName,
      businessPhone: config.businessPhone,
      businessEmail: config.businessEmail
    });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo configuración' });
  }
});

// Textos legales públicos (para checkbox RGPD en landing)
router.get('/api/textos-legales', async (req, res) => {
  try {
    const { getQuery } = require('../utils/db');
    const row = await getQuery('SELECT politica_privacidad, consentimiento, version FROM textos_legales WHERE negocio_id = 1');
    res.json(row || { politica_privacidad: '', consentimiento: '', version: '1' });
  } catch (error) {
    res.json({ politica_privacidad: '', consentimiento: '', version: '1' });
  }
});

// Obtener horas disponibles para una fecha (usa tabla citas + horarios del negocio)
router.get('/api/available-slots', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Fecha requerida' });
    }
    const duration = await negocioService.getDuracionCitaDefault(NEGOCIO_ID);
    const slots = await citasService.getSlotsDisponibles(NEGOCIO_ID, date, duration);
    res.json({
      slots: slots.map(s => ({
        time: s.hora_inicio,
        display: (s.display || s.hora_inicio).slice(0, 5)
      }))
    });
  } catch (error) {
    console.error('Error obteniendo slots:', error);
    res.status(500).json({ error: 'Error obteniendo horas disponibles' });
  }
});

// Crear nueva reserva (paciente + cita + consentimiento RGPD). Solo citas reales: validación estricta.
router.post('/api/book', async (req, res) => {
  try {
    const { name, email, date, time, telefono, acepta_legal } = req.body;

    const nombre = (name && typeof name === 'string') ? name.trim() : '';
    const emailTrim = (email && typeof email === 'string') ? email.trim().toLowerCase() : '';

    if (!nombre || nombre.length < 2) {
      return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres.' });
    }
    if (nombre.length > 120) {
      return res.status(400).json({ error: 'Nombre demasiado largo.' });
    }
    if (!emailTrim) {
      return res.status(400).json({ error: 'El email es obligatorio.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrim)) {
      return res.status(400).json({ error: 'Email inválido.' });
    }
    if (!date || !time) {
      return res.status(400).json({ error: 'Fecha y hora son obligatorias.' });
    }
    if (!acepta_legal) {
      return res.status(400).json({ error: 'Debes aceptar la política de privacidad y el consentimiento para reservar.' });
    }

    const [hours, minutes] = String(time).split(':');
    if (!hours || !minutes) {
      return res.status(400).json({ error: 'Formato de hora inválido' });
    }
    const hora_inicio = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    const duration = await negocioService.getDuracionCitaDefault(NEGOCIO_ID);
    const [h, m] = hora_inicio.split(':').map(Number);
    const endMin = h * 60 + m + duration;
    const hora_fin = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

    // Validar que el hueco sigue disponible (solo se pueden reservar slots que devuelve getSlotsDisponibles)
    const slotsDisponibles = await citasService.getSlotsDisponibles(NEGOCIO_ID, date, duration);
    const slotValido = slotsDisponibles.some(s => s.hora_inicio === hora_inicio);
    if (!slotValido) {
      return res.status(400).json({ error: 'Este horario no está disponible. Elige otra fecha u hora.' });
    }

    const paciente = await pacientesService.getOrCreateByEmail(NEGOCIO_ID, {
      nombre: nombre,
      email: emailTrim,
      telefono: (telefono && String(telefono).trim()) ? String(telefono).trim() : null
    });

    let citaId;
    try {
      const { id } = await citasService.create(NEGOCIO_ID, {
        paciente_id: paciente.id,
        fecha: date,
        hora_inicio,
        hora_fin,
        estado: 'confirmada'
      });
      citaId = id;
      const versionTexto = (await getQuery('SELECT version FROM textos_legales WHERE negocio_id = ?', [NEGOCIO_ID]))?.version || '1';
      const ip = req.ip || req.connection?.remoteAddress || null;
      await runQuery(
        'INSERT INTO consentimientos (paciente_id, fecha, ip, version_texto) VALUES (?, ?, ?, ?)',
        [paciente.id, new Date().toISOString(), ip, versionTexto]
      );
    } catch (err) {
      if (err.message && err.message.includes('solapa')) {
        return res.status(400).json({ error: 'Este horario ya no está disponible' });
      }
      throw err;
    }

    if (citaId) {
      try {
        const googleCalendar = require('../lib/google-calendar');
        await googleCalendar.syncNewCita(NEGOCIO_ID, citaId);
      } catch (e) {
        console.error('[Google Calendar] syncNewCita:', e.message);
      }
    }

    const appointment = {
      id: null,
      client_name: paciente.nombre,
      client_email: paciente.email,
      appointment_date: `${date}T${hora_inicio}:00`,
      duration
    };
    let emailSent = false;
    try {
      await sendConfirmationEmail(appointment);
      emailSent = true;
    } catch (err) {
      console.error('Error enviando confirmación:', err.message);
    }
    try {
      await sendNotificationToPsychologist(appointment);
    } catch (err) {
      console.error('Error notificación psicólogo:', err.message);
    }

    res.json({
      success: true,
      message: emailSent
        ? 'Cita reservada correctamente. Revisa tu email para la confirmación.'
        : 'Cita reservada correctamente. Si no recibes el email, revisa spam o contacta al negocio.',
      emailSent
    });
  } catch (error) {
    console.error('Error creando reserva:', error);
    res.status(500).json({ error: 'Error al reservar la cita' });
  }
});

// ⚠️ ENDPOINT TEMPORAL: Crear primer usuario (solo si no hay usuarios)
// Este endpoint solo funciona si la base de datos está vacía de usuarios
// Útil para crear el primer usuario desde el navegador (Railway, etc.)
router.post('/api/setup/first-user', async (req, res) => {
  try {
    // Verificar si ya hay usuarios
    const existingUsers = await allQuery('SELECT COUNT(*) as count FROM users');
    const userCount = existingUsers[0]?.count || 0;

    if (userCount > 0) {
      return res.status(403).json({ 
        error: 'Ya existen usuarios en el sistema. Usa el dashboard para crear más usuarios.' 
      });
    }

    const { email, password, name } = req.body;

    // Validaciones
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, contraseña y nombre son requeridos' });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Verificar si el email ya existe (por si acaso)
    const existingUser = await getQuery('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Este email ya está registrado' });
    }

    // Hash de la contraseña y crear usuario (negocio_id=1 para que vea las citas de la landing)
    const hashedPassword = await bcrypt.hash(password, 10);
    await runQuery(
      'INSERT INTO users (email, password, name, negocio_id) VALUES (?, ?, ?, 1)',
      [email, hashedPassword, name]
    );
    // Comprobar que quedó guardado (y forzar flush con otra lectura)
    const check = await allQuery('SELECT COUNT(*) as c FROM users');
    if (process.env.NODE_ENV === 'production') {
      console.log('✅ Primer usuario creado desde /setup. Usuarios en BD ahora:', (check[0] && check[0].c) || 0);
    }

    res.json({
      success: true,
      message: 'Primer usuario creado correctamente. Ahora puedes iniciar sesión en /dashboard',
      user: { email, name }
    });
  } catch (error) {
    console.error('Error creando primer usuario:', error);
    res.status(500).json({ error: 'Error creando usuario' });
  }
});

// Listar emails de usuarios (solo para comprobar; requiere RESET_PASSWORD_SECRET)
router.get('/api/check-users', (req, res) => {
  const secret = process.env.RESET_PASSWORD_SECRET;
  if (!secret || req.query.secret !== secret) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  allQuery('SELECT id, email, name, created_at FROM users ORDER BY id')
    .then(users => res.json({ users }))
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'Error leyendo usuarios' });
    });
});

// Restablecer contraseña (solo si RESET_PASSWORD_SECRET está definido en Railway)
// Uso: pon RESET_PASSWORD_SECRET en Variables de Railway, llama a este endpoint, luego quita la variable
router.post('/api/reset-password', async (req, res) => {
  const secret = process.env.RESET_PASSWORD_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'Restablecimiento de contraseña no configurado' });
  }
  try {
    const { email, newPassword, secret: bodySecret } = req.body;
    if (bodySecret !== secret) {
      return res.status(403).json({ error: 'Clave incorrecta' });
    }
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email y nueva contraseña son requeridos' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const user = await getQuery('SELECT id FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(404).json({ error: 'No existe ningún usuario con ese email' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await runQuery('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
    res.json({ success: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('Error restableciendo contraseña:', error);
    res.status(500).json({ error: 'Error al restablecer contraseña' });
  }
});

// --- ReputacionPro: feedback público (valoración tras cita) ---
router.get('/api/feedback/:sessionId', async (req, res) => {
  try {
    const session = await reputacionPro.feedback.getSessionForFeedback(req.params.sessionId);
    if (!session.valid) return res.status(404).json({ error: 'Sesión no encontrada' });
    const already = await reputacionPro.feedback.hasExistingFeedback(req.params.sessionId);
    res.json({ valid: true, googleReviewUrl: session.googleReviewUrl || null, alreadySubmitted: already });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/api/feedback/:sessionId', async (req, res) => {
  try {
    const session = await reputacionPro.feedback.getSessionForFeedback(req.params.sessionId);
    if (!session.valid || !session.negocioId) return res.status(404).json({ error: 'Sesión no encontrada' });
    const { rating, comentario } = req.body;
    const r = parseInt(rating, 10);
    if (!r || r < 1 || r > 5) return res.status(400).json({ error: 'Valoración no válida' });
    await reputacionPro.feedback.submitRating(session.negocioId, req.params.sessionId, r, comentario ? String(comentario).trim() : null);
    res.json({ success: true });
  } catch (error) {
    if (error.message && error.message.includes('Ya has enviado')) return res.status(409).json({ error: error.message });
    res.status(400).json({ error: error.message || 'Error' });
  }
});

router.get('/feedback/:sessionId/dejar-resena-google', async (req, res) => {
  try {
    const session = await reputacionPro.feedback.getSessionForFeedback(req.params.sessionId);
    if (!session.valid || !session.negocioId) return res.status(404).send('Sesión no encontrada');
    if (!session.googleReviewUrl) return res.status(400).send('Enlace de Google no configurado');
    await reputacionPro.feedback.recordRedirectToGoogle(session.negocioId, req.params.sessionId);
    res.redirect(302, session.googleReviewUrl);
  } catch (error) {
    res.status(500).send('Error');
  }
});

module.exports = router;
