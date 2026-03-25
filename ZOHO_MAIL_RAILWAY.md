# Configurar Zoho Mail (contacto@delfincheckin.com) para el MVP de reservas

Guía paso a paso para enviar los emails de confirmación desde **Zoho Mail** con tu dominio en **Porkbun**. Así cualquier cliente que rellene la landing recibirá el correo en el email que haya puesto.

---

## ⚠️ Importante: Railway plan Hobby y SMTP

**En el plan Hobby (y Free/Trial), Railway bloquea las conexiones SMTP** (puertos 465 y 587). Por eso al enviar el email de prueba puede salir **"Connection timeout"**: no es fallo de la landing ni de Zoho; es que Railway no permite salida por SMTP en ese plan.

Tienes dos opciones para que los mails funcionen:

1. **Usar Resend (recomendado en Hobby)**  
   Resend usa **HTTPS**, no SMTP, así que funciona en todos los planes de Railway. Puedes verificar tu dominio **delfincheckin.com** en Resend y enviar desde **contacto@delfincheckin.com** (o reservas@…). En Railway: pon **RESEND_API_KEY** y **EMAIL_FROM** = contacto@delfincheckin.com; quita las variables SMTP. La guía de Resend + dominio está en **EMAIL_SIN_DOMINIO.md**.

2. **Pasar a Railway Pro**  
   En Pro, SMTP (Zoho, Gmail, etc.) sí está permitido. Puedes seguir entonces con la configuración SMTP de esta guía.

