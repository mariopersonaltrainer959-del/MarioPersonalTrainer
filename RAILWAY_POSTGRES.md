# Usar PostgreSQL en Railway (persistencia garantizada)

Para que **los datos de tus clientes no se pierdan nunca** en cada deploy, usa la base de datos **PostgreSQL** de Railway en lugar de SQLite + volumen.

## Pasos en Railway

1. **Añadir PostgreSQL al proyecto**
   - En el proyecto **Sistema de reservas** (o el que uses), clic en **+ New** → **Database** → **PostgreSQL**.
   - Railway crea un nuevo servicio con la base de datos.

2. **Conectar la BD al servicio web**
   - Abre el servicio **PostgreSQL** que se acaba de crear.
   - En la pestaña **Variables** verás **`DATABASE_URL`** (o **Connect** / **Connection**).
   - Clic en **Add reference** o **Connect to** y elige el servicio **web**, o copia el valor de `DATABASE_URL` y pégalo en **Variables** del servicio **web**.

3. **Comprobar variable en el servicio web**
   - Servicio **web** → **Variables**.
   - Debe existir **`DATABASE_URL`** con la cadena de conexión (empieza por `postgresql://` o `postgres://`).

4. **Desplegar**
   - Haz **Redeploy** del servicio **web** (o un push al repo).
   - En los **logs** del deploy deberías ver: **`💾 Base de datos: PostgreSQL (Railway) – persistencia garantizada`**.

5. **Crear el primer usuario**
   - Entra en **/setup** en tu URL y crea el usuario. A partir de ahí, **los datos persisten en todos los deploys**; no hace falta Volume ni `DATABASE_PATH`.

## Para cada cliente

Cuando entregues el sistema a un cliente (nueva cuenta o nuevo proyecto en Railway), repite estos pasos en su proyecto: añadir **PostgreSQL**, conectar **DATABASE_URL** al servicio **web**, desplegar y crear el usuario en **/setup**. Así su negocio tendrá persistencia sin depender de tu ordenador ni de volúmenes.
