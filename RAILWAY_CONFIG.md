# 🚂 Configuración de Railway - Solución al Error de Vulnerabilidades

## ⚠️ Problema Resuelto

Railway estaba leyendo el `package-lock.json` de la raíz del repositorio (que contiene dependencias de otros proyectos como Next.js). 

**Solución:** Se ha generado un `package-lock.json` específico para este proyecto y se ha configurado Railway para usar el subdirectorio correcto.

## 📋 Pasos para Configurar Railway Correctamente

### Paso 1: Conectar el Repositorio

1. Ve a [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub repo**
3. Selecciona: `Arroyador69/webs-de-reservas`

### Paso 2: Configurar el Root Directory (MUY IMPORTANTE)

**Esto es CRÍTICO** - Railway debe saber que el proyecto está en un subdirectorio:

1. En Railway, ve a tu servicio
2. Haz clic en **Settings** (⚙️)
3. Busca la sección **"Root Directory"** o **"Working Directory"**
4. Pon exactamente: `webs de reservas`
5. Guarda los cambios

**Alternativa si no ves "Root Directory":**
- Ve a **Settings** → **Service**
- En **"Build Command"**, cambia a:
  ```bash
  cd "webs de reservas" && npm install
  ```
- En **"Start Command"**, cambia a:
  ```bash
  cd "webs de reservas" && npm start
  ```

### Paso 3: Variables de Entorno

Ve a **Variables** y añade:

**OBLIGATORIO:**
```bash
SESSION_SECRET=genera-un-secreto-muy-largo-y-aleatorio-aqui
```

**Para generar SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Opcionales (si no las pones, se usan los valores de config.js):**
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

### Paso 4: Verificar el Despliegue

1. Railway debería detectar automáticamente Node.js
2. El build debería usar el `package-lock.json` del subdirectorio `webs de reservas`
3. No debería aparecer el error de vulnerabilidades de Next.js

### Paso 5: Crear el Primer Usuario

Una vez desplegado:

1. En Railway → **View Logs** → Abre la terminal
2. Ejecuta:
   ```bash
   cd "webs de reservas"
   node utils/create-first-user.js
   ```
3. Sigue las instrucciones

## ✅ Verificación

Si todo está bien configurado, deberías ver en los logs de Railway:

```
✅ Instalando dependencias desde webs de reservas/package.json
✅ No hay vulnerabilidades de Next.js
✅ Servidor iniciado correctamente
```

## 🔍 Si Sigue Apareciendo el Error

Si Railway sigue detectando vulnerabilidades de Next.js:

1. **Verifica el Root Directory** - Debe ser exactamente `webs de reservas`
2. **Elimina y vuelve a crear el servicio** en Railway
3. **Asegúrate de que el `package-lock.json` esté en `webs de reservas/`** (ya está hecho ✅)

## 📝 Notas Importantes

- El `package-lock.json` en la raíz del repo es de otro proyecto (Delfín Check-in)
- Railway debe usar el `package-lock.json` de `webs de reservas/`
- La configuración de Root Directory es esencial para que funcione

---

¿Problemas? Verifica que el Root Directory esté configurado correctamente.
