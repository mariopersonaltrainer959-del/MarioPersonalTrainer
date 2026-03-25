# Auditoría técnica-comercial — Sistema de reservas para psicólogos

**Rol:** Arquitecto senior SaaS + auditor técnico-comercial  
**Alcance:** Listo para venta en dos modos (con mantenimiento / propietario total)  
**Fecha:** Febrero 2026

---

## 1. FUNCIONALIDAD POR CLIENTE

| Requisito | Estado | Notas |
|-----------|--------|--------|
| Landing pública con nombre del negocio | **OK** | `config.businessName` / dashboard Configuración |
| Landing con **servicios** (listado) | **FALTA** | No hay sección ni datos de servicios; texto genérico solo |
| Landing con **precio** | **FALTA** | No hay precio en landing ni en reserva |
| Landing con **duración** | **OK** | Duración global configurable en dashboard (una sola por negocio) |
| Reserva: seleccionar **tipo de sesión** | **FALTA** | Solo hay una duración; no hay “Primera consulta / Seguimiento” ni equivalente |
| Reserva: fecha y hora | **OK** | Slots desde horarios + bloqueos |
| Formulario: nombre y email del paciente | **OK** | Incluido |
| Email automático al **paciente** (confirmación) | **OK** | `sendConfirmationEmail` en `utils/email.js` |
| Email automático al **psicólogo** (datos de la reserva) | **FALTA** | Solo se envía al paciente; no hay notificación al profesional |
| Dashboard privado con login | **OK** | `/dashboard` con sesión |
| Dashboard: listado de reservas (fecha, hora, email paciente) | **OK** | Incluye también duración y cancelar |
| Dashboard: **tipo de sesión** por reserva | **MAL IMPLEMENTADO** | Solo se muestra “Duración: X minutos”; no existe campo “tipo_sesion” |

**Resumen 1:** Hay base sólida (landing, reserva, email al paciente, dashboard), pero faltan servicios, precio, tipo de sesión en reserva/landing y **notificación por email al psicólogo**. El dashboard no distingue “tipo de sesión”, solo duración.

---

## 2. PRUEBAS COMERCIALES

| Requisito | Estado | Notas |
|-----------|--------|--------|
| Cliente puede probar reservas reales | **OK** | Mismo flujo que producción |
| Emails en modo demo | **OK** | Depende de SMTP configurado (Gmail u otro); sin SMTP no hay envío |
| Datos del negocio configurables | **OK** | Dashboard → Configuración (nombre, teléfono, email, duración); también variables de entorno |
| Cada demo independiente y eliminable | **OK** | Un despliegue Railway = un cliente; eliminar proyecto = demo eliminada |

**Resumen 2:** Viable para demos si SMTP está configurado y se explica que cada demo = un despliegue propio.

---

## 3. ARQUITECTURA POR DOMINIO

| Aspecto | Estado | Notas |
|---------|--------|--------|
| Una web por dominio propio | **OK** | Un deploy = una app = un dominio (Railway o custom) |
| Sin variables multi-cliente complejas | **OK** | No hay multi-tenant; cada instancia es un solo negocio |
| Sin riesgo de mezcla de datos | **OK** | Una BD SQLite por despliegue; aislamiento total por cliente |

**Resumen 3:** Arquitectura clara: 1 deploy = 1 cliente = 1 dominio. Adecuada para ambos modos de venta.

---

## 4. MODO A — CLIENTE CON MANTENIMIENTO

| Aspecto | Estado | Notas |
|---------|--------|--------|
| Múltiples clientes en Railway del proveedor | **Viable** | Un proyecto/servicio por cliente; coste crece con el número de clientes |
| Despliegues seguros | **OK** | GitHub → Railway; sin acceso a código de otros clientes entre proyectos |
| Crecimiento soportado | **Parcial** | Límites de Railway (plan, número de servicios); sin panel central de “todos los clientes” |
| Costes controlados | **Parcial** | Hay que dimensionar plan Railway en función de nº de clientes y tráfico |

**Resumen 4:** Modo A es viable; conviene documentar coste por cliente y proceso de alta/baja.

---

## 5. MODO B — CLIENTE PROPIETARIO TOTAL

| Aspecto | Estado | Notas |
|---------|--------|--------|
| Clonar proyecto y desplegar en Railway del cliente | **OK** | Repo público/clonable; cliente crea su proyecto Railway y conecta repo |
| Transferencia completa sin dependencias ocultas | **OK** | Sin APIs externas obligatorias del proveedor; SMTP y dominio los pone el cliente |
| Configurar dominio y SMTP propios | **OK** | Variables de entorno: dominio en Railway, SMTP_* y EMAIL_FROM |
| Entregar sin romper funcionalidades | **OK** | Mismo código; solo cambian env y primer usuario |

**Resumen 5:** Modo B está bien soportado. Falta una **guía de entrega** (checklist: env, dominio, SMTP, primer usuario).

---

## 6. DOMINIOS

| Aspecto | Estado | Notas |
|---------|--------|--------|
| Dominio comprable por el cliente | **OK** | Ajeno al producto |
| Configuración DNS clara y replicable | **OK** | Railway permite dominio custom; documentar CNAME/registro según Railway |
| Sin dependencia de cuentas personales del proveedor | **OK** | Cliente usa su Railway y su dominio |

**Resumen 6:** Dominios manejables; solo hace falta documentar pasos DNS para Railway.

---

## 7. EMAIL Y SMTP

