/**
 * Migraciones del módulo ReputacionPro.
 * - Añade a negocio: google_review_url, reputacion_activa.
 * - Crea review_requests (solicitudes de reseña y feedback).
 * - Añade estado 'completada' a citas.
 * - Crea reputacion_jobs (jobs programados 3h después de completada).
 */
const { runQuery, getQuery } = require('../utils/db');

const isPg = !!process.env.DATABASE_URL;

function runIgnore(sql, params = []) {
  return runQuery(sql, params).catch((err) => {
    if (!/duplicate column name|already exists/i.test(err.message)) console.warn('[ReputacionPro migration]', err.message);
  });
}

async function runReputacionProMigrations() {
  // --- Negocio: enlace Google y activación ---
  await runIgnore('ALTER TABLE negocio ADD COLUMN google_review_url TEXT');
  await runIgnore('ALTER TABLE negocio ADD COLUMN reputacion_activa INTEGER DEFAULT 1');

  // --- Tabla review_requests (solicitudes enviadas, valoraciones, clics Google) ---
  if (isPg) {
    await runQuery(`
      CREATE TABLE IF NOT EXISTS review_requests (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL,
        professional_id INTEGER NOT NULL REFERENCES negocio(id),
        email_enviado BOOLEAN NOT NULL DEFAULT false,
        rating INTEGER,
        redirigido_a_google BOOLEAN NOT NULL DEFAULT false,
        comentario TEXT,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});
  } else {
    await runQuery(`
      CREATE TABLE IF NOT EXISTS review_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        professional_id INTEGER NOT NULL REFERENCES negocio(id),
        email_enviado INTEGER NOT NULL DEFAULT 0,
        rating INTEGER,
        redirigido_a_google INTEGER NOT NULL DEFAULT 0,
        comentario TEXT,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});
  }

  // --- Tabla reputacion_jobs (envío 3h después de completada) ---
  if (isPg) {
    await runQuery(`
      CREATE TABLE IF NOT EXISTS reputacion_jobs (
        id SERIAL PRIMARY KEY,
        cita_id INTEGER NOT NULL REFERENCES citas(id),
        negocio_id INTEGER NOT NULL REFERENCES negocio(id),
        programado_para TIMESTAMP NOT NULL,
        enviado BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});
  } else {
    await runQuery(`
      CREATE TABLE IF NOT EXISTS reputacion_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cita_id INTEGER NOT NULL REFERENCES citas(id),
        negocio_id INTEGER NOT NULL REFERENCES negocio(id),
        programado_para TEXT NOT NULL,
        enviado INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});
  }

  // --- Añadir estado 'completada' a citas ---
  if (isPg) {
    const con = await getQuery(
      "SELECT conname FROM pg_constraint WHERE conrelid = 'citas'::regclass AND contype = 'c' LIMIT 1"
    ).catch(() => null);
    if (con && con.conname) {
      await runQuery(`ALTER TABLE citas DROP CONSTRAINT "${con.conname}"`).catch(() => {});
    }
    await runQuery(`
      ALTER TABLE citas ADD CONSTRAINT citas_estado_check
      CHECK (estado IN ('confirmada', 'pendiente', 'cancelada', 'pasada', 'no_asistio', 'completada'))
    `).catch(() => {});
  } else {
    // SQLite: recrear tabla citas con nuevo CHECK
    const tableInfo = await getQuery("SELECT sql FROM sqlite_master WHERE type='table' AND name='citas'").catch(() => null);
    if (tableInfo && tableInfo.sql && !tableInfo.sql.includes('completada')) {
      await runQuery(`
        CREATE TABLE citas_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          negocio_id INTEGER NOT NULL REFERENCES negocio(id),
          paciente_id INTEGER NOT NULL REFERENCES pacientes(id),
          fecha DATE NOT NULL,
          hora_inicio TEXT NOT NULL,
          hora_fin TEXT NOT NULL,
          tipo_sesion TEXT CHECK(tipo_sesion IN ('online', 'presencial')),
          estado TEXT NOT NULL DEFAULT 'confirmada' CHECK(estado IN ('confirmada', 'pendiente', 'cancelada', 'pasada', 'no_asistio', 'completada')),
          notas TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await runQuery(`INSERT INTO citas_new SELECT * FROM citas`);
      await runQuery(`DROP TABLE citas`);
      await runQuery(`ALTER TABLE citas_new RENAME TO citas`);
    }
  }
}

module.exports = { runReputacionProMigrations };
