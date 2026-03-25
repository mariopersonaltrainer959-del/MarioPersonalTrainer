/**
 * Adapter PostgreSQL para Railway (DATABASE_URL).
 * Misma interfaz que SQLite: runQuery, getQuery, allQuery.
 * Los datos persisten en la BD gestionada por Railway; no dependen de volúmenes.
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : undefined
});

if (process.env.NODE_ENV === 'production') {
  console.log('💾 Base de datos: PostgreSQL (Railway) – persistencia garantizada');
}

function toPgParams(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function runQuery(query, params = []) {
  const pgSql = toPgParams(query);
  const isInsert = /^\s*INSERT\s+/i.test(query.trim()) && !/RETURNING\s+/i.test(query);
  const sqlWithReturning = isInsert ? pgSql.replace(/;\s*$/, '') + ' RETURNING id' : pgSql;
  const run = (sql) => pool.query(sql, params).then((res) => {
    const lastID = isInsert && res.rows && res.rows[0] ? res.rows[0].id : undefined;
    return { lastID, changes: res.rowCount || 0 };
  });
  if (!isInsert) return run(pgSql);
  return run(sqlWithReturning).catch((err) => {
    if (err.message && /column "id" does not exist/i.test(err.message)) {
      return run(pgSql).then((res) => ({ lastID: undefined, changes: res.rowCount || 0 }));
    }
    return Promise.reject(err);
  });
}

function getQuery(query, params = []) {
  const pgSql = toPgParams(query);
  return pool.query(pgSql, params).then((res) => res.rows && res.rows[0] ? res.rows[0] : null);
}

function allQuery(query, params = []) {
  const pgSql = toPgParams(query);
  return pool.query(pgSql, params).then((res) => res.rows || []);
}

function getDb() {
  return {
    run: (sql, params, cb) => {
      runQuery(toPgParams(sql), params || [])
        .then((r) => cb && cb(null, r))
        .catch((err) => cb && cb(err));
    },
    close: () => {}
  };
}

module.exports = {
  getDb,
  runQuery,
  getQuery,
  allQuery
};
