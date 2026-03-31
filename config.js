/**
 * CONFIGURACIÓN CENTRAL DEL NEGOCIO
 * 
 * Personaliza estos valores para tu negocio.
 * También puedes modificar estos valores desde el dashboard una vez iniciado sesión.
 */

module.exports = {
  // Información del negocio (pueden sobrescribirse con variables de entorno o desde el dashboard)
  businessName: process.env.BUSINESS_NAME || "Mario Personal Trainer",
  businessPhone: process.env.BUSINESS_PHONE || "+34 600 000 000",
  businessEmail: process.env.BUSINESS_EMAIL || "contacto@mariopersonaltrainer.es",
  
  // Configuración de citas
  appointmentDuration: 50, // Duración por defecto en minutos (configurable desde dashboard)
  
  // Horarios de atención (configurables desde dashboard)
  // Formato: { day: [start, end], ... }
  // day: 0=Domingo, 1=Lunes, 2=Martes, ..., 6=Sábado
  // Puedes tener múltiples rangos por día: [[9, 14], [16, 20]]
  openingHours: {
    1: [[9, 14], [16, 20]],  // Lunes: 9-14 y 16-20
    2: [[9, 14], [16, 20]],  // Martes: 9-14 y 16-20
    3: [[9, 14], [16, 20]],  // Miércoles: 9-14 y 16-20
    4: [[9, 14], [16, 20]],  // Jueves: 9-14 y 16-20
    5: [[9, 14], [16, 20]],  // Viernes: 9-14 y 16-20
    // 0: [], // Domingo cerrado
    // 6: []  // Sábado cerrado
  },
  
  // Configuración SMTP para envío de emails (pueden sobrescribirse con variables de entorno)
  smtpConfig: {
    host: process.env.SMTP_HOST || "smtp.gmail.com", // Cambia según tu proveedor
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true' || false, // true para 465, false para otros puertos
    auth: {
      user: process.env.SMTP_USER || "tu-email@gmail.com", // Tu email
      pass: process.env.SMTP_PASS || "tu-contraseña-app" // Contraseña de aplicación (no la normal)
    }
  },
  
  // Configuración de emails (Gmail exige que "from" = cuenta que hace login; si no, rechaza)
  emailConfig: {
    from: process.env.SMTP_USER || process.env.EMAIL_FROM || "contacto@tudominio.com", // Remitente = SMTP_USER en Gmail
    reminderDaysBefore: parseInt(process.env.REMINDER_DAYS_BEFORE) || 1, // Días antes de la cita para enviar recordatorio
  },
  
  // Zona horaria
  timezone: "Europe/Madrid",
  
  // Configuración del servidor
  port: parseInt(process.env.PORT) || 3000,
  sessionSecret: process.env.SESSION_SECRET || "cambia-este-secreto-en-produccion", // Cambiar en producción
  
  // Configuración de seguridad
  maxLoginAttempts: 5,
  lockoutTime: 15 * 60 * 1000 // 15 minutos en milisegundos
};
