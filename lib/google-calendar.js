/**
 * Integración con Google Calendar (OAuth 2.0).
 * - Cada negocio conecta su propia cuenta con "Conectar con Google".
 * - Al crear/editar/cancelar una cita se escribe en su calendario.
 * - Opcional: leer "busy" de Google para no ofrecer huecos ocupados allí.
 */
const { google } = require('googleapis');
const { getQuery, runQuery } = require('../utils/db');

// events: crear/editar/borrar eventos propios del sistema
// calendar.readonly: listar calendarios y consultar freebusy
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly'
];

function getBaseUrl(req) {
  if (req && req.get && req.get('host')) {
    const proto = req.get('x-forwarded-proto') || (req.connection && req.connection.encrypted ? 'https' : 'http');
    return `${proto}://${req.get('host')}`;
  }
  return process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
}

/**
 * Cliente OAuth2 sin tokens (solo para auth URL e intercambio de código).
 */
function getOAuth2Client(redirectUri) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * URL para que el usuario autorice la app (conectar con Google).
 * state = negocioId para recuperarlo en el callback.
 */
function getAuthUrl(negocioId, redirectUri) {
  const oauth2 = getOAuth2Client(redirectUri);
  if (!oauth2) return null;
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: String(negocioId)
  });
}

/**
 * Intercambiar código por tokens y guardar refresh_token en negocio.
 */
async function exchangeCodeForTokens(negocioId, code, redirectUri) {
  const oauth2 = getOAuth2Client(redirectUri);
  if (!oauth2) throw new Error('Google Calendar no configurado (falta GOOGLE_CLIENT_ID/SECRET)');
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) throw new Error('No se recibió refresh_token; intenta desconectar y volver a conectar.');
  await runQuery(
    'UPDATE negocio SET google_calendar_refresh_token = ?, google_calendar_calendar_id = COALESCE(google_calendar_calendar_id, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [tokens.refresh_token, 'primary', negocioId]
  );
}

/**
 * Saber si el negocio tiene Google Calendar conectado.
 */
async function isConnected(negocioId) {
  try {
    const row = await getQuery('SELECT google_calendar_refresh_token FROM negocio WHERE id = ?', [negocioId]);
    return !!(row && row.google_calendar_refresh_token);
  } catch (err) {
    // Si la columna aún no existe (SQLite) o la tabla no está lista, devolver "no conectado"
    console.warn('[Google Calendar] isConnected:', err.message);
    return false;
  }
}

/**
 * Desconectar: borrar tokens.
 */
async function disconnect(negocioId) {
  await runQuery(
    'UPDATE negocio SET google_calendar_refresh_token = NULL, google_calendar_calendar_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [negocioId]
  );
}

/**
 * Obtener cliente Calendar autenticado con el refresh_token del negocio.
 */
async function getCalendarClient(negocioId) {
  let row = null;
  try {
    row = await getQuery(
      'SELECT google_calendar_refresh_token, google_calendar_calendar_id FROM negocio WHERE id = ?',
      [negocioId]
    );
  } catch (err) {
    console.warn('[Google Calendar] getCalendarClient:', err.message);
    return null;
  }
  if (!row || !row.google_calendar_refresh_token) return null;
  const redirectUri = process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  const base = redirectUri.replace(/\/$/, '');
  const oauth2 = getOAuth2Client(`${base}/dashboard/api/google-calendar/callback`);
  if (!oauth2) return null;
  oauth2.setCredentials({ refresh_token: row.google_calendar_refresh_token });
  const calendar = google.calendar({ version: 'v3', auth: oauth2 });
  return { calendar, calendarId: row.google_calendar_calendar_id || 'primary' };
}

/**
 * Listar calendarios del usuario (para poder elegir uno desde el panel).
 * Devuelve [{ id, summary, primary }, ...]
 */
async function listCalendars(negocioId) {
  const client = await getCalendarClient(negocioId);
  if (!client) return [];
  try {
    const res = await client.calendar.calendarList.list({ maxResults: 250 });
    const items = (res.data && res.data.items) || [];
    return items.map((c) => ({
      id: c.id,
      summary: c.summary || c.id,
      primary: !!c.primary
    }));
  } catch (err) {
    console.error('[Google Calendar] listCalendars:', err.message);
    return [];
  }
}

/**
 * Guardar el calendarId seleccionado en el negocio.
 */
async function setCalendarId(negocioId, calendarId) {
  const id = String(calendarId || '').trim();
  if (!id) throw new Error('calendarId no válido');
  await runQuery(
    'UPDATE negocio SET google_calendar_calendar_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id, negocioId]
  );
}

/**
 * Sincronizar una cita recién creada: crear evento en Google y guardar event_id en la cita.
 */
