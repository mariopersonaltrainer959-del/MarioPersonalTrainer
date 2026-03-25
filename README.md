# Plantilla de Reservas para Psicólogos

Plantilla base completa para crear webs de reservas de citas para psicólogos. Diseñada para duplicarse rápidamente cambiando solo datos de configuración.

## 🎯 Características

- ✅ **Configuración centralizada** - Todo configurable desde `config.js` o dashboard
- ✅ **Landing pública** - Diseño limpio y profesional
- ✅ **Sistema de reservas** - Formulario intuitivo con validación de disponibilidad
- ✅ **Confirmación por email** - Envío automático de confirmaciones
- ✅ **Recordatorios automáticos** - Sistema de recordatorios por email
- ✅ **Dashboard privado** - Gestión completa de citas, horarios y configuración
- ✅ **Bloqueo de horarios** - Para reservas externas o días no disponibles
- ✅ **Gestión de usuarios** - Crear usuarios del negocio desde el dashboard
- ✅ **Horarios configurables** - Define tus horarios por día de la semana
- ✅ **Duración flexible** - Configura la duración de las citas (20 min, 50 min, etc.)

## 📋 Requisitos Previos

- Node.js 14 o superior
- npm o yarn
- Cuenta de email SMTP (Gmail, Outlook, etc.)

## 🚀 Instalación Rápida

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar el negocio

Edita el archivo `config.js` con los datos de tu negocio:

```javascript
businessName: "Psicología [Tu Nombre]",
businessPhone: "+34 600 000 000",
businessEmail: "contacto@tudominio.com",
appointmentDuration: 50, // minutos
// ... más configuración
```

### 3. Configurar SMTP para emails

En `config.js`, configura tu proveedor de email:

```javascript
smtpConfig: {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "tu-email@gmail.com",
    pass: "tu-contraseña-app" // Contraseña de aplicación, NO la contraseña normal
  }
}
```

**Nota para Gmail:** Necesitas crear una "Contraseña de aplicación" desde tu cuenta de Google:
1. Ve a tu cuenta de Google → Seguridad
2. Activa la verificación en 2 pasos
3. Genera una "Contraseña de aplicación"
4. Usa esa contraseña en `config.js`

### 4. Inicializar la base de datos

```bash
node database/init.js
```

Esto creará la base de datos SQLite con todas las tablas necesarias.

### 5. Crear el primer usuario

```bash
node utils/create-user.js
```

Sigue las instrucciones para crear el primer usuario que tendrá acceso al dashboard.

### 6. Iniciar el servidor

```bash
npm start
```

O en modo desarrollo (con auto-reload):

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

## 📖 Uso

### Landing Pública

Los clientes pueden acceder a `http://localhost:3000` y:
- Ver información del negocio
- Reservar citas seleccionando fecha y hora disponible
- Recibir confirmación por email automáticamente

### Dashboard

Accede a `http://localhost:3000/dashboard` e inicia sesión con las credenciales creadas.

**Pestañas del Dashboard:**

1. **Citas** - Ver, filtrar y cancelar citas
2. **Configuración** - Modificar datos del negocio y duración de citas
3. **Horarios** - Configurar horarios de atención por día de la semana
4. **Bloqueos** - Bloquear horarios específicos (para reservas externas)
5. **Usuarios** - Crear nuevos usuarios del negocio

## ⚙️ Configuración Avanzada

### Horarios de Atención

Desde el dashboard, puedes configurar horarios por día:
- Múltiples rangos por día (ej: 9-14 y 16-20)
- Días cerrados simplemente dejándolos vacíos
- Los cambios se aplican inmediatamente

### Duración de Citas

Configura la duración desde el dashboard o `config.js`:
- Mínimo recomendado: 15 minutos
- Ejemplos comunes: 20 min (consultas cortas), 50 min (sesión estándar), 60 min (sesión extendida)

### Bloqueo de Horarios

Si tienes reservas fuera del sistema o días no disponibles:
1. Ve a la pestaña "Bloqueos"
2. Define fecha/hora de inicio y fin
3. Opcionalmente añade un motivo
4. Esos horarios quedarán bloqueados automáticamente

### Recordatorios Automáticos

El sistema puede enviar recordatorios automáticos. Para activarlos:

1. Configura `reminderDaysBefore` en `config.js` (por defecto: 1 día antes)

2. Ejecuta el script de recordatorios diariamente:
   ```bash
   node utils/send-reminders.js
   ```

3. Para automatizarlo, configura un cron job (Linux/Mac) o Task Scheduler (Windows):
   ```bash
   # Ejemplo cron: ejecutar todos los días a las 9 AM
   0 9 * * * cd /ruta/al/proyecto && node utils/send-reminders.js
   ```

## 🔒 Seguridad

