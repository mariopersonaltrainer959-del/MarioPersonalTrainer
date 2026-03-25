/**
 * Inicialización de la base de datos PostgreSQL (Railway).
 * Se ejecuta cuando existe DATABASE_URL. Crea todas las tablas y datos iniciales.
 */
const { runQuery, getQuery, allQuery } = require('../utils/db');
const config = require('../config');

async function initPostgres() {
  // Tablas base (mismo orden que init.js + run-migrations)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      negocio_id INTEGER DEFAULT 1
    )
  `);
  await runQuery(`
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      client_name TEXT NOT NULL,
      client_email TEXT NOT NULL,
      client_phone TEXT,
      appointment_date TIMESTAMP NOT NULL,
      duration INTEGER NOT NULL DEFAULT 50,
      status TEXT DEFAULT 'confirmed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(appointment_date)
    )
  `);
  await runQuery(`
    CREATE TABLE IF NOT EXISTS business_config (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await runQuery(`
    CREATE TABLE IF NOT EXISTS blocked_slots (
      id SERIAL PRIMARY KEY,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP NOT NULL,
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      negocio_id INTEGER DEFAULT 1
    )
  `);
  await runQuery(`
    CREATE TABLE IF NOT EXISTS opening_hours (
      id SERIAL PRIMARY KEY,
      day_of_week INTEGER NOT NULL,
      start_hour INTEGER NOT NULL,
      end_hour INTEGER NOT NULL,
      negocio_id INTEGER DEFAULT 1,
      UNIQUE(day_of_week, start_hour, end_hour)
    )
  `);
  await runQuery(`
    CREATE TABLE IF NOT EXISTS negocio (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      telefono TEXT,
      email TEXT,
      direccion TEXT,
      nif TEXT,
      duracion_cita_default INTEGER NOT NULL DEFAULT 50,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      smtp_host TEXT,
      smtp_port INTEGER,
      smtp_user TEXT,
      smtp_password TEXT,
      email_remitente TEXT,
      nombre_remitente TEXT
    )
  `);
  await runQuery(`
    CREATE TABLE IF NOT EXISTS pacientes (
      id SERIAL PRIMARY KEY,
      negocio_id INTEGER NOT NULL REFERENCES negocio(id),
      nombre TEXT NOT NULL,
      email TEXT NOT NULL,
      telefono TEXT,
      fecha_nacimiento DATE,
      tipo_sesion_habitual TEXT CHECK(tipo_sesion_habitual IN ('online', 'presencial')),
      estado TEXT NOT NULL DEFAULT 'activo' CHECK(estado IN ('activo', 'en_proceso', 'alta_terapeutica', 'inactivo')),
      motivo_consulta TEXT,
      notas_privadas TEXT,
      precio_sesion REAL,
      metodo_pago TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await runQuery(`
    CREATE TABLE IF NOT EXISTS citas (
      id SERIAL PRIMARY KEY,
      negocio_id INTEGER NOT NULL REFERENCES negocio(id),
      paciente_id INTEGER NOT NULL REFERENCES pacientes(id),
      fecha DATE NOT NULL,
      hora_inicio TEXT NOT NULL,
      hora_fin TEXT NOT NULL,
      tipo_sesion TEXT CHECK(tipo_sesion IN ('online', 'presencial')),
      estado TEXT NOT NULL DEFAULT 'confirmada' CHECK(estado IN ('confirmada', 'pendiente', 'cancelada', 'pasada', 'no_asistio')),
      notas TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await runQuery(`
    CREATE TABLE IF NOT EXISTS plantillas_email (
      id SERIAL PRIMARY KEY,
      negocio_id INTEGER NOT NULL REFERENCES negocio(id),
      nombre TEXT NOT NULL,
      asunto TEXT NOT NULL,
      cuerpo TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(negocio_id, nombre)
    )
  `);
  await runQuery(`
    CREATE TABLE IF NOT EXISTS textos_legales (
      id SERIAL PRIMARY KEY,
      negocio_id INTEGER NOT NULL UNIQUE REFERENCES negocio(id),
      politica_privacidad TEXT,
      consentimiento TEXT,
      version TEXT DEFAULT '1',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await runQuery(`
    CREATE TABLE IF NOT EXISTS landing_page (
      negocio_id INTEGER NOT NULL PRIMARY KEY REFERENCES negocio(id),
      content TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await runQuery(`
    CREATE TABLE IF NOT EXISTS facturas (
      id SERIAL PRIMARY KEY,
      negocio_id INTEGER NOT NULL REFERENCES negocio(id),
      numero_factura TEXT NOT NULL,
      fecha_emision DATE NOT NULL,
      cliente_nombre TEXT NOT NULL,
      cliente_nif TEXT,
      cliente_direccion TEXT,
      cliente_cp TEXT,
      cliente_ciudad TEXT,
      cliente_provincia TEXT,
      concepto TEXT NOT NULL,
      descripcion TEXT,
      precio_base REAL NOT NULL,
      iva_pct REAL NOT NULL DEFAULT 21,
      iva_eur REAL NOT NULL,
      total REAL NOT NULL,
      forma_pago TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await runQuery(`
    CREATE TABLE IF NOT EXISTS landing_images (
      id SERIAL PRIMARY KEY,
      negocio_id INTEGER NOT NULL REFERENCES negocio(id),
      filename TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      data BYTEA NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await runQuery(`
    CREATE TABLE IF NOT EXISTS consentimientos (
      id SERIAL PRIMARY KEY,
      paciente_id INTEGER NOT NULL REFERENCES pacientes(id),
      fecha TIMESTAMP NOT NULL,
      ip TEXT,
      version_texto TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Negocio por defecto (id=1) para que landing y dashboard usen el mismo negocio
  const negocioExists = await getQuery('SELECT id FROM negocio WHERE id = 1');
  if (!negocioExists) {
    await runQuery(
      `INSERT INTO negocio (id, nombre, telefono, email, direccion, duracion_cita_default) VALUES (1, ?, ?, ?, ?, ?)`,
      [
        config.businessName || 'Mi Negocio',
        config.businessPhone || '',
        config.businessEmail || '',
        '',
        parseInt(config.appointmentDuration || '50', 10)
      ]
    );
    await runQuery("SELECT setval(pg_get_serial_sequence('negocio', 'id'), (SELECT COALESCE(MAX(id), 1) FROM negocio))").catch(() => {});
    console.log('✅ Negocio por defecto creado (id=1)');
  }

  // Horarios y config inicial (desde config.js)
  for (const day of Object.keys(config.openingHours || {})) {
    const ranges = config.openingHours[day];
    if (Array.isArray(ranges)) {
      for (const range of ranges) {
        if (Array.isArray(range) && range.length === 2) {
          await runQuery(
            `INSERT INTO opening_hours (day_of_week, start_hour, end_hour) VALUES (?, ?, ?) ON CONFLICT (day_of_week, start_hour, end_hour) DO NOTHING`,
            [parseInt(day, 10), range[0], range[1]]
          ).catch(() => {});
        }
      }
    }
  }
  const initialConfig = [
    ['businessName', config.businessName],
    ['businessPhone', config.businessPhone],
    ['businessEmail', config.businessEmail],
    ['appointmentDuration', String(config.appointmentDuration || 50)],
    ['timezone', config.timezone || 'Europe/Madrid'],
    ['reminderDaysBefore', String((config.emailConfig && config.emailConfig.reminderDaysBefore) || 1)]
  ];
  for (const [key, value] of initialConfig) {
    await runQuery(
      `INSERT INTO business_config (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING`,
      [key, value]
    ).catch(() => {});
  }

  console.log('✅ Base de datos PostgreSQL inicializada correctamente');
  console.log('📝 Crea el primer usuario en /setup');
}

if (require.main === module) {
  initPostgres()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Error inicializando PostgreSQL:', err);
      process.exit(1);
    });
}

module.exports = { initPostgres };
