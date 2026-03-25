# Arquitectura multi-negocio – Sistema de reservas

## Implementado

### 1. Base de datos
- **Tabla `negocio`**: id, nombre, telefono, email, direccion, duracion_cita_default.
- **Tabla `pacientes`**: negocio_id, nombre, email, telefono, fecha_nacimiento, tipo_sesion_habitual, estado, motivo_consulta, notas_privadas, precio_sesion, metodo_pago.
- **Tabla `citas`** (nueva): negocio_id, paciente_id, fecha, hora_inicio, hora_fin, tipo_sesion, estado (confirmada, pendiente, cancelada, pasada, no_asistio), notas.
- **Tablas** `plantillas_email`, `textos_legales`, `consentimientos`.
- Migración automática al arrancar: crea tablas, añade `negocio_id` a users/opening_hours/blocked_slots, inserta negocio por defecto (id=1), migra datos de `appointments` a `pacientes` + `citas`.

### 2. Pacientes (mini CRM)
- CRUD: list (filtros estado/búsqueda), get by id, create, update, delete.
- Ficha: histórico de citas, próxima cita, total sesiones, facturación estimada.
- Exportar datos (JSON).
- Rutas: `GET/POST /dashboard/api/pacientes`, `GET/PUT/DELETE /dashboard/api/pacientes/:id`.

### 3. Citas (nueva tabla)
- Sin solapamientos; validación con horarios y bloqueos.
- Estado automático "pasada" cuando la fecha ya ha pasado.
- Slots disponibles: `GET /dashboard/api/citas/slots?fecha=YYYY-MM-DD`.
- Rutas: `GET/POST /dashboard/api/citas`, `GET/PUT/DELETE /dashboard/api/citas/:id`, `POST /api/citas/:id/cancel`.

### 4. Dashboard
- **Inicio**: estadísticas del mes (sesiones realizadas, facturación estimada, cancelaciones, pacientes activos). Datos reales desde BD.
- **Pacientes**: listado, búsqueda, filtro por estado, crear paciente, ficha (modal), exportar JSON, eliminar.
- Sesión: `req.negocioId` (y `req.session.negocioId`) en todas las rutas del dashboard.

### 5. Servicios (lib/)
- `lib/negocio.js`: getById, update, getDuracionCitaDefault.
- `lib/pacientes.js`: list, getById, getCitas, getProximaCita, getTotalSesiones, getFacturacionEstimada, create, update, remove, getOrCreateByEmail.
- `lib/citas.js`: list, getById, create, update, cancel, remove, getSlotsDisponibles, actualizarEstadoPasada.
- `lib/stats.js`: getResumenMes.

## Implementado (fase 2)

- **Config SMTP en UI**: formulario en Configuración (host, puerto, usuario, contraseña, email remitente, nombre remitente) y "Probar envío" usando SMTP del negocio o Resend/env.
- **Plantillas email**: plantilla "recordatorio" editable en Config; variables {{nombre_paciente}}, {{fecha}}, {{hora}}, {{nombre_negocio}}; job diario a las 8:00 que envía recordatorios para citas del día siguiente.
- **Calendario**: vista semanal con colores por estado (verde=confirmada, gris=pasada, rojo=cancelada, amarillo=pendiente, naranja=no_asistio), tooltip con nombre/teléfono/tipo sesión, modal crear/editar cita con selector de paciente.
- **Textos legales RGPD**: sección en Config (política de privacidad, consentimiento, versión); en landing checkbox obligatorio y modal con textos; al reservar se guarda consentimiento (paciente_id, fecha, ip, version_texto).
- **Reserva pública**: crea/usa paciente (getOrCreateByEmail), crea cita en tabla `citas`, registra consentimiento; slots desde `citas` (getSlotsDisponibles).
- **Dashboard Citas**: solo `/api/citas`; calendario y lista con colores; modal crear/editar con paciente; eliminar con doble verificación (DELETE /api/citas/:id).

## Cómo clonar para un nuevo negocio

1. Clonar el repositorio.
2. `npm install`, `node database/init.js`, `node utils/create-user.js`.
3. Configurar variables de entorno (opcional): `BUSINESS_NAME`, `DATABASE_PATH`, etc.
4. Al arrancar, las migraciones crean el negocio por defecto (id=1). Para multi-tenant en una sola instalación: crear más filas en `negocio` y asignar `users.negocio_id`; el login ya guarda `session.negocioId`.

## Seguridad

- Validación y saneamiento en backend (lib/pacientes.js, lib/citas.js).
- Todas las consultas del dashboard filtradas por `negocio_id`.
- Autenticación con sesión; `requireAuth` inyecta `req.negocioId`.