async function syncNewCita(negocioId, citaId) {
  const citasService = require('./citas');
  const cita = await citasService.getById(negocioId, citaId);
  if (!cita) return;
  const eventId = await createEvent(negocioId, {
    fecha: cita.fecha,
    hora_inicio: cita.hora_inicio,
    hora_fin: cita.hora_fin,
    pacienteNombre: cita.paciente_nombre
  });
  if (eventId) {
    await runQuery('UPDATE citas SET google_calendar_event_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND negocio_id = ?', [eventId, citaId, negocioId]);
  }
}

/**
 * Crear evento en Google Calendar. Devuelve event.id o null.
 */
async function createEvent(negocioId, { fecha, hora_inicio, hora_fin, pacienteNombre }) {
  const client = await getCalendarClient(negocioId);
  if (!client) return null;
  const start = new Date(`${fecha}T${hora_inicio}`);
  const end = new Date(`${fecha}T${hora_fin}`);
  const event = {
    summary: `Entreno: ${pacienteNombre || 'Reserva'}`,
    description: 'Entreno creado desde el sistema.',
    start: { dateTime: start.toISOString(), timeZone: 'Europe/Madrid' },
    end: { dateTime: end.toISOString(), timeZone: 'Europe/Madrid' }
  };
  try {
    const res = await client.calendar.events.insert({
      calendarId: client.calendarId,
      requestBody: event
    });
    return (res.data && res.data.id) || null;
  } catch (err) {
    console.error('[Google Calendar] createEvent:', err.message);
    return null;
  }
}

/**
 * Actualizar evento existente.
 */
async function updateEvent(negocioId, eventId, { fecha, hora_inicio, hora_fin, pacienteNombre }) {
  const client = await getCalendarClient(negocioId);
  if (!client) return;
  const start = new Date(`${fecha}T${hora_inicio}`);
  const end = new Date(`${fecha}T${hora_fin}`);
  try {
    await client.calendar.events.patch({
      calendarId: client.calendarId,
      eventId,
      requestBody: {
        summary: `Entreno: ${pacienteNombre || 'Reserva'}`,
        start: { dateTime: start.toISOString(), timeZone: 'Europe/Madrid' },
        end: { dateTime: end.toISOString(), timeZone: 'Europe/Madrid' }
      }
    });
  } catch (err) {
    console.error('[Google Calendar] updateEvent:', err.message);
  }
}

/**
 * Borrar evento.
 */
async function deleteEvent(negocioId, eventId) {
  const client = await getCalendarClient(negocioId);
  if (!client) return;
  try {
    await client.calendar.events.delete({
      calendarId: client.calendarId,
      eventId
    });
  } catch (err) {
    if (err.code !== 404) console.error('[Google Calendar] deleteEvent:', err.message);
  }
}

/**
 * Obtener rangos "busy" de Google para un día (para excluir de slots disponibles).
 * Devuelve [{ start: Date, end: Date }, ...].
 */
async function getBusyRanges(negocioId, fecha) {
  const client = await getCalendarClient(negocioId);
  if (!client) return [];
  const startOfDay = new Date(`${fecha}T00:00:00`);
  const endOfDay = new Date(`${fecha}T23:59:59`);
  try {
    const res = await client.calendar.freebusy.query({
      requestBody: {
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        items: [{ id: client.calendarId }]
      }
    });
    const cal = res.data && res.data.calendars && res.data.calendars[client.calendarId];
    const busy = (cal && cal.busy) || [];
    return busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
  } catch (err) {
    console.error('[Google Calendar] getBusyRanges:', err.message);
    return [];
  }
}

/**
 * Comprobar si el negocio tiene activada la opción "usar Google para bloquear huecos".
 */
async function isSyncBusyEnabled(negocioId) {
  try {
    const row = await getQuery('SELECT google_calendar_sync_busy FROM negocio WHERE id = ?', [negocioId]);
    return !!(row && (row.google_calendar_sync_busy === 1 || row.google_calendar_sync_busy === true));
  } catch (err) {
    console.warn('[Google Calendar] isSyncBusyEnabled:', err.message);
    return false;
  }
}

async function setSyncBusy(negocioId, enabled) {
  await runQuery(
    'UPDATE negocio SET google_calendar_sync_busy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [enabled ? 1 : 0, negocioId]
  );
}

module.exports = {
  getBaseUrl,
  getAuthUrl,
  exchangeCodeForTokens,
  isConnected,
  disconnect,
  getCalendarClient,
  listCalendars,
  setCalendarId,
  syncNewCita,
  createEvent,
  updateEvent,
  deleteEvent,
  getBusyRanges,
  isSyncBusyEnabled,
  setSyncBusy
};