**Resend con tu dominio:** En [resend.com](https://resend.com) → Domains → Add **delfincheckin.com** → añade en Porkbun los registros TXT que te pida Resend. Luego en Railway: **RESEND_API_KEY** + **EMAIL_FROM** = `contacto@delfincheckin.com`. Los correos saldrán desde contacto@delfincheckin.com por API (sin SMTP). Ver **EMAIL_SIN_DOMINIO.md**.

Si ves "Connection timeout" al probar el email, es por lo anterior. El fallo no está en la landing.

---

## Resumen

- **Dominio:** delfincheckin.com  
- **DNS:** Porkbun  
- **Correo:** Zoho Mail (contacto@delfincheckin.com)  
- **App:** Variables de entorno en Railway (SMTP)

Si ya usas Zoho Mail con delfincheckin.com, es posible que parte del DNS ya esté bien. Sigue los pasos y comprueba cada punto.

---

## ¿Resend o solo SMTP? ¿Mismo correo en dos proyectos?

- **Para este MVP:** usa **solo SMTP** (Zoho). No necesitas Resend. En Railway quita la variable `RESEND_API_KEY` y configura las variables SMTP; la app enviará todo por Zoho.
- **Usar el mismo correo (contacto@delfincheckin.com) en otro proyecto:** no hay problema. Puedes tener:
  - Este proyecto (reservas en Railway) enviando por SMTP con contacto@delfincheckin.com.
  - Otro proyecto (Delfin Check-in, etc.) también enviando por SMTP con la misma cuenta.
  Zoho permite varias aplicaciones usando la misma cuenta; no se pisan. Lo que sí conviene es **no reutilizar la misma contraseña de aplicación**: crea una **contraseña de app distinta** para este proyecto (ej. "Reservas MVP") y otra para el otro. Así si alguna se filtra, revocas solo esa y el resto sigue igual.
- **Límites:** Zoho tiene límites de envío por cuenta/día. Con dos proyectos que envían poco (confirmaciones, notificaciones), no suele haber conflicto. Si en el futuro envías mucho desde ambos, revisa los límites de tu plan Zoho.

---

## Parte 1: Zoho Mail (contraseña de aplicación)

Para que Railway pueda enviar por SMTP con tu cuenta Zoho, no puedes usar la contraseña normal: hay que crear una **contraseña de aplicación**.

1. Entra en **https://accounts.zoho.com** (o **https://accounts.zoho.eu** si tu cuenta es Europa) e inicia sesión.
2. Ve a **Seguridad** (o **Security**) → **Contraseñas de aplicaciones** (o **App Passwords**).
3. Pulsa **Generar nueva contraseña** (Generate New Password).
4. Pon un nombre que identifique **este** proyecto, por ejemplo: **Reservas MVP** o **Railway reservas**. (Si ya tienes otra contraseña de app para el otro proyecto, no reutilices esa; crea una nueva para este.)
5. **Copia la contraseña** en cuanto aparezca (solo se muestra una vez). Guárdala para el paso de Railway.

Si no ves “Contraseñas de aplicaciones”, comprueba si tienes **verificación en dos pasos** activada en Zoho; suele ser obligatoria para poder generar contraseñas de app.

---

## Parte 2: DNS en Porkbun (para que Zoho pueda enviar)

En Porkbun gestionas el DNS de **delfincheckin.com**. Zoho necesita que existan ciertos registros para que el envío sea fiable (menos spam, menos rechazos).

### 2.1 Entrar en DNS de Porkbun

1. Entra en **https://porkbun.com** e inicia sesión.
2. Ve a **Dominios** (Domains) → haz clic en **delfincheckin.com**.
3. Busca la sección **Registros DNS** / **DNS Records** (o “Edit DNS” / “Manage DNS”).

### 2.2 Registros que debe tener Zoho (comprobar o añadir)

Zoho suele pedir algo de lo siguiente cuando configuras el dominio en Zoho Mail. Si **ya tienes Zoho Mail funcionando** con contacto@delfincheckin.com (recibes correo), es muy probable que **MX** y a veces **SPF** ya estén. Revisa que no falte nada.

- **MX (recepción)**  
  - Si ya recibes correo en contacto@delfincheckin.com, los MX ya apuntan a Zoho. No los borres.  
  - Valores típicos Zoho (ejemplo):  
    - Prioridad **10** → `mx.zoho.com`  
    - Prioridad **20** → `mx2.zoho.com`  
  - En Europa (Zoho EU) pueden ser `mx.zoho.eu` y `mx2.zoho.eu`. Comprueba en la ayuda de Zoho Mail para tu región.

- **SPF (envío)**  
  - Un solo registro **TXT** en el nombre **@** (o **delfincheckin.com**).  
  - Valor típico para Zoho:  
    `v=spf1 include:zohomail.com ~all`  
  - Si Zoho te indica otro (por ejemplo `include:zoho.com`), usa el que diga la documentación de Zoho.  
  - Si ya existe un SPF, **no dupliques** otro registro SPF; edita el existente y añade `include:zohomail.com` (o el que indique Zoho) si no está.

- **DKIM (opcional pero recomendado)**  
  - Zoho te da un **nombre** y un **valor** largo (clave pública) en el panel de Zoho Mail (configuración del dominio).  
  - En Porkbun creas un registro **TXT** con ese nombre y ese valor.  
  - Si no lo tienes, puedes añadirlo más tarde desde la consola de administración de Zoho Mail (dominios / autenticación).

Después de tocar DNS, los cambios pueden tardar unos minutos (o hasta 24–48 h en casos raros). Puedes comprobar con herramientas como [mxtoolbox.com](https://mxtoolbox.com) (SPF, MX) cuando quieras.

---

## Parte 3: Variables en Railway (SMTP con Zoho)

Aquí le dices a tu app que use Zoho para enviar y que el “remitente” sea contacto@delfincheckin.com.

1. Entra en **Railway** → tu proyecto **Sistema de reservas** → servicio **web**.
2. Abre la pestaña **Variables** (Variables).
3. **Quita** la variable **RESEND_API_KEY** si la tienes (para que la app use SMTP y no Resend).
4. Añade o edita estas variables con **estos nombres exactos**:

| Variable       | Valor |
|----------------|--------|
| `SMTP_HOST`    | `smtp.zoho.com` |
| `SMTP_PORT`    | `587` |
| `SMTP_SECURE`  | `false` |
| `SMTP_USER`    | `contacto@delfincheckin.com` |
| `SMTP_PASS`    | La **contraseña de aplicación** que generaste en Zoho (Parte 1) |
| `EMAIL_FROM`   | `contacto@delfincheckin.com` |

Si tu cuenta es **Zoho Europa** (zoho.eu), en la ayuda de Zoho Mail a veces indican otro servidor (por ejemplo para EU). Si te dan uno distinto, pon ese en `SMTP_HOST`; si no, `smtp.zoho.com` suele funcionar igual.

5. Guarda los cambios. Railway redesplegará solo.

No hace falta tocar nameservers: los nameservers se quedan en Porkbun; solo editamos **registros DNS** (MX, TXT, etc.) dentro de Porkbun.

---

## Parte 4: Probar

1. Cuando termine el deploy en Railway, entra en el **dashboard** de tu app.
2. Ve a **Configuración** y usa **“Enviar email de prueba”** al email del negocio (o a otro correo que tengas a mano).
3. Haz una **reserva de prueba** desde la **landing** usando un email distinto (por ejemplo otro tuyo o de un compañero). Ese email debe recibir el correo de confirmación.

Si el correo no llega:

- Revisa **spam** y filtros.
- En Railway → **Deployments** → **View Logs**: busca mensajes como `✅ Email de confirmación enviado a...` o `❌ Error enviando...` para ver si el envío falla.
- Comprueba en Zoho que la **contraseña de aplicación** sea la correcta y que no hayas puesto la contraseña normal de la cuenta.

---

## Resumen rápido

| Dónde   | Qué hacer |
|--------|-----------|
| **Zoho** | Crear contraseña de aplicación (Seguridad → App Passwords). |
| **Porkbun** | Comprobar/añadir MX y SPF (y DKIM si Zoho te lo da) para delfincheckin.com. |
| **Railway** | Quitar RESEND_API_KEY; poner SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_FROM con los valores de Zoho. |
| **Probar** | Email de prueba en el dashboard y una reserva desde la landing a otro email. |

Con esto, los mails del MVP salen desde **contacto@delfincheckin.com** por Zoho y el cliente que rellene la landing recibe la confirmación en el email que haya puesto.
