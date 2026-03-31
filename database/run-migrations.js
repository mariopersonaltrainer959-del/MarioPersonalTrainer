/**
 * Migraciones multi-negocio.
 * Crea tablas: negocio, pacientes, citas (nueva), plantillas_email, textos_legales, consentimientos.
 * Añade negocio_id a users, opening_hours, blocked_slots.
 * Migra datos desde appointments + business_config al nuevo esquema.
 */
const { runQuery, getQuery, allQuery } = require('../utils/db');
const config = require('../config');
const { DEFAULT_LANDING } = require('../utils/landing-content');

const DEFAULT_NEGOCIO_ID = 1;

function runIgnore(sql, params = []) {
  return runQuery(sql, params).catch((err) => {
    if (!/duplicate column name|already exists/i.test(err.message)) console.warn('[Migration]', err.message);
  });
}

const isPg = !!process.env.DATABASE_URL;

async function runMigrations() {
  try {
    if (!isPg) {
      // --- Tabla negocio (solo SQLite; Postgres usa init-pg.js) ---
      await runQuery(`
      CREATE TABLE IF NOT EXISTS negocio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        telefono TEXT,
        email TEXT,
        direccion TEXT,
        duracion_cita_default INTEGER NOT NULL DEFAULT 50,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // --- Tabla pacientes ---
    await runQuery(`
      CREATE TABLE IF NOT EXISTS pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // --- Tabla citas (nueva estructura) ---
    await runQuery(`
      CREATE TABLE IF NOT EXISTS citas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        negocio_id INTEGER NOT NULL REFERENCES negocio(id),
        paciente_id INTEGER NOT NULL REFERENCES pacientes(id),
        fecha DATE NOT NULL,
        hora_inicio TEXT NOT NULL,
        hora_fin TEXT NOT NULL,
        tipo_sesion TEXT CHECK(tipo_sesion IN ('online', 'presencial')),
        estado TEXT NOT NULL DEFAULT 'confirmada' CHECK(estado IN ('confirmada', 'pendiente', 'cancelada', 'pasada', 'no_asistio')),
        notas TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // --- Tabla plantillas_email ---
    await runQuery(`
      CREATE TABLE IF NOT EXISTS plantillas_email (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        negocio_id INTEGER NOT NULL REFERENCES negocio(id),
        nombre TEXT NOT NULL,
        asunto TEXT NOT NULL,
        cuerpo TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(negocio_id, nombre)
      )
    `);

    // --- Tabla textos_legales ---
    await runQuery(`
      CREATE TABLE IF NOT EXISTS textos_legales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        negocio_id INTEGER NOT NULL REFERENCES negocio(id) UNIQUE,
        politica_privacidad TEXT,
        consentimiento TEXT,
        version TEXT DEFAULT '1',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // --- Tabla landing_page (contenido editable de la web pública) ---
    await runQuery(`
      CREATE TABLE IF NOT EXISTS landing_page (
        negocio_id INTEGER NOT NULL PRIMARY KEY REFERENCES negocio(id),
        content TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // --- Tabla landing_images (imágenes en BD para persistir en Railway) ---
    await runQuery(`
      CREATE TABLE IF NOT EXISTS landing_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        negocio_id INTEGER NOT NULL REFERENCES negocio(id),
        filename TEXT NOT NULL,
        mimetype TEXT NOT NULL,
        data BLOB NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // --- Tabla consentimientos (log RGPD) ---
    await runQuery(`
      CREATE TABLE IF NOT EXISTS consentimientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL REFERENCES pacientes(id),
        fecha DATETIME NOT NULL,
        ip TEXT,
        version_texto TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // --- Tabla facturas (generador de facturas) ---
    await runQuery(`
      CREATE TABLE IF NOT EXISTS facturas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    }

    // --- SMTP en negocio ---
    await runIgnore('ALTER TABLE negocio ADD COLUMN smtp_host TEXT');
    await runIgnore('ALTER TABLE negocio ADD COLUMN smtp_port INTEGER');
    await runIgnore('ALTER TABLE negocio ADD COLUMN smtp_user TEXT');
    await runIgnore('ALTER TABLE negocio ADD COLUMN smtp_password TEXT');
    await runIgnore('ALTER TABLE negocio ADD COLUMN email_remitente TEXT');
    await runIgnore('ALTER TABLE negocio ADD COLUMN nombre_remitente TEXT');
    await runIgnore('ALTER TABLE negocio ADD COLUMN nif TEXT');

    // --- Añadir negocio_id a tablas existentes ---
    await runIgnore('ALTER TABLE users ADD COLUMN negocio_id INTEGER DEFAULT 1');
    await runIgnore('ALTER TABLE opening_hours ADD COLUMN negocio_id INTEGER DEFAULT 1');
    await runIgnore('ALTER TABLE blocked_slots ADD COLUMN negocio_id INTEGER DEFAULT 1');

    // --- Insertar negocio por defecto si no existe ---
    const negocioExists = await getQuery('SELECT id FROM negocio WHERE id = ?', [DEFAULT_NEGOCIO_ID]);
    if (!negocioExists) {
      const bc = await allQuery('SELECT key, value FROM business_config').catch(() => []);
      const kv = {};
      bc.forEach((r) => { kv[r.key] = r.value; });
      await runQuery(
        `INSERT INTO negocio (id, nombre, telefono, email, direccion, duracion_cita_default) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          DEFAULT_NEGOCIO_ID,
          kv.businessName || config.businessName || 'Mi Negocio',
          kv.businessPhone || config.businessPhone || '',
          kv.businessEmail || config.businessEmail || '',
          kv.direccion || '',
          parseInt(kv.appointmentDuration || config.appointmentDuration || '50', 10)
        ]
      );
      console.log('✅ Negocio por defecto creado (id=1)');
      if (isPg) {
        await runQuery("SELECT setval(pg_get_serial_sequence('negocio', 'id'), (SELECT COALESCE(MAX(id), 1) FROM negocio))").catch(() => {});
      }
    }

    // Asegurar que usuarios existentes vean citas del negocio 1 (landing y dashboard alineados)
    await runQuery('UPDATE users SET negocio_id = 1 WHERE negocio_id IS NULL').catch(() => {});

    // --- Tablas en Postgres (para deploys que ya tenían BD antes de añadirlas) ---
    if (isPg) {
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
      `).catch(() => {});
      await runQuery(`
        CREATE TABLE IF NOT EXISTS landing_images (
          id SERIAL PRIMARY KEY,
          negocio_id INTEGER NOT NULL REFERENCES negocio(id),
          filename TEXT NOT NULL,
          mimetype TEXT NOT NULL,
          data BYTEA NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).catch(() => {});
    }

    // --- Migrar appointments → pacientes + citas (una sola vez) ---
    const citasCount = await getQuery('SELECT COUNT(*) as c FROM citas').catch(() => null);
    if (citasCount && citasCount.c === 0) {
      const oldAppointments = await allQuery(
        `SELECT * FROM appointments WHERE status = 'confirmed' OR status = 'cancelled' ORDER BY id`
      ).catch(() => []);
      for (const apt of oldAppointments) {
        const d = new Date(apt.appointment_date);
        const fecha = d.toISOString().slice(0, 10);
        const hora = d.toTimeString().slice(0, 5);
        const end = new Date(d.getTime() + (apt.duration || 50) * 60000);
        const hora_fin = end.toTimeString().slice(0, 5);
        let paciente = await getQuery(
          'SELECT id FROM pacientes WHERE negocio_id = ? AND email = ?',
          [DEFAULT_NEGOCIO_ID, apt.client_email]
        );
        if (!paciente) {
          const r = await runQuery(
            `INSERT INTO pacientes (negocio_id, nombre, email, telefono, estado) VALUES (?, ?, ?, ?, 'activo')`,
            [DEFAULT_NEGOCIO_ID, apt.client_name || 'Sin nombre', apt.client_email, apt.client_phone || null]
          );
          paciente = { id: r.lastID };
        }
        const estado = apt.status === 'cancelled' ? 'cancelada' : (d < new Date() ? 'pasada' : 'confirmada');
        await runQuery(
          `INSERT INTO citas (negocio_id, paciente_id, fecha, hora_inicio, hora_fin, estado) VALUES (?, ?, ?, ?, ?, ?)`,
          [DEFAULT_NEGOCIO_ID, paciente.id, fecha, hora, hora_fin, estado]
        );
      }
      if (oldAppointments.length > 0) console.log('✅ Migradas', oldAppointments.length, 'citas a nuevo esquema');
    }

    // --- Insertar plantilla de recordatorio por defecto si no existe ---
    const plantillaExists = await getQuery(
      'SELECT id FROM plantillas_email WHERE negocio_id = ? AND nombre = ?',
      [DEFAULT_NEGOCIO_ID, 'recordatorio']
    );
    if (!plantillaExists) {
      await runQuery(
        `INSERT INTO plantillas_email (negocio_id, nombre, asunto, cuerpo) VALUES (?, 'recordatorio', ?, ?)`,
        [
          DEFAULT_NEGOCIO_ID,
          'Recordatorio: cita el {{fecha}} a las {{hora}}',
          `Hola {{nombre_paciente}},\n\nTe recordamos tu cita en {{nombre_negocio}} el {{fecha}} a las {{hora}}.\n\nSaludos.`
        ]
      );
    }

    // --- Textos legales RGPD por defecto (ejemplo política de privacidad y consentimiento) ---
    const defaultPolitica = `POLÍTICA DE PRIVACIDAD (ejemplo RGPD)

Responsable del tratamiento: [Nombre del profesional/centro], con domicilio en [dirección] y contacto [email].

Finalidad: Gestión de citas, relación terapéutica o profesional y comunicaciones relativas al servicio.

Legitimación: Consentimiento del interesado y, en su caso, ejecución de contrato.

Datos que tratamos: nombre, apellidos, email, teléfono y cuantos datos facilite en el formulario de reserva o en sesión.

Conservación: Los datos se conservarán mientras exista relación y, tras ella, durante los plazos legales aplicables (incluida reclamación de responsabilidades).

Destinatarios: No se ceden datos a terceros salvo obligación legal.

Derechos: Puede ejercer sus derechos de acceso, rectificación, supresión, limitación, oposición y portabilidad dirigiendo un escrito a [email] o ante la Agencia Española de Protección de Datos (www.aepd.es).`;

    const defaultConsentimiento = `Consiento el tratamiento de mis datos personales (nombre, email, teléfono y los que facilite) para la gestión de la cita y la relación terapéutica/profesional, de conformidad con la política de privacidad indicada.`;

    const textosLegalesRow = await getQuery('SELECT id, politica_privacidad, consentimiento FROM textos_legales WHERE negocio_id = ?', [DEFAULT_NEGOCIO_ID]);
    const vacio = (t) => t == null || String(t).trim() === '';
    if (!textosLegalesRow) {
      await runQuery(
        'INSERT INTO textos_legales (negocio_id, politica_privacidad, consentimiento, version) VALUES (?, ?, ?, ?)',
        [DEFAULT_NEGOCIO_ID, defaultPolitica, defaultConsentimiento, '1']
      );
      console.log('✅ Textos legales RGPD de ejemplo insertados');
    } else if (vacio(textosLegalesRow.politica_privacidad) && vacio(textosLegalesRow.consentimiento)) {
      await runQuery(
        'UPDATE textos_legales SET politica_privacidad = ?, consentimiento = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE negocio_id = ?',
        [defaultPolitica, defaultConsentimiento, '1', DEFAULT_NEGOCIO_ID]
      );
      console.log('✅ Textos legales RGPD de ejemplo actualizados (campos vacíos)');
    }

    // --- Contenido por defecto landing page (Mario Personal Trainer + SEO) ---
    const defaultLanding = JSON.stringify(DEFAULT_LANDING);
    const landingRow = await getQuery('SELECT negocio_id FROM landing_page WHERE negocio_id = ?', [DEFAULT_NEGOCIO_ID]);
    if (!landingRow) {
      await runQuery('INSERT INTO landing_page (negocio_id, content) VALUES (?, ?)', [DEFAULT_NEGOCIO_ID, defaultLanding]);
      console.log('✅ Landing page por defecto creada');
    } else {
      // Sustituir solo la plantilla genérica antigua por la de Mario / Estepona + SEO
      try {
        const lr = await getQuery('SELECT content FROM landing_page WHERE negocio_id = ?', [DEFAULT_NEGOCIO_ID]);
        if (lr && lr.content) {
          const j = JSON.parse(lr.content);
          const oldHero = 'Bienvenido a tu espacio de bienestar';
          const oldSub =
            'Acompañamiento profesional para tu crecimiento personal y salud emocional. Reserva tu cita de forma sencilla.';
          if (j.hero_title === oldHero && String(j.hero_subtitle || '').trim() === oldSub) {
            await runQuery('UPDATE landing_page SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE negocio_id = ?', [
              defaultLanding,
              DEFAULT_NEGOCIO_ID
            ]);
            console.log('✅ Landing actualizada a Mario Personal Trainer (Estepona) + SEO');
          }
        }
      } catch (e) {
        console.warn('[Migration] No se pudo comprobar/actualizar landing antigua:', e.message);
      }
    }

    // --- ReputacionPro: tablas y columnas para reseñas Google ---
    const { runReputacionProMigrations } = require('./reputacion-pro-migrations');
    await runReputacionProMigrations();

    // --- Google Calendar: tokens y sync ---
    const { runGoogleCalendarMigrations } = require('./google-calendar-migrations');
    await runGoogleCalendarMigrations();
  } catch (err) {
    throw err;
  }
}

module.exports = { runMigrations, DEFAULT_NEGOCIO_ID };
