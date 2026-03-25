/**
 * SQLite (archivo). Se usa cuando no hay DATABASE_URL (p. ej. demos con volumen o desarrollo).
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const volumeMount = process.env.RAILWAY_VOLUME_MOUNT_PATH;
const explicitPath = process.env.DATABASE_PATH;
const dbPath = explicitPath
  || (volumeMount ? path.join(volumeMount, 'database.db') : null)
  || path.join(__dirname, '..', 'database.db');

const dbDir = path.dirname(dbPath);
if (dbDir && !fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch (e) {
    console.warn('No se pudo crear directorio de BD:', dbDir, e.message);
  }
}

if (process.env.NODE_ENV === 'production') {
  const onVolume = !!(explicitPath || volumeMount);
  console.log('💾 Base de datos:', dbPath, onVolume ? '(SQLite en volumen)' : '(NO PERSISTENTE)');
  if (!onVolume) {
    console.warn('⚠️ Para persistencia en Railway usa Postgres (DATABASE_URL) o Volume + DATABASE_PATH. Ver VERIFICAR_PERSISTENCIA_BD.md');
  }
}

function getDb() {
  const db = new sqlite3.Database(dbPath);
  db.run('PRAGMA synchronous = FULL');
  db.run('PRAGMA journal_mode = DELETE');
  return db;
}

function runQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(query, params, function (err) {
      db.close();
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.get(query, params, (err, row) => {
      db.close();
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function allQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(query, params, (err, rows) => {
      db.close();
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

module.exports = {
  getDb,
  runQuery,
  getQuery,
  allQuery
};
