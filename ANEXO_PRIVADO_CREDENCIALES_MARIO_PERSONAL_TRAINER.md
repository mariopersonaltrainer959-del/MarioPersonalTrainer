# ANEXO PRIVADO - Credenciales y Accesos

> Uso interno. No compartir con terceros ni adjuntar en entregas de cliente.

## Recomendacion critica de seguridad

Antes de una entrega final, se recomienda:

1. Rotar todas las contrasenas y API keys actuales.
2. Activar 2FA en todos los servicios posibles.
3. Entregar credenciales por gestor seguro (1Password / Bitwarden), no por email.

## Inventario de cuentas

### Google (cuenta principal del proyecto)

- Email: `mariopersonaltrainer959@gmail.com`
- Password actual: **ROTAR**
- Uso:
  - Acceso a Google Cloud
  - Integraciones asociadas del proyecto

### GitHub

- Usuario: `mariopersonaltrainer959-del`
- Password actual: **ROTAR**
- Repositorio principal:
  - `https://github.com/mariopersonaltrainer959-del/MarioPersonalTrainer`

### Porkbun (dominio y DNS)

- Cuenta: **acceso existente**
- Password actual: **ROTAR**
- Dominio:
  - `marioentrenadorpersonal.pro`

### Zoho Mail

- Cuenta operativa de correo del dominio
- Email del dominio: `info@marioentrenadorpersonal.pro`
- Password/App Password actual: **ROTAR**
- Nota:
  - Revisar tambien telefono de recuperacion.

### Railway

- Proyecto: `MarioPersonalTrainer`
- Entorno: produccion
- Variables sensibles:
  - `RESEND_API_KEY`
  - `SESSION_SECRET`
  - `GOOGLE_CLIENT_SECRET`
- Accion recomendada:
  - Rotar las claves y volver a guardar en Variables.

### Resend

- Cuenta creada y en uso para envios transaccionales.
- API key actual: **ROTAR**
- Dominio configurado para envio:
  - `marioentrenadorpersonal.pro`

## Variables de entorno clave (referencia)

- `ADMIN_HOST`
- `ADMIN_BASE_URL`
- `PUBLIC_SITE_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET`

## Estado de pagos (referencia interna)

- Dominio anual en Porkbun.
- Railway plan Hobby mensual.
- Zoho Mail anual.

> Recomendacion: migrar cargos a tarjeta del titular final del negocio para operativa estable.

## Checklist de traspaso seguro

- [ ] Rotacion de contrasenas completada.
- [ ] Rotacion de API keys completada.
- [ ] 2FA activo en Google, GitHub, Porkbun, Zoho y Railway.
- [ ] Credenciales entregadas por gestor seguro.
- [ ] Confirmacion de acceso por parte del titular final.
