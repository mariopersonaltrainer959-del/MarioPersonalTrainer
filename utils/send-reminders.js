/**
 * Script para enviar recordatorios de citas
 * 
 * Ejecutar diariamente con un cron job o task scheduler
 * Ejemplo cron: 0 9 * * * node utils/send-reminders.js
 * (Envía recordatorios todos los días a las 9 AM)
 */

const { allQuery } = require('./db');
const { sendReminderEmail } = require('./email');
const { getBusinessConfig } = require('./helpers');

async function sendReminders() {
  try {
    console.log('📧 Iniciando envío de recordatorios...');

    // Obtener configuración
    const config = await getBusinessConfig();
    const reminderDaysBefore = parseInt(config.reminderDaysBefore || 1);

    // Calcular fecha objetivo (hoy + reminderDaysBefore días)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + reminderDaysBefore);
    targetDate.setHours(0, 0, 0, 0);
    
    const targetDateEnd = new Date(targetDate);
    targetDateEnd.setHours(23, 59, 59, 999);

    console.log(`Buscando citas para el ${targetDate.toLocaleDateString('es-ES')}`);

    // Obtener citas confirmadas para la fecha objetivo
    const appointments = await allQuery(
      `SELECT * FROM appointments 
       WHERE status = 'confirmed' 
       AND appointment_date >= ? 
       AND appointment_date <= ?
       AND DATE(appointment_date) = DATE(?)`,
      [targetDate.toISOString(), targetDateEnd.toISOString(), targetDate.toISOString()]
    );

    console.log(`Encontradas ${appointments.length} citas para recordar`);

    // Enviar recordatorios
    let sent = 0;
    let failed = 0;

    for (const appointment of appointments) {
      try {
        const success = await sendReminderEmail(appointment);
        if (success) {
          sent++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Error enviando recordatorio a ${appointment.client_email}:`, error);
        failed++;
      }
    }

    console.log(`✅ Recordatorios enviados: ${sent}`);
    if (failed > 0) {
      console.log(`❌ Fallos: ${failed}`);
    }

    console.log('📧 Proceso de recordatorios completado');
  } catch (error) {
    console.error('❌ Error en el proceso de recordatorios:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  sendReminders()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { sendReminders };
