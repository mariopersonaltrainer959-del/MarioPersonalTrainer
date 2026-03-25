# Enviar emails sin tener dominio propio

Puedes usar el sistema de confirmación (al paciente) y de notificación (al psicólogo) **sin comprar ningún dominio**. Dos opciones recomendadas:

---

## Opción 1: Gmail (recomendada para empezar)

No necesitas dominio. Usas una cuenta de Gmail como remitente (ej. una cuenta solo para este proyecto).

### Pasos

1. **Crea una cuenta Gmail** (o usa una existente), por ejemplo: `tureservas.psicologos@gmail.com`.

2. **Activa verificación en 2 pasos** en esa cuenta:
   - Google → Cuenta → Seguridad → Verificación en 2 pasos → Activar.

3. **Genera una contraseña de aplicación**:
   - Google → Cuenta → Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones.
   - Crear → Nombre: "Reservas Railway" → Copiar la contraseña de 16 caracteres.

4. **En Railway** (o en tu `.env` local), configura estas variables:

   | Variable     | Valor |
   |-------------|--------|
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_SECURE` | `false` |
   | `SMTP_USER` | `tureservas.psicologos@gmail.com` |
   | `SMTP_PASS` | La contraseña de aplicación de 16 caracteres |
   | `EMAIL_FROM` | Mismo que `SMTP_USER` (Gmail exige que el remitente sea la cuenta con la que te autenticas). Si pones otro, Gmail puede rechazar el envío. |

5. **En el dashboard** del psicólogo, el **Email del negocio** debe ser el correo donde quieras recibir la notificación de nuevas reservas (puede ser el mismo Gmail u otro). El **email de prueba** del dashboard se envía a la dirección que tengas en `EMAIL_FROM` (en Railway) si está definida; si no, al email del negocio guardado arriba.

### Ventajas

- Gratis.
- Sin dominio.
- Los correos llegan desde ese Gmail (ej. `tureservas.psicologos@gmail.com`).
- Límite aproximado: 500 envíos/día con cuenta gratuita (suele sobrar para demos y pocos clientes).

### Importante

- **SMTP_PASS** debe ser la **contraseña de aplicación**, no la contraseña normal de la cuenta.
- Si el cliente final quiere que los emails salgan “de su negocio”, puede usar *su* Gmail y poner su email en Configuración del negocio; el sistema ya usa el mismo SMTP para paciente y psicólogo.

---

## Opción 2: Resend (API, sin SMTP) — recomendada en Railway

Servicio de envío por **API HTTPS**. Plan gratuito generoso; no depende de SMTP, así que evita timeouts en entornos como **Railway** (donde Gmail SMTP suele dar *connection timeout*).

### Pasos

1. Regístrate en [resend.com](https://resend.com).

2. **Dominio:**  
   - **Pruebas:** puedes enviar desde `onboarding@resend.dev` (solo a tu email de registro).  
   - **Producción:** en el dashboard de Resend añade y verifica tu dominio; luego el “from” será por ejemplo `reservas@tudominio.com`.

3. Crea una **API Key** en Resend (API Keys → Create API Key) y cópiala.

4. **En Railway** (Variables del proyecto), añade:
   - `RESEND_API_KEY` = la API Key de Resend.  
   - `EMAIL_FROM` = remitente que vaya a usar (ej. `onboarding@resend.dev` para pruebas o `reservas@tudominio.com` si verificaste dominio).

5. **Importante:** Si está definida `RESEND_API_KEY`, la app envía **todos** los correos (prueba, confirmación al paciente, notificación al psicólogo) por Resend. No hace falta configurar SMTP en ese caso.

### Ventajas

- No usa SMTP: evita bloqueos y timeouts en Railway.
- Plan gratuito suficiente para demos y pocos clientes.
- Sin dominio puedes probar con `onboarding@resend.dev`; con dominio verificado, correos “de tu negocio”.

---

## Resumen

| Opción | Dominio | Coste | Dificultad |
|--------|--------|--------|------------|
| **Gmail** | No hace falta | Gratis | Baja (solo variables de entorno). Puede dar timeout en Railway. |
| **Resend** | No obligatorio (pruebas con `onboarding@resend.dev`) | Plan gratis | Baja: solo `RESEND_API_KEY` + `EMAIL_FROM` en Railway. |

**Si desplegaste en Railway:** usa **Resend** (añade `RESEND_API_KEY` y `EMAIL_FROM`) para evitar timeouts de SMTP. Para pruebas sin dominio, `EMAIL_FROM=onboarding@resend.dev`.  
**Si corres en local o en un VPS donde SMTP funciona:** Gmail con contraseña de aplicación sigue siendo válido (mismas variables SMTP + `EMAIL_FROM`).
