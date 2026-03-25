/**
 * Punto de arranque: inicializa la BD (Postgres o SQLite) y luego inicia el servidor.
 * Con DATABASE_URL se usa PostgreSQL (Railway); si no, SQLite.
 */
require('../utils/db');

(async () => {
  if (process.env.DATABASE_URL) {
    const { initPostgres } = require('../database/init-pg');
    await initPostgres();
  } else {
    const { initDatabase } = require('../database/init');
    await initDatabase();
  }
  require('../server.js');
})();
