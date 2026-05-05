# Documento de Entrega - Mario Personal Trainer

## Resumen del servicio

Se entrega una plataforma web operativa para gestion de entrenamientos personales, con:

- Landing publica personalizada de marca.
- Panel de administracion privado.
- Sistema de reservas/entrenos y gestion de clientes.
- Facturacion y recibos en PDF.
- Integracion con Google Calendar.
- Envio automatico de emails (confirmaciones, recordatorios y reputacion).

## Enlaces de acceso

- Landing publica: `https://marioentrenadorpersonal.pro/`
- Login admin: `https://admin.marioentrenadorpersonal.pro/login`
- Dashboard admin: `https://admin.marioentrenadorpersonal.pro/dashboard`
- Setup inicial (solo uso puntual): `https://admin.marioentrenadorpersonal.pro/setup`

## Infraestructura y servicios activos

- Dominio y DNS: Porkbun (`marioentrenadorpersonal.pro`)
- Codigo fuente y versionado: GitHub
- Hosting y despliegue: Railway
- Correo del dominio: Zoho Mail
- Envio transaccional de emails: Resend
- Integracion de calendario: Google Cloud + Google Calendar API

## Cuentas y correos del proyecto

- Correo profesional generado del proyecto: `info@marioentrenadorpersonal.pro`
- Cuenta principal de gestion y facturacion: `mariopersonaltrainer959@gmail.com`
- Nota operativa: todos los servicios principales del proyecto se han creado y gestionado con la cuenta `mariopersonaltrainer959@gmail.com`, y las facturas se reciben en ese mismo correo.

## Costes y suscripciones del servicio

- Dominio `marioentrenadorpersonal.pro` (Porkbun): aprox. **3 EUR** - **anual**
- Hosting Railway (plan Hobby): **5 EUR** - **mensual**
- Zoho Mail (plan Lite): aprox. **13 EUR** - **anual**
- Total estimado de pagos iniciales indicados: aprox. **21 EUR** (incluye costes anuales + primer mes de Railway)

## Resumen de recurrencia

- Costes mensuales recurrentes:
  - Railway Hobby: **5 EUR/mes**
- Costes anuales recurrentes:
  - Dominio en Porkbun: **anual**
  - Zoho Mail Lite: **anual**

## Funcionalidades entregadas

### Web publica

- Presentacion profesional del servicio.
- Formulario de reserva.
- Flujo de experiencia alineado a "entrenos" y "clientes".

### Panel admin

- Gestion de clientes y entrenos.
- Configuracion del negocio.
- Configuracion de emails y pruebas de envio.
- Gestion de facturas y recibos.
- Configuracion de reputacion Google.

### Email automatizado

- Confirmacion de reserva al cliente.
- Recordatorio automatico previo al entreno.
- Solicitud automatica de valoracion tras entreno completado.
- Plantillas editables desde panel para recordatorio y reputacion.
- Botones de envio de prueba para validar contenido antes de usarlo en produccion.

### Reputacion Google

- Enlace de valoracion configurable.
- Flujo de feedback del cliente.
- Ventana anti-fatiga para no repetir solicitudes en periodos cortos.

## Entrega tecnica

- Repositorio principal: `mariopersonaltrainer959-del/MarioPersonalTrainer`
- Historial de despliegues y CI: [GitHub Actions](https://github.com/mariopersonaltrainer959-del/MarioPersonalTrainer/actions)

## Operativa recomendada

- Revisar semanalmente el panel de clientes y entrenos.
- Probar email de test tras cambios de plantilla.
- Verificar periodicamente que el dominio y DNS siguen vigentes.
- Mantener actualizado el enlace de Google Reviews del negocio.

## Nota de seguridad

Las credenciales de acceso y claves tecnicas se gestionan en un anexo privado independiente de este documento.
