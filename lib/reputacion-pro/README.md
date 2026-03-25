# ReputacionPro

Módulo de solicitudes de reseña automáticas tras cita completada. Pensado para psicólogos que quieren reforzar su perfil en Google.

## Flujo

1. El profesional configura en el panel el **enlace a su perfil de Google** (Reputación → Guardar configuración).
2. Cuando una cita se marca como **Completada**, se programa un job para **3 horas después**.
3. Pasadas 3 horas se envía al paciente un email con asunto *"Tu opinión puede ayudar a otras personas"* y un botón **Valorar experiencia** que enlaza a `/feedback/:sessionId`.
4. En la página de feedback el paciente valora con 1–5 estrellas:
   - **4–5**: mensaje de agradecimiento y botón **Dejar reseña en Google** (redirige al enlace configurado y registra el clic).
   - **1–3**: mensaje de disculpa y formulario de comentario (obligatorio); se guarda en `review_requests` sin redirigir a Google.
5. En el panel, pestaña **Reputación**, se muestran: solicitudes enviadas este mes, valoraciones recibidas, clics a Google y media de valoración.

## Estructura

- **config.js**: Lectura/escritura de `google_review_url` y `reputacion_activa` en `negocio`.
- **email.js**: Construcción y envío del email de solicitud de reseña (usa SMTP del negocio o Resend).
- **jobs.js**: Programación del job a 3h (`reputacion_jobs`) y procesamiento de jobs vencidos (envío del email y creación de `review_requests`).
- **stats.js**: Cálculo de estadísticas del mes para el dashboard.
- **feedback.js**: Validación de `sessionId`, registro de valoración y de clic a Google (sin exponer datos sensibles).

## Base de datos

- **negocio**: `google_review_url`, `reputacion_activa`.
- **review_requests**: `session_id`, `professional_id`, `email_enviado`, `rating`, `redirigido_a_google`, `comentario`, `fecha`.
- **reputacion_jobs**: `cita_id`, `negocio_id`, `programado_para`, `enviado`.
- **citas**: estado `completada` añadido a los permitidos.

## Seguridad

- Se valida que el `sessionId` corresponda a una cita existente.
- No se permite modificar una valoración ya enviada.
- En la página de feedback no se exponen datos sensibles del paciente.

## Futura integración Google Business Profile API

El diseño permite sustituir o complementar el enlace manual por `place_id` y uso de la API de Google (obtención de enlace de reseña, envío de métricas, etc.) sin cambiar la lógica de jobs, email ni feedback.
