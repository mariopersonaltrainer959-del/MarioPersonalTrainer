/**
 * Sincronización bidireccional (Google Calendar → citas del sistema).
 * - Los eventos de Google se convierten en entrenos (citas) reales en la BD.
 * - Evita bucles usando `citas.google_calendar_event_id` como clave de idempotencia.
 *
 * Nota: importamos solo eventos con hora (dateTime). Los eventos "todo el día" se ignoran.
 */
const { getQuery, runQuery } = require('../utils/db');
const googleCalendar = require('./google-calendar');
const pacientesService = require('./pacientes');
const citasService = require('./citas');

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

function fmtMadridParts(d) {
  const dtf = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  // sv-SE => "YYYY-MM-DD HH:mm"
  const s = dtf.format(d);
  const [date, time] = s.split(' ');
  return { date, time };
}

function normalizeSummaryToClienteNombre(summary) {
  const s = String(summary || '').trim();
  if (!s) return 'Cliente (Google)';
  return s.replace(/^Entreno:\s*/i, '').replace(/^Cita:\s*/i, '').slice(0, 120);
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
 * Sincronizar eventos (ventana temporal) desde el calendario seleccionado a CITAS.
 * - Crea/actualiza entrenos reales.
 * - Si un evento aparece como cancelado, cancela la cita asociada.
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
  let cancelled = 0;
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
      const { startIso, endIso, allDay } = getEventStartEndIso(ev);
      if (!startIso || !endIso) continue;
      if (allDay) continue; // ignorar todo el día

      const start = new Date(startIso);
      const end = new Date(endIso);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      const { date: fecha, time: hora_inicio_full } = fmtMadridParts(start);
      const { time: hora_fin_full } = fmtMadridParts(end);
      const hora_inicio = hora_inicio_full.slice(0, 5);
      const hora_fin = hora_fin_full.slice(0, 5);

      const existing = await getQuery(
        'SELECT id, estado FROM citas WHERE negocio_id = ? AND google_calendar_event_id = ?',
        [negocioId, ev.id]
      ).catch(() => null);

      if (ev.status === 'cancelled') {
        if (existing && existing.id) {
          await citasService.updateUnsafe(negocioId, existing.id, { estado: 'cancelada' }).catch(() => {});
          cancelled++;
        }
        continue;
      }

      const nombreCliente = normalizeSummaryToClienteNombre(ev.summary);
      const syntheticEmail = `google-event-${String(ev.id).toLowerCase()}@calendar.local`;
      const paciente = await pacientesService.getOrCreateByEmail(negocioId, {
        nombre: nombreCliente,
        email: syntheticEmail,
        telefono: null
      });

      const notas = `Importado de Google Calendar · eventId=${ev.id}`;
      if (!existing) {
        const { id: citaId } = await citasService.createUnsafe(negocioId, {
          paciente_id: paciente.id,
          fecha,
          hora_inicio,
          hora_fin,
          estado: 'confirmada',
          notas
        });
        await runQuery(
          'UPDATE citas SET google_calendar_event_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND negocio_id = ?',
          [ev.id, citaId, negocioId]
        ).catch(() => {});
        created++;
      } else {
        await citasService.updateUnsafe(negocioId, existing.id, {
          paciente_id: paciente.id,
          fecha,
          hora_inicio,
          hora_fin,
          estado: existing.estado === 'cancelada' ? 'confirmada' : existing.estado,
          notas
        });
        updated++;
      }
    }

    pageToken = res.data && res.data.nextPageToken;
    if (!pageToken) break;
  }

  return { ok: true, scanned, created, updated, cancelled, timeMin, timeMax };
}

module.exports = {
  getImportConfig,
  setImportEnabled,
  syncNow
};

