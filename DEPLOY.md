# 🚀 Guía de Despliegue

Guía completa para desplegar tu web de reservas en producción.

## 🎯 Opción Recomendada: Railway

**Railway** es la mejor opción porque:
- ✅ Soporta SQLite perfectamente (almacenamiento persistente)
- ✅ Despliegue automático desde GitHub
- ✅ Plan gratuito generoso ($5 gratis al mes)
- ✅ Muy fácil de configurar
- ✅ HTTPS automático
- ✅ Variables de entorno fáciles de gestionar

### Paso 1: Preparar el código

1. Asegúrate de tener todo en un repositorio de GitHub
2. El proyecto ya incluye `railway.json` y `Procfile` necesarios

### Paso 2: Crear cuenta en Railway

1. Ve a [railway.app](https://railway.app)
2. Regístrate con GitHub (recomendado)
3. Conecta tu cuenta de GitHub

### Paso 3: Desplegar el proyecto

1. En Railway, haz clic en **"New Project"**
2. Selecciona **"Deploy from GitHub repo"**
3. Elige tu repositorio
4. Railway detectará automáticamente que es Node.js
5. El despliegue comenzará automáticamente

### Paso 4: Configurar variables de entorno

En Railway, ve a tu proyecto → **Variables** y añade:

```
BUSINESS_NAME=Psicología [Tu Nombre]
BUSINESS_PHONE=+34 600 000 000
BUSINESS_EMAIL=contacto@tudominio.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-contraseña-de-aplicación
EMAIL_FROM=contacto@tudominio.com
SESSION_SECRET=genera-un-secreto-aleatorio-aqui-muy-largo-y-seguro
REMINDER_DAYS_BEFORE=1
```

**Para generar SESSION_SECRET seguro:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Paso 5: Crear el primer usuario

Una vez desplegado, necesitas crear el primer usuario para acceder al dashboard.

**Opción A: Desde Railway (recomendado)**
1. En Railway, ve a tu servicio → **Deploy Logs**
2. Haz clic en el botón **"View Logs"** o **"Open Terminal"**
3. Ejecuta: `node utils/create-first-user.js`
4. Sigue las instrucciones para crear tu usuario

**Opción B: Desde tu máquina local (si tienes acceso SSH)**
1. Conecta a Railway via CLI: `railway login` y `railway link`
2. Ejecuta: `railway run node utils/create-first-user.js`

**Nota**: El script `create-first-user.js` solo crea un usuario si la BD está vacía, así que es seguro ejecutarlo múltiples veces.

### Paso 6: Configurar dominio personalizado (opcional)

1. En Railway → **Settings** → **Domains**
2. Añade tu dominio personalizado
3. Configura los DNS según las instrucciones de Railway

### Paso 7: Configurar recordatorios automáticos

Railway tiene un sistema de cron jobs. Para activar recordatorios:

1. Ve a **Settings** → **Cron Jobs**
2. Añade un nuevo cron:
   - **Schedule**: `0 9 * * *` (todos los días a las 9 AM)
   - **Command**: `node utils/send-reminders.js`

O usa un servicio externo como [cron-job.org](https://cron-job.org) que llame a tu endpoint.

---

## 🔄 Alternativa: Render

**Render** es similar a Railway y también funciona muy bien.

### Pasos en Render:

1. Ve a [render.com](https://render.com)
2. Crea una cuenta
3. **New** → **Web Service**
4. Conecta tu repositorio de GitHub
5. Configura:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Añade las mismas variables de entorno que en Railway
7. Despliega

**Nota**: Render también soporta SQLite y tiene almacenamiento persistente.

---

## 📊 Comparación de Opciones

| Plataforma | SQLite | Precio | Facilidad | Recomendado |
|------------|--------|--------|-----------|-------------|
| **Railway** | ✅ Sí | Gratis/$5 | ⭐⭐⭐⭐⭐ | ✅ **SÍ** |
| **Render** | ✅ Sí | Gratis/$7 | ⭐⭐⭐⭐ | ✅ Sí |
| **Fly.io** | ✅ Sí | Gratis | ⭐⭐⭐ | Opcional |
| **Heroku** | ✅ Sí | $7+ | ⭐⭐⭐ | Caro |

---

## 🔐 Seguridad en Producción

### Checklist antes de lanzar:

- [ ] Cambiar `SESSION_SECRET` por un valor seguro y aleatorio
- [ ] Configurar HTTPS (Railway lo hace automáticamente)
- [ ] Verificar que las cookies de sesión usen `secure: true` (ya configurado)
- [ ] No exponer credenciales SMTP en el código
- [ ] Configurar backup de la base de datos (Railway tiene backups automáticos)
- [ ] Probar envío de emails
- [ ] Verificar que los horarios funcionen correctamente

---

## 💾 Backup de Base de Datos

### Railway:
- Railway hace backups automáticos
- Puedes descargar la BD desde el dashboard

### Manual:
```bash
# Descargar la BD desde Railway
railway run cat database.db > backup.db

# O desde el dashboard de Railway
# Settings → Database → Download
```

---

## 🚨 Migración Futura a PostgreSQL (si escalas)

Si en el futuro necesitas más potencia, puedes migrar a PostgreSQL:

1. **Railway** también ofrece PostgreSQL como servicio
2. Cambiarías `sqlite3` por `pg` (PostgreSQL)
3. Los cambios en el código serían mínimos (solo las queries SQL)

Pero para empezar, **SQLite es perfecto** y mucho más simple.

---

## 📝 Resumen Rápido

**Para empezar AHORA:**

1. ✅ Sube tu código a GitHub
2. ✅ Crea cuenta en Railway
3. ✅ Conecta repositorio
4. ✅ Configura variables de entorno
5. ✅ Crea primer usuario
6. ✅ ¡Listo!

**Tiempo estimado**: 10-15 minutos

---

¿Necesitas ayuda con algún paso específico? ¡Pregunta!
