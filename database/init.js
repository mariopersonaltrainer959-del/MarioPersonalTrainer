const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const volumeMount = process.env.RAILWAY_VOLUME_MOUNT_PATH;
const explicitPath = process.env.DATABASE_PATH;
const dbPath = explicitPath
  || (volumeMount ? path.join(volumeMount, 'database.db') : null)
  || path.join(__dirname, '..', 'database.db');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const dbFileExistedBeforeInit = fs.existsSync(dbPath);
let dbFileSize = 0;
try {
  if (dbFileExistedBeforeInit) dbFileSize = fs.statSync(dbPath).size;
  const resolved = path.resolve(dbPath);
  if (process.env.NODE_ENV === 'production') {
    console.log('📂 Archivo BD al arrancar:', dbFileExistedBeforeInit ? 'ya existía (volumen persistió)' : 'nuevo (primera vez o volumen no persistió)', '| ruta real:', resolved, '| tamaño:', dbFileSize, 'bytes');
  }
} catch (e) {
  if (process.env.NODE_ENV === 'production') console.log('📂 Archivo BD al arrancar:', dbFileExistedBeforeInit ? 'ya existía' : 'nuevo', '| (no se pudo stat:', e.message + ')');
}
const db = new sqlite3.Database(dbPath);
try {
  db.configure('busyTimeout', 5000);
} catch (_) {}
db.run('PRAGMA synchronous = FULL');
db.run('PRAGMA journal_mode = WAL');

async function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Tabla de usuarios (solo el negocio puede crear usuarios)
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Tabla de citas
      db.run(`CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_name TEXT NOT NULL,
        client_email TEXT NOT NULL,
        client_phone TEXT,
        appointment_date DATETIME NOT NULL,
        duration INTEGER NOT NULL DEFAULT 50,
        status TEXT DEFAULT 'confirmed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(appointment_date)
      )`);
      db.run(`ALTER TABLE appointments ADD COLUMN client_phone TEXT`, err => {
        if (err && !/duplicate column name/i.test(err.message)) console.warn('Migration client_phone:', err.message);
      });

      // Tabla de configuración del negocio (sobrescribe config.js desde dashboard)
      db.run(`CREATE TABLE IF NOT EXISTS business_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Tabla de horarios bloqueados (reservas fuera del sistema)
      db.run(`CREATE TABLE IF NOT EXISTS blocked_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Tabla de horarios de atención por día
      db.run(`CREATE TABLE IF NOT EXISTS opening_hours (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_of_week INTEGER NOT NULL, -- 0=Domingo, 1=Lunes, ..., 6=Sábado
        start_hour INTEGER NOT NULL,
        end_hour INTEGER NOT NULL,
        UNIQUE(day_of_week, start_hour, end_hour)
      )`, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Insertar configuración inicial desde config.js
        const config = require('../config.js');
        
        // Insertar horarios iniciales
        const hourPromises = [];
        Object.keys(config.openingHours).forEach(day => {
          const ranges = config.openingHours[day];
          if (Array.isArray(ranges) && ranges.length > 0) {
            ranges.forEach(range => {
              if (Array.isArray(range) && range.length === 2) {
                hourPromises.push(new Promise((res, rej) => {
                  db.run(
                    `INSERT OR IGNORE INTO opening_hours (day_of_week, start_hour, end_hour) 
                     VALUES (?, ?, ?)`,
                    [parseInt(day), range[0], range[1]],
                    (err) => err ? rej(err) : res()
                  );
                }));
              }
            });
          }
        });

        // Insertar configuración inicial
        const configPromises = [];
        const initialConfig = [
          ['businessName', config.businessName],
          ['businessPhone', config.businessPhone],
          ['businessEmail', config.businessEmail],
          ['appointmentDuration', config.appointmentDuration.toString()],
          ['timezone', config.timezone],
          ['reminderDaysBefore', config.emailConfig.reminderDaysBefore.toString()]
        ];

        initialConfig.forEach(([key, value]) => {
          configPromises.push(new Promise((res, rej) => {
            db.run(
              `INSERT OR IGNORE INTO business_config (key, value) VALUES (?, ?)`,
              [key, value],
              (err) => err ? rej(err) : res()
            );
          }));
        });

        // Esperar a que todas las inserciones terminen
        Promise.all([...hourPromises, ...configPromises])
          .then(() => {
            console.log('✅ Base de datos inicializada correctamente');
            console.log('\n📝 IMPORTANTE: Crea el primer usuario ejecutando:');
            console.log('   node utils/create-user.js');
            db.close((err) => {
              if (err) reject(err);
              else resolve();
            });
          })
          .catch(reject);
      });
    });
  });
}

// Ejecutar si se llama directamente
if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Error inicializando base de datos:', err);
      process.exit(1);
    });
}

module.exports = { initDatabase };
