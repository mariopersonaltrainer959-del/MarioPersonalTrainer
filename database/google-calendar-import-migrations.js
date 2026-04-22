/**
 * Migraciones para importación Google Calendar → blocked_slots.
 * Guarda el mapping evento Google ↔ bloqueo para mantenerlo actualizado.
 */
const { runQuery } = require('../utils/db');

async function runGoogleCalendarImportMigrations() {
  const isPg = !!process.env.DATABASE_URL;
  if (isPg) {
    await runQuery(`
      CREATE TABLE IF NOT EXISTS google_calendar_blocked_map (
        id SERIAL PRIMARY KEY,
        negocio_id INTEGER NOT NULL REFERENCES negocio(id),
        google_event_id TEXT NOT NULL,
        blocked_slot_id INTEGER NOT NULL REFERENCES blocked_slots(id),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(negocio_id, google_event_id)
      )
    `).catch(() => {});
    await runQuery(`ALTER TABLE negocio ADD COLUMN IF NOT EXISTS google_calendar_import_enabled BOOLEAN DEFAULT false`).catch(() => {});
    await runQuery(`ALTER TABLE negocio ADD COLUMN IF NOT EXISTS google_calendar_import_days INTEGER DEFAULT 30`).catch(() => {});
  } else {
    await runQuery(`
      CREATE TABLE IF NOT EXISTS google_calendar_blocked_map (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        negocio_id INTEGER NOT NULL,
        google_event_id TEXT NOT NULL,
        blocked_slot_id INTEGER NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(negocio_id, google_event_id)
      )
    `).catch(() => {});
    await runQuery(`ALTER TABLE negocio ADD COLUMN google_calendar_import_enabled INTEGER DEFAULT 0`).catch(() => {});
    await runQuery(`ALTER TABLE negocio ADD COLUMN google_calendar_import_days INTEGER DEFAULT 30`).catch(() => {});
  }
}

module.exports = { runGoogleCalendarImportMigrations };

