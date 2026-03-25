# 🚂 Configuración de Railway - Guía Rápida

## Paso 1: Crear cuenta en Railway

1. Ve a [railway.app](https://railway.app)
2. Haz clic en **"Start a New Project"**
3. Selecciona **"Login with GitHub"** (recomendado)
4. Autoriza Railway a acceder a tus repositorios

## Paso 2: Conectar el repositorio

1. En Railway, haz clic en **"New Project"**
2. Selecciona **"Deploy from GitHub repo"**
3. Busca y selecciona: `Arroyador69/webs-de-reservas`
4. Railway detectará automáticamente que es Node.js
5. El despliegue comenzará automáticamente

## Paso 3: Configurar variables de entorno

En Railway, ve a tu proyecto → **Variables** y añade estas variables:

### Variables Obligatorias:

```bash
SESSION_SECRET=genera-un-secreto-aleatorio-muy-largo-y-seguro
```

**Para generar SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Variables Opcionales (si no las pones, se usan los valores de config.js):

```bash
BUSINESS_NAME=Psicología [Tu Nombre]
BUSINESS_PHONE=+34 600 000 000
BUSINESS_EMAIL=contacto@tudominio.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-contraseña-de-aplicación
EMAIL_FROM=contacto@tudominio.com
REMINDER_DAYS_BEFORE=1
```

**Nota sobre SMTP_PASS (Gmail):**
- Ve a tu cuenta de Google → Seguridad
- Activa verificación en 2 pasos
- Genera una "Contraseña de aplicación"
- Usa esa contraseña (NO tu contraseña normal)

## Paso 4: Crear el primer usuario

Una vez desplegado:

1. En Railway, ve a tu servicio
2. Haz clic en **"View Logs"** o busca el botón de terminal
3. Ejecuta: `node utils/create-first-user.js`
4. Sigue las instrucciones para crear tu usuario

## Paso 5: Configurar dominio (opcional)

1. En Railway → **Settings** → **Domains**
2. Haz clic en **"Generate Domain"** para obtener un dominio temporal
3. O añade tu dominio personalizado y configura los DNS

## Paso 6: Verificar que funciona

1. Ve a tu dominio de Railway
2. Deberías ver la landing pública
3. Accede a `/dashboard` e inicia sesión con el usuario creado
4. Configura tus horarios desde el dashboard

## ✅ ¡Listo!

Tu aplicación debería estar funcionando. Cada vez que hagas push a GitHub, Railway desplegará automáticamente los cambios.

## 🔍 Troubleshooting

### El despliegue falla
- Verifica que todas las dependencias estén en `package.json`
- Revisa los logs en Railway

### No puedo crear usuario
- Asegúrate de ejecutar `node utils/create-first-user.js` desde la terminal de Railway
- Verifica que la base de datos se haya inicializado (se hace automáticamente en postinstall)

### Los emails no se envían
- Verifica las credenciales SMTP en las variables de entorno
- Para Gmail, asegúrate de usar una "Contraseña de aplicación"

### La sesión no persiste
- Verifica que `SESSION_SECRET` esté configurado
- Asegúrate de que el dominio tenga HTTPS (Railway lo hace automáticamente)

---

¿Necesitas ayuda? Revisa `DEPLOY.md` para más detalles.
