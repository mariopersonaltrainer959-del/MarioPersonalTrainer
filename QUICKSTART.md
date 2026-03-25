# 🚀 Inicio Rápido

Guía rápida para poner en marcha tu web de reservas en 5 minutos.

## Paso 1: Instalar dependencias

```bash
npm install
```

## Paso 2: Configurar tu negocio

Edita `config.js` y cambia:
- `businessName`: Nombre de tu negocio
- `businessPhone`: Tu teléfono
- `businessEmail`: Tu email
- `smtpConfig`: Configuración de tu email (ver abajo)

## Paso 3: Configurar Email (Gmail ejemplo)

1. Ve a tu cuenta de Google → Seguridad
2. Activa verificación en 2 pasos
3. Genera una "Contraseña de aplicación"
4. En `config.js`, pon:
   ```javascript
   smtpConfig: {
     host: "smtp.gmail.com",
     port: 587,
     secure: false,
     auth: {
       user: "tu-email@gmail.com",
       pass: "la-contraseña-de-aplicación-generada"
     }
   }
   ```

## Paso 4: Inicializar base de datos

```bash
node database/init.js
```

## Paso 5: Crear usuario del dashboard

```bash
node utils/create-user.js
```

Sigue las instrucciones para crear tu usuario.

## Paso 6: Iniciar servidor

```bash
npm start
```

## ✅ ¡Listo!

- **Landing pública**: http://localhost:3000
- **Dashboard**: http://localhost:3000/dashboard

## 📝 Próximos pasos

1. Inicia sesión en el dashboard
2. Configura tus horarios de atención
3. Ajusta la duración de las citas si lo necesitas
4. Prueba hacer una reserva desde la landing pública

## 🔄 Para duplicar para otro cliente

1. Copia toda la carpeta
2. Edita `config.js` con los nuevos datos
3. Ejecuta `npm install`, `node database/init.js`, `node utils/create-user.js`
4. ¡Listo!

---

¿Problemas? Revisa el `README.md` completo para más detalles.
