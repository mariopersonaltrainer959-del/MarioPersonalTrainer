const nodemailer = require('nodemailer');
const config = require('../config');
const { getQuery } = require('./db');

// Si existe RESEND_API_KEY, usamos Resend (API HTTPS). Si no, SMTP (Gmail etc.).
const useResend = !!process.env.RESEND_API_KEY;

async function sendOneEmail(from, to, subject, html) {
  if (useResend) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || `Resend ${res.status}`);
    return;
  }
  const transporter = getTransporter();
  await transporter.sendMail({ from, to, subject, html });
}

// Crear transporter de email (solo si no usamos Resend)
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpConfig.host,
      port: config.smtpConfig.port,
      secure: config.smtpConfig.secure,
      auth: config.smtpConfig.auth,
      connectionTimeout: 10000,
      greetingTimeout: 10000
    });
  }
  return transporter;
}

// Obtener configuración del negocio desde la BD
async function getBusinessConfig() {
  const configs = await require('./db').allQuery('SELECT key, value FROM business_config');
  const configObj = {};
  configs.forEach(c => {
    configObj[c.key] = c.value;
  });
  return configObj;
}

// Enviar email de confirmación de cita
async function sendConfirmationEmail(appointment) {
  try {
    const businessConfig = await getBusinessConfig();
    const businessName = businessConfig.businessName || config.businessName;
    const businessPhone = businessConfig.businessPhone || config.businessPhone;
    const businessEmail = businessConfig.businessEmail || config.businessEmail;

    const date = new Date(appointment.appointment_date);
    const formattedDate = date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Con Resend el "from" debe ser el remitente verificado (EMAIL_FROM)
    const fromAddress = (process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
      ? process.env.EMAIL_FROM
      : config.emailConfig.from;
    const mailOptions = {
      from: fromAddress,
      to: appointment.client_email,
      subject: `Confirmación de cita - ${businessName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4A90E2; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4A90E2; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${businessName}</h1>
            </div>
            <div class="content">
              <h2>Confirmación de tu cita</h2>
              <p>Hola ${appointment.client_name},</p>
              <p>Tu cita ha sido confirmada correctamente.</p>
              
              <div class="info-box">
                <p><strong>Fecha:</strong> ${formattedDate}</p>
                <p><strong>Hora:</strong> ${formattedTime}</p>
                <p><strong>Duración:</strong> ${appointment.duration} minutos</p>
              </div>
              
              <p>Si necesitas modificar o cancelar tu cita, por favor contáctanos:</p>
              <p><strong>Teléfono:</strong> <a href="tel:${businessPhone}">${businessPhone}</a></p>
              <p><strong>Email:</strong> <a href="mailto:${businessEmail}">${businessEmail}</a></p>
              
              <p>Te esperamos.</p>
            </div>
            <div class="footer">
              <p>Este es un email automático, por favor no respondas a este mensaje.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await sendOneEmail(mailOptions.from, mailOptions.to, mailOptions.subject, mailOptions.html);
    console.log(`✅ Email de confirmación enviado a ${appointment.client_email}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de confirmación a', appointment.client_email, ':', error.message || error);
    throw error;
  }
}

// Enviar email de recordatorio
async function sendReminderEmail(appointment) {
  try {
    const businessConfig = await getBusinessConfig();
    const businessName = businessConfig.businessName || config.businessName;
    const businessPhone = businessConfig.businessPhone || config.businessPhone;
    const businessEmail = businessConfig.businessEmail || config.businessEmail;

    const date = new Date(appointment.appointment_date);
    const formattedDate = date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const mailOptions = {
      from: config.emailConfig.from,
      to: appointment.client_email,
      subject: `Recordatorio: Tu cita es mañana - ${businessName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4A90E2; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4A90E2; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${businessName}</h1>
            </div>
            <div class="content">
              <h2>Recordatorio de tu cita</h2>
              <p>Hola ${appointment.client_name},</p>
              <p>Te recordamos que tienes una cita programada:</p>
              
              <div class="info-box">
                <p><strong>Fecha:</strong> ${formattedDate}</p>
                <p><strong>Hora:</strong> ${formattedTime}</p>
                <p><strong>Duración:</strong> ${appointment.duration} minutos</p>
              </div>
              
              <p>Si necesitas modificar o cancelar tu cita, por favor contáctanos:</p>
              <p><strong>Teléfono:</strong> <a href="tel:${businessPhone}">${businessPhone}</a></p>
              <p><strong>Email:</strong> <a href="mailto:${businessEmail}">${businessEmail}</a></p>
              
              <p>Te esperamos.</p>
            </div>
            <div class="footer">
              <p>Este es un email automático, por favor no respondas a este mensaje.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await sendOneEmail(mailOptions.from, mailOptions.to, mailOptions.subject, mailOptions.html);
    console.log(`✅ Email de recordatorio enviado a ${appointment.client_email}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de recordatorio:', error);
    return false;
  }
}

// Enviar notificación al psicólogo cuando un paciente reserva (mismo SMTP)
async function sendNotificationToPsychologist(appointment) {
  try {
    const businessConfig = await getBusinessConfig();
    const businessName = businessConfig.businessName || config.businessName;
    const businessEmail = businessConfig.businessEmail || config.businessEmail;

    if (!businessEmail) {
      console.warn('No hay email del negocio configurado; no se envía notificación al psicólogo.');
      return false;
    }

    const date = new Date(appointment.appointment_date);
    const formattedDate = date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const mailOptions = {
      from: config.emailConfig.from,
      to: businessEmail,
      subject: `Nueva reserva: ${appointment.client_name} - ${formattedDate} ${formattedTime}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2d5016; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #2d5016; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Nueva reserva</h1>
            </div>
            <div class="content">
              <p>Se ha registrado una nueva cita en <strong>${businessName}</strong>.</p>
              <div class="info-box">
                <p><strong>Paciente:</strong> ${appointment.client_name}</p>
                <p><strong>Email:</strong> <a href="mailto:${appointment.client_email}">${appointment.client_email}</a></p>
                <p><strong>Fecha:</strong> ${formattedDate}</p>
                <p><strong>Hora:</strong> ${formattedTime}</p>
                <p><strong>Duración:</strong> ${appointment.duration} minutos</p>
              </div>
              <p>Revisa tu panel de citas para más detalles.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await sendOneEmail(mailOptions.from, mailOptions.to, mailOptions.subject, mailOptions.html);
    console.log(`✅ Notificación de nueva reserva enviada a ${businessEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando notificación al psicólogo:', error);
    return false;
  }
}

// Enviar email de prueba (Resend o SMTP según RESEND_API_KEY)
async function sendTestEmail(toEmail) {
  try {
    const fromAddress = useResend
      ? (process.env.EMAIL_FROM || 'onboarding@resend.dev')
      : (config.smtpConfig.auth.user || config.emailConfig.from);
    const html = `
      <p>Este es un email de prueba.</p>
      <p>Si lo recibes, el envío está configurado correctamente (Resend o SMTP).</p>
      <ul>
        <li>Confirmaciones de reserva a los pacientes</li>
        <li>Notificaciones de nueva reserva al psicólogo</li>
      </ul>
      <p>Enviado desde el sistema de reservas.</p>
    `;
    await sendOneEmail(fromAddress, toEmail, 'Prueba de email - Sistema de reservas', html);
    console.log(`✅ Email de prueba enviado a ${toEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de prueba:', error);
    throw error;
  }
}

module.exports = {
  sendConfirmationEmail,
  sendReminderEmail,
  sendNotificationToPsychologist,
  sendTestEmail,
  getTransporter
};