| Aspecto | Estado | Notas |
|---------|--------|--------|
| SMTP del proveedor para demos | **OK** | Mismas variables (SMTP_*, EMAIL_FROM) en el deploy de demo |
| Cambio a SMTP del cliente | **OK** | Cliente define sus propias variables de entorno |
| Riesgos de entregabilidad | **A tener en cuenta** | Depende del SMTP (Gmail, SendGrid, etc.); no hay lógica específica en código |

**Resumen 7:** Modelo SMTP flexible; entregabilidad es responsabilidad de la configuración (y posiblemente dominio/SPF/DKIM según proveedor).

---

## 8. DATOS

| Aspecto | Estado | Notas |
|---------|--------|--------|
| Reservas estructuradas | **OK** | Tabla `appointments`: id, client_name, client_email, appointment_date, duration, status |
| Campo **tipo_sesion** | **FALTA** | No existe en BD; solo `duration` |
| Exportar a CSV (id, nombre_paciente, email_paciente, tipo_sesion, fecha, hora, estado) | **FALTA** | No hay endpoint ni botón de exportación en el dashboard |

**Resumen 8:** Estructura de datos suficiente para uso interno; falta **tipo_sesion** y **exportación CSV** según especificación.

---

## 9. RIESGOS ANTES DE VENDER

### Técnicos
- **SQLite sin backup automático:** Pérdida del disco/contenedor = pérdida de datos. Definir backups (manual o volumen persistente/backup Railway si aplica).
- **Una sola duración/tipo de cita:** No hay “tipos de sesión” ni precios; puede limitar ventas a psicólogos con varios servicios.
- **Sin notificación al profesional:** El psicólogo no recibe email al reservar; depende de entrar al dashboard.
- **Sesión y cookies:** Configuración ya revisada (trust proxy, sameSite); vigilar en nuevos entornos.

### Operativos
- **Modo A:** Coste y límites de Railway por número de clientes; sin herramienta central de administración de clientes.
- **Onboarding:** Crear usuario inicial (/setup), configurar SMTP y horarios; debe estar documentado para no generar soporte innecesario.
- **Demos:** Cada demo = un deploy; limpieza manual si se dan muchas demos.

### Legales (básicos)
- **Datos personales (pacientes):** Nombre, email, citas; conviene mención en política de privacidad y posible registro de actividades si aplica RGPD.
- **Contratos:** Definir responsabilidad (quién es responsable del tratamiento de datos: proveedor en Modo A, cliente en Modo B).
- **Condiciones de uso:** No implementadas en la app; recomendable para venta B2B.

---

## 10. VEREDICTO FINAL

### **NO LISTO PARA VENDER** (en el estado actual)

Motivos principales:
1. **Falta notificación por email al psicólogo** al crearse una reserva (requisito explícito).
2. **Faltan en la landing: servicios, precio y selección de tipo de sesión** en la reserva.
3. **Falta exportación CSV** de reservas (con id, nombre_paciente, email_paciente, tipo_sesion, fecha, hora, estado).
4. **Falta campo tipo_sesion** en modelo de datos y en flujo de reserva/dashboard.

---

## QUÉ FALTA Y EN QUÉ ORDEN

### Crítico (antes de primera llamada comercial seria)

1. **Email al psicólogo al reservar**  
   Tras guardar la cita, enviar un email a `businessEmail` (o configurable) con: nombre y email del paciente, fecha, hora, duración. Reutilizar SMTP ya existente.

2. **Exportar reservas a CSV**  
   Endpoint (por ejemplo `GET /dashboard/api/appointments/export`) que devuelva CSV con: id_reserva, nombre_paciente, email_paciente, tipo_sesion (o “Sesión X min” hasta que exista tipo_sesion), fecha, hora, estado. Botón “Exportar CSV” en la pestaña Citas del dashboard.

3. **Documentación mínima de entrega**  
   - Modo A: cómo das de alta un nuevo cliente (deploy, dominio, env, /setup).  
   - Modo B: guía para el cliente (clonar repo, Railway, variables, dominio, SMTP, /setup).  
   - DNS: pasos para dominio custom en Railway.

### Importante (para poder vender “pack completo”)

4. **Tipo de sesión**  
   - Añadir campo `session_type` (o `tipo_sesion`) a `appointments` (y opcionalmente tabla de “servicios” con nombre, duración, precio).  
   - En la landing: desplegable o lista para elegir tipo de sesión antes de elegir fecha/hora.  
   - En dashboard: mostrar tipo de sesión en cada cita e incluirlo en el CSV.

5. **Landing: servicios y precio**  
   - Sección configurable (o desde BD) con nombre del servicio, duración y precio.  
   - Mostrar en la landing y, si aplica, en el flujo de reserva (ej. “Sesión 50 min – 60 €”).

### Opcional (mejora progresiva)

6. Textos de la landing editables desde el dashboard (o al menos desde config/env).  
7. Backups de SQLite (script o uso de volúmenes/backups Railway).  
8. Borrador de política de privacidad y condiciones de uso para incluir en la web o en contrato.

---

## Resumen ejecutivo

- **Arquitectura (1 deploy = 1 cliente = 1 dominio)** y **modos A y B** son viables y claros.
- **Faltan:** email al psicólogo, export CSV, tipo de sesión, servicios y precio en landing.
- **Orden recomendado:** implementar email al psicólogo + export CSV + guía de entrega; luego tipo de sesión y servicios/precio en landing. Con eso se puede considerar el producto **listo para vender** en ambos modos, con el entendido de que la primera versión puede tener una sola “tipo de sesión” (duración) si se prioriza tiempo a mercado.
