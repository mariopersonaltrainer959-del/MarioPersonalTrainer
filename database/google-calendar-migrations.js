/**
 * Migraciones para integración Google Calendar.
 * - negocio: tokens OAuth y calendar_id.
 * - citas: google_calendar_event_id para actualizar/borrar evento.
 */
const { runQuery } = require('../utils/db');

function runIgnore(sql, params = []) {
  return runQuery(sql, params).catch((err) => {
    if (!/duplicate column name|already exists/i.test(err.message)) console.warn('[Google Calendar migration]', err.message);
  });
}

async function runGoogleCalendarMigrations() {
  await runIgnore('ALTER TABLE negocio ADD COLUMN google_calendar_refresh_token TEXT');
  await runIgnore('ALTER TABLE negocio ADD COLUMN google_calendar_calendar_id TEXT');
  await runIgnore('ALTER TABLE negocio ADD COLUMN google_calendar_sync_busy INTEGER DEFAULT 0');
  await runIgnore('ALTER TABLE citas ADD COLUMN google_calendar_event_id TEXT');
}

module.exports = { runGoogleCalendarMigrations };
