/**
 * Plan semanal de ejercicios por cliente.
 */
const { runQuery } = require('../utils/db');

const isPg = !!process.env.DATABASE_URL;

async function runRutinasMigrations() {
  if (isPg) {
    await runQuery(`
      CREATE TABLE IF NOT EXISTS rutinas_semanales (
        id SERIAL PRIMARY KEY,
        negocio_id INTEGER NOT NULL REFERENCES negocio(id),
        paciente_id INTEGER NOT NULL REFERENCES pacientes(id),
        semana_inicio DATE NOT NULL,
        dias_json TEXT NOT NULL DEFAULT '{}',
        notas TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(negocio_id, paciente_id, semana_inicio)
      )
    `);
  } else {
    await runQuery(`
      CREATE TABLE IF NOT EXISTS rutinas_semanales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        negocio_id INTEGER NOT NULL REFERENCES negocio(id),
        paciente_id INTEGER NOT NULL REFERENCES pacientes(id),
        semana_inicio DATE NOT NULL,
        dias_json TEXT NOT NULL DEFAULT '{}',
        notas TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(negocio_id, paciente_id, semana_inicio)
      )
    `);
  }
}

module.exports = { runRutinasMigrations };