- Las contraseñas se almacenan con hash bcrypt
- Las rutas del dashboard están protegidas con sesiones
- Solo usuarios autenticados pueden crear nuevos usuarios
- Validación de solapamientos de citas
- Validación de formularios en frontend y backend

## 📁 Estructura del Proyecto

```
/
├── config.js              # Configuración central del negocio
├── server.js              # Servidor Express principal
├── package.json           # Dependencias del proyecto
├── README.md              # Esta documentación
├── database/
│   └── init.js            # Script de inicialización de BD
├── routes/
│   ├── public.js          # Rutas públicas (landing, reservas)
│   ├── auth.js            # Rutas de autenticación
│   └── dashboard.js       # Rutas protegidas del dashboard
├── middleware/
│   └── auth.js            # Middleware de autenticación
├── utils/
│   ├── db.js              # Utilidades de base de datos
│   ├── email.js           # Configuración y envío de emails
│   ├── helpers.js         # Funciones auxiliares
│   ├── create-user.js    # Script para crear usuarios
│   └── send-reminders.js  # Script de recordatorios
└── views/
    ├── index.html         # Landing pública
    ├── login.html         # Página de login
    └── dashboard.html     # Dashboard principal
```

## 🚢 Despliegue en Producción

### ⚡ Opción Recomendada: Railway

**Railway es la mejor opción** para esta aplicación porque:
- ✅ Soporta SQLite perfectamente (almacenamiento persistente)
- ✅ Despliegue automático desde GitHub
- ✅ Plan gratuito generoso
- ✅ Muy fácil de configurar
- ✅ HTTPS automático

**📖 Guía completa de despliegue**: Ver [DEPLOY.md](./DEPLOY.md)

**Resumen rápido:**
1. Sube tu código a GitHub
2. Crea cuenta en [railway.app](https://railway.app)
3. Conecta tu repositorio
4. Configura variables de entorno (ver DEPLOY.md)
5. ¡Listo!

### Otras Opciones

- **Render**: Similar a Railway, también funciona bien con SQLite
- **Fly.io**: Buena opción alternativa
- **VPS propio**: Más control pero requiere más configuración

### Checklist de Producción

- [ ] Cambiar `SESSION_SECRET` por un valor seguro y aleatorio
- [ ] Configurar variables de entorno (no hardcodear credenciales)
- [ ] Configurar HTTPS (Railway/Render lo hacen automáticamente)
- [ ] Configurar backup de la base de datos
- [ ] Configurar cron job para recordatorios
- [ ] Probar envío de emails
- [ ] Configurar dominio personalizado

### Variables de Entorno Disponibles

El proyecto ya soporta variables de entorno. Puedes configurarlas en tu plataforma de hosting:

```bash
BUSINESS_NAME="Psicología [Tu Nombre]"
BUSINESS_PHONE="+34 600 000 000"
BUSINESS_EMAIL="contacto@tudominio.com"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="tu-email@gmail.com"
SMTP_PASS="tu-contraseña-app"
EMAIL_FROM="contacto@tudominio.com"
SESSION_SECRET="genera-un-secreto-aleatorio-muy-largo-y-seguro"
REMINDER_DAYS_BEFORE="1"
```

**Para generar SESSION_SECRET seguro:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🔄 Duplicar para Otro Cliente

Para crear una nueva web para otro psicólogo:

1. **Copia toda la carpeta del proyecto**
2. **Edita `config.js`** con los nuevos datos:
   - Nombre del negocio
   - Teléfono
   - Email
   - Horarios iniciales
   - Configuración SMTP
3. **Ejecuta la inicialización**:
   ```bash
   npm install
   node database/init.js
   node utils/create-user.js
   ```
4. **¡Listo!** Ya tienes una web funcional para el nuevo cliente

## 🐛 Solución de Problemas

### Error: "Cannot find module"
- Ejecuta `npm install` para instalar dependencias

### Error al enviar emails
- Verifica la configuración SMTP en `config.js`
- Para Gmail, asegúrate de usar una "Contraseña de aplicación"
- Verifica que el puerto y host sean correctos

### No aparecen horarios disponibles
- Verifica que los horarios estén configurados en el dashboard
- Asegúrate de que la fecha seleccionada no sea en el pasado
- Revisa si hay bloqueos activos para esa fecha

### Error de sesión
- Verifica que `sessionSecret` esté configurado
- En producción, asegúrate de usar HTTPS y `secure: true` en cookies

## 📝 Licencia

MIT License - Siéntete libre de usar y modificar este proyecto.

## 🤝 Soporte

Si encuentras algún problema o tienes sugerencias, puedes:
- Revisar los logs del servidor
- Verificar la configuración en `config.js`
- Comprobar que la base de datos esté inicializada correctamente

---

**¡Listo para usar!** 🎉

Duplica este proyecto, configura los datos del negocio, y tendrás una web de reservas funcional en minutos.
