/**
 * Capa de BD: PostgreSQL (Railway) si existe DATABASE_URL; si no, SQLite.
 * Con DATABASE_URL los datos persisten en la BD gestionada por Railway.
 */
const usePg = !!process.env.DATABASE_URL;
const impl = usePg ? require('./db-pg') : require('./db-sqlite');

module.exports = {
  getDb: impl.getDb,
  runQuery: impl.runQuery,
  getQuery: impl.getQuery,
  allQuery: impl.allQuery
};
