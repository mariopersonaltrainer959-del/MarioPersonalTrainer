const { allQuery, getQuery } = require('./db');

// Obtener configuración del negocio
async function getBusinessConfig() {
  const configs = await allQuery('SELECT key, value FROM business_config');
  const configObj = {};
  configs.forEach(c => {
    configObj[c.key] = c.value;
  });
  return configObj;
}

// Obtener horarios de apertura desde BD (negocioId opcional: si se pasa, filtra por negocio_id)
async function getOpeningHours(negocioId) {
  let query = 'SELECT day_of_week, start_hour, end_hour FROM opening_hours';
  const params = [];
  if (negocioId != null && negocioId !== undefined) {
    query += ' WHERE negocio_id = ?';
    params.push(negocioId);
  }
  query += ' ORDER BY day_of_week, start_hour';
  let hours;
  try {
    hours = await allQuery(query, params);
  } catch (e) {
    if (/no such column/i.test(e.message)) {
      hours = await allQuery('SELECT day_of_week, start_hour, end_hour FROM opening_hours ORDER BY day_of_week, start_hour');
    } else throw e;
  }
  const hoursObj = {};
  hours.forEach(h => {
    if (!hoursObj[h.day_of_week]) hoursObj[h.day_of_week] = [];
    hoursObj[h.day_of_week].push([h.start_hour, h.end_hour]);
  });
  return hoursObj;
}

// Obtener duración de citas desde BD
async function getAppointmentDuration() {
  const config = await getQuery('SELECT value FROM business_config WHERE key = ?', ['appointmentDuration']);
  return config ? parseInt(config.value) : 50;
}

// Verificar si una hora está disponible
async function isTimeSlotAvailable(dateTime, duration) {
  const startTime = new Date(dateTime);
  const endTime = new Date(startTime.getTime() + duration * 60000);

  // Verificar que no haya citas solapadas
  // Obtener todas las citas confirmadas y verificar solapamientos en JavaScript
  const allAppointments = await allQuery(
    `SELECT * FROM appointments WHERE status = 'confirmed'`
  );

  const hasOverlap = allAppointments.some(apt => {
    const aptStart = new Date(apt.appointment_date);
    const aptEnd = new Date(aptStart.getTime() + apt.duration * 60000);
    
    // Verificar si hay solapamiento
    return (startTime < aptEnd && endTime > aptStart);
  });

  if (hasOverlap) {
    return false;
  }

  // Verificar que no esté en un slot bloqueado
  const blockedSlots = await allQuery(
    `SELECT * FROM blocked_slots 
     WHERE (
       (start_time <= ? AND end_time > ?)
       OR (start_time < ? AND end_time >= ?)
       OR (start_time >= ? AND end_time <= ?)
     )`,
    [
      startTime.toISOString(), startTime.toISOString(),
      endTime.toISOString(), endTime.toISOString(),
      startTime.toISOString(), endTime.toISOString()
    ]
  );

  if (blockedSlots.length > 0) {
    return false;
  }

  return true;
}

// Obtener horas disponibles para un día específico
async function getAvailableTimeSlots(date, duration) {
  // Interpretar YYYY-MM-DD como día civil para que el día de la semana sea correcto en cualquier timezone
  const parts = String(date).trim().split('-');
  if (parts.length !== 3) return [];
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return [];
  const targetDate = new Date(y, m, d);
  if (isNaN(targetDate.getTime())) return [];
  const dayOfWeek = targetDate.getDay();
  
  const openingHours = await getOpeningHours();
  const dayHours = openingHours[dayOfWeek] || [];

  if (dayHours.length === 0) {
    return []; // Día cerrado
  }

  const availableSlots = [];
  const now = new Date();

  dayHours.forEach(([startHour, endHour]) => {
    const slotDate = new Date(targetDate);
    slotDate.setHours(startHour, 0, 0, 0);
    const endSlotDate = new Date(targetDate);
    endSlotDate.setHours(endHour, 0, 0, 0);

    // Generar slots cada X minutos (duración de la cita)
    while (slotDate.getTime() + duration * 60000 <= endSlotDate.getTime()) {
      // Solo mostrar slots futuros
      if (slotDate > now) {
        availableSlots.push(new Date(slotDate));
      }
      slotDate.setMinutes(slotDate.getMinutes() + duration);
    }
  });

  // Filtrar slots disponibles (sin solapamientos)
  const filteredSlots = [];
  for (const slot of availableSlots) {
    const isAvailable = await isTimeSlotAvailable(slot.toISOString(), duration);
    if (isAvailable) {
      filteredSlots.push(slot);
    }
  }

  return filteredSlots;
}

// Formatear fecha para mostrar
function formatDate(date) {
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Formatear hora para mostrar
function formatTime(date) {
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

module.exports = {
  getBusinessConfig,
  getOpeningHours,
  getAppointmentDuration,
  isTimeSlotAvailable,
  getAvailableTimeSlots,
  formatDate,
  formatTime
};
