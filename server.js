const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const config = require('./config');

// Importar rutas
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');

// Inicializar Express
const app = express();

// Necesario en Railway/proxy: que Express confíe en HTTPS del cliente
app.set('trust proxy', 1);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configurar sesiones
app.use(session({
  secret: process.env.SESSION_SECRET || config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    sameSite: 'lax',
    httpOnly: true
  }
}));

// Servir archivos estáticos
app.use(express.static('public'));
app.use('/views', express.static('views'));

// Rutas
app.use('/', publicRoutes);
app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);

// Middleware para servir HTML desde views
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/setup', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'setup.html'));
});

app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'reset-password.html'));
});

app.get('/dashboard', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/feedback/:sessionId', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'feedback.html'));
});

// Migración: añadir client_phone a appointments si no existe (BD ya creadas)
const { runQuery } = require('./utils/db');
runQuery('ALTER TABLE appointments ADD COLUMN client_phone TEXT').catch(() => {});

// Migraciones multi-negocio (negocio, pacientes, citas, plantillas, textos legales)
const { runMigrations } = require('./database/run-migrations');
runMigrations().catch((err) => console.error('Error en migraciones:', err));

// Job diario de recordatorios (citas del día siguiente). Se ejecuta una vez al día a las 8:00 (hora local).
const { runReminders } = require('./lib/reminder-job');
let lastReminderDate = null;
setInterval(() => {
  const now = new Date();
  if (now.getHours() !== 8) return;
  const today = now.toISOString().slice(0, 10);
  if (lastReminderDate === today) return;
  lastReminderDate = today;
  runReminders()
    .then((r) => { if (r.sent > 0) console.log('📧 Recordatorios enviados:', r.sent); })
    .catch((e) => console.error('Error job recordatorios:', e.message));
}, 60 * 60 * 1000);

// ReputacionPro: procesar jobs de solicitud de reseña (cada minuto; envío 3h después de cita completada).
const { processDueJobs } = require('./lib/reputacion-pro/jobs');
setInterval(() => {
  processDueJobs()
    .then(() => {})
    .catch((e) => console.error('Error job ReputacionPro:', e.message));
}, 60 * 1000);

// Iniciar servidor
const PORT = process.env.PORT || config.port || 3000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n🚀 Servidor iniciado en puerto ${PORT}`);
  if (process.env.NODE_ENV === 'production') {
    try {
      const { allQuery } = require('./utils/db');
      const rows = await allQuery('SELECT COUNT(*) as c FROM users');
      const n = (rows[0] && rows[0].c) || 0;
      console.log('👥 Usuarios en BD:', n, n === 0 ? '(crea uno en /setup)' : '');
    } catch (e) {
      console.warn('No se pudo leer número de usuarios:', e.message);
    }
  }
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📋 Landing pública: http://localhost:${PORT}`);
    console.log(`🔐 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`\n⚠️  IMPORTANTE: Asegúrate de haber ejecutado:`);
    console.log(`   1. npm install`);
    console.log(`   2. node database/init.js`);
    console.log(`   3. node utils/create-user.js\n`);
  }
});

// Apagado graceful: al recibir SIGTERM/SIGINT (p. ej. Railway para el deploy anterior),
// dar unos segundos para que terminen escrituras a la BD y salir limpio.
const GRACEFUL_SHUTDOWN_MS = 5000;
function shutdown(signal) {
  console.log(`\n⚠️ ${signal} recibido. Cerrando en ${GRACEFUL_SHUTDOWN_MS / 1000}s para que la BD termine de escribir...`);
  setTimeout(() => {
    console.log('👋 Servidor cerrado.');
    process.exit(0);
  }, GRACEFUL_SHUTDOWN_MS);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
