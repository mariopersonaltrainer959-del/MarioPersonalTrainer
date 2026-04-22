/**
 * Importación de eventos de Google Calendar → blocked_slots.
 * Objetivo: que lo que exista en Google se vea como ocupado en el sistema (y opcionalmente en el calendario del panel).
 */
const { allQuery, getQuery, runQuery } = require('../utils/db');
const googleCalendar = require('./google-calendar');

function toIsoSafe(d) {
  try {
    return new Date(d).toISOString();
  } catch {
    return null;
  }
}

function getEventStartEndIso(ev) {
  // dateTime (evento con horas) o date (evento todo el día)
  const s = ev && ev.start;
  const e = ev && ev.end;
  if (!s || !e) return { startIso: null, endIso: null, allDay: false };
  if (s.dateTime && e.dateTime) return { startIso: toIsoSafe(s.dateTime), endIso: toIsoSafe(e.dateTime), allDay: false };
  if (s.date && e.date) {
    // all-day: end.date es exclusivo en Google Calendar
    const start = new Date(`${s.date}T00:00:00`);
    const endExcl = new Date(`${e.date}T00:00:00`);
    const end = new Date(endExcl.getTime() - 60 * 1000); // 23:59 del día anterior
    return { startIso: start.toISOString(), endIso: end.toISOString(), allDay: true };
  }
  return { startIso: null, endIso: null, allDay: false };
}

async function upsertBlockedSlot(negocioId, { startIso, endIso, reason }) {
  // Crear bloqueo y devolver id
  const isPg = !!process.env.DATABASE_URL;
  if (isPg) {
    const row = await getQuery(
      `INSERT INTO blocked_slots (negocio_id, start_time, end_time, reason)
       VALUES (?, ?, ?, ?)
       RETURNING id`,
      [negocioId, startIso, endIso, reason || null]
    );
    return row && row.id;
  }
  const r = await runQuery(
    'INSERT INTO blocked_slots (negocio_id, start_time, end_time, reason) VALUES (?, ?, ?, ?)',
    [negocioId, startIso, endIso, reason || null]
  );
  return r && r.lastID;
}

async function updateBlockedSlot(negocioId, blockedSlotId, { startIso, endIso, reason }) {
  try {
    await runQuery(
      'UPDATE blocked_slots SET start_time = ?, end_time = ?, reason = ? WHERE id = ? AND negocio_id = ?',
      [startIso, endIso, reason || null, blockedSlotId, negocioId]
    );
  } catch (_) {
    await runQuery('UPDATE blocked_slots SET start_time = ?, end_time = ?, reason = ? WHERE id = ?', [
      startIso,
      endIso,
      reason || null,
      blockedSlotId
    ]);
  }
}

async function deleteBlockedSlot(negocioId, blockedSlotId) {
  try {
    await runQuery('DELETE FROM blocked_slots WHERE id = ? AND negocio_id = ?', [blockedSlotId, negocioId]);
  } catch (_) {
    await runQuery('DELETE FROM blocked_slots WHERE id = ?', [blockedSlotId]);
  }
}

async function getImportConfig(negocioId) {
  const row = await getQuery(
    'SELECT google_calendar_import_enabled, google_calendar_import_days FROM negocio WHERE id = ?',
    [negocioId]
  ).catch(() => null);
  const enabled = !!(row && (row.google_calendar_import_enabled === 1 || row.google_calendar_import_enabled === true));
  const days = row && row.google_calendar_import_days != null ? Number(row.google_calendar_import_days) : 30;
  return { enabled, days: Number.isFinite(days) && days > 0 ? days : 30 };
}

async function setImportEnabled(negocioId, enabled) {
  const isPg = !!process.env.DATABASE_URL;
  await runQuery(
    'UPDATE negocio SET google_calendar_import_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [isPg ? !!enabled : (enabled ? 1 : 0), negocioId]
  );
}

/**
 * Sincronizar eventos (ventana temporal) desde el calendario seleccionado a blocked_slots.
 * - Crea/actualiza bloqueos.
 * - Si un evento aparece como cancelado, borra el bloqueo asociado.
 */
async function syncNow(negocioId, { daysPast = 7, daysFuture = 60 } = {}) {
  const client = await googleCalendar.getCalendarClient(negocioId);
  if (!client) return { ok: false, error: 'Google Calendar no conectado' };

  const now = new Date();
  const timeMin = new Date(now.getTime() - daysPast * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + daysFuture * 24 * 60 * 60 * 1000).toISOString();

  let pageToken = undefined;
  let created = 0;
  let updated = 0;
  let removed = 0;
  let scanned = 0;

  while (true) {
    const res = await client.calendar.events.list({
      calendarId: client.calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      showDeleted: true,
      maxResults: 2500,
      pageToken
    });
    const items = (res.data && res.data.items) || [];
    for (const ev of items) {
      scanned++;
      if (!ev || !ev.id) continue;
      const { startIso, endIso } = getEventStartEndIso(ev);
      if (!startIso || !endIso) continue;

      const reason = `Google: ${String(ev.summary || 'Evento').slice(0, 120)}`;
      const mapRow = await getQuery(
        'SELECT blocked_slot_id FROM google_calendar_blocked_map WHERE negocio_id = ? AND google_event_id = ?',
        [negocioId, ev.id]
      ).catch(() => null);

      if (ev.status === 'cancelled') {
        if (mapRow && mapRow.blocked_slot_id) {
          await deleteBlockedSlot(negocioId, mapRow.blocked_slot_id);
          await runQuery(
            'DELETE FROM google_calendar_blocked_map WHERE negocio_id = ? AND google_event_id = ?',
            [negocioId, ev.id]
          ).catch(() => {});
          removed++;
        }
        continue;
      }

      if (!mapRow) {
        const blockedId = await upsertBlockedSlot(negocioId, { startIso, endIso, reason });
        if (blockedId) {
          await runQuery(
            'INSERT INTO google_calendar_blocked_map (negocio_id, google_event_id, blocked_slot_id) VALUES (?, ?, ?)',
            [negocioId, ev.id, blockedId]
          ).catch(() => {});
          created++;
        }
      } else {
        await updateBlockedSlot(negocioId, mapRow.blocked_slot_id, { startIso, endIso, reason });
        await runQuery(
          'UPDATE google_calendar_blocked_map SET updated_at = CURRENT_TIMESTAMP WHERE negocio_id = ? AND google_event_id = ?',
          [negocioId, ev.id]
        ).catch(() => {});
        updated++;
      }
    }

    pageToken = res.data && res.data.nextPageToken;
    if (!pageToken) break;
  }

  return { ok: true, scanned, created, updated, removed, timeMin, timeMax };
}

module.exports = {
  getImportConfig,
  setImportEnabled,
  syncNow
};

