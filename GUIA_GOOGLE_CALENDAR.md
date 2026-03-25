# Google Calendar: guía de uso

Cada profesional puede conectar **su propia** cuenta de Google. Las reservas que entren por la web o se creen en el panel se escribirán en su Google Calendar y, opcionalmente, los huecos ocupados en Google no se ofrecerán en la web.

---

## Para el profesional (quien usa el panel)

### 1. Conectar Google Calendar

1. Entra al **panel** → pestaña **Configuración**.
2. Baja hasta la sección **Google Calendar**.
3. Pulsa **«Conectar con Google Calendar»**.
4. Inicia sesión en Google si te lo pide y **acepta** los permisos (crear y ver eventos en el calendario).
5. Volverás al panel y verás **«Conectado»**.

A partir de ahí:

- **Cada reserva nueva** (desde la web o desde el panel) se crea también como evento en tu Google Calendar con el título «Cita: [nombre del paciente]».
- Si **editas** una cita (fecha/hora), el evento en Google se actualiza.
- Si **cancelas o eliminas** una cita, el evento se borra de Google.

### 2. Opción «Viceversa»: no ofrecer huecos ocupados en Google

Si activas la casilla **«Usar también mi Google Calendar para no ofrecer huecos ocupados»**:

- Al calcular los horarios disponibles en la **web pública**, el sistema consulta tu Google Calendar.
- Las horas en las que ya tengas algo (reuniones, otras citas, etc.) **no** se mostrarán como disponibles para reservar.

Así evitas dobles reservas y que la web ofrezca huecos que en la práctica no tienes libres.

### 3. Desconectar

En la misma sección, pulsa **«Desconectar Google Calendar»**. Las reservas ya creadas en Google no se borran; solo dejan de sincronizarse las nuevas.

---

## Para el administrador del sistema (configurar la app)

Para que el botón «Conectar con Google Calendar» funcione, en el servidor deben estar definidas las variables de Google OAuth.

### 1. Crear proyecto y credenciales en Google Cloud

1. Entra en [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un proyecto (o elige uno existente).
3. **APIs y servicios** → **Biblioteca** → busca **Google Calendar API** → **Activar**.
4. **APIs y servicios** → **Credenciales** → **Crear credenciales** → **ID de cliente de OAuth**.
5. Tipo de aplicación: **Aplicación web**.
6. En **URIs de redirección autorizados** añade exactamente la URL de tu app + la ruta del callback, por ejemplo:
   - Local: `http://localhost:3000/dashboard/api/google-calendar/callback`
   - Railway: `https://tu-app.up.railway.app/dashboard/api/google-calendar/callback`
7. Guarda y copia el **ID de cliente** y el **Secreto del cliente**.

### 2. Variables de entorno

En el servidor (Railway, .env, etc.) define:

- **GOOGLE_CLIENT_ID**: ID de cliente de OAuth.
- **GOOGLE_CLIENT_SECRET**: Secreto del cliente.

No hace falta configurar nada por cada profesional: **una sola** app de Google sirve para que todos conecten su propia cuenta.

---

## Resumen

| Acción                         | Nuestro sistema → Google     | Google → nuestro (opcional)      |
|--------------------------------|------------------------------|-----------------------------------|
| Nueva reserva (web o panel)    | Se crea evento en Google     | —                                 |
| Editar cita                    | Se actualiza evento en Google| —                                 |
| Cancelar / eliminar cita       | Se borra evento en Google    | —                                 |
| Horarios ocupados en Google    | —                            | No se ofrecen en la web si activas la opción |

Todo es **universal**: cada cliente conecta su cuenta con un clic y funciona con su propio calendario.
