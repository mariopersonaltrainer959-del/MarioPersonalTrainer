# Logs y persistencia en Railway

> **Si Railway bloquea el deploy por Next.js:** ver [RAILWAY_LEER_PRIMERO.md](RAILWAY_LEER_PRIMERO.md).

## Si Railway bloquea el deploy por “Next.js vulnerable”

Este proyecto **no usa Next.js** (es Express). El aviso sale porque Railway está construyendo desde la **raíz del repo**, donde hay (o Railway lee) un `package-lock.json` que sí tiene Next de otro proyecto.

**Solución obligatoria:** decirle a Railway que use solo la carpeta de esta app.

1. En **Railway** → tu proyecto → servicio **web**.
2. Entra en **Settings** (o **Configure** / pestaña de configuración del servicio).
3. Busca **“Root Directory”** o **“Source”** o **“Working Directory”**.
4. En ese campo escribe exactamente: **`webs de reservas`**  
   (con espacio, sin barra al final). Si tu repo tiene la app en otra carpeta, pon esa.
5. **Guarda** (Save). Railway hará un nuevo deploy.

A partir de ahí Railway solo usará los archivos de esa carpeta (incluido su `package-lock.json`, que no tiene Next) y el error de vulnerabilidad debería desaparecer. Si no ves la opción Root Directory, búscala en la configuración del **service** o en **Deploy**.

---

## Dónde ver los logs

1. Entra en **Railway** → tu proyecto.
2. Haz clic en el servicio **web** (el que tiene el icono de GitHub).
3. Arriba verás pestañas: **Deployments**, **Variables**, **Metrics**, **Settings**.
4. Pulsa **Deployments** y luego en el despliegue activo (el que está en verde).
5. Ahí verás **View Logs** (o una pestaña **Logs**). Ahí salen los `console.log` y errores del servidor.

**Alternativa:** En el servicio "web", en la barra superior del proyecto (no del servicio) a veces hay **Logs** o **Observability** → **Logs**, donde se ven todos los logs del servicio en tiempo real.

Los logs te sirven para ver:
- Si el servidor arrancó bien.
- Errores al enviar emails (SMTP).
- Errores de base de datos.
- Cualquier `console.log` que uses en el código.

---

## Por qué “desaparecen” los usuarios (y las reservas)

En Railway, **cada despliegue o reinicio puede usar un sistema de archivos nuevo**. El archivo `database.db` está dentro de ese sistema de archivos, así que:

- Si **no** usas un **volumen persistente**, la base de datos se borra en cada nuevo deploy.
- Resultado: se pierden usuarios, citas y configuración.

Para **producción** hay que usar un **volumen** y guardar la base de datos ahí.

---

## Cómo hacer que los datos persistan (volumen en Railway)

Los volúmenes **no** se configuran en "Project Settings". Se crean desde la **vista principal del proyecto** (donde ves el servicio "web").

### 1. Crear el volumen en Railway

1. Sal de **Project Settings** y vuelve a la vista donde ves tu servicio **web** (el recuadro con el icono de GitHub).
2. **Opción A:** Pulsa **Cmd+K** (Mac) o **Ctrl+K** (Windows/Linux) para abrir la paleta de comandos. Escribe **"Volume"** o **"Add Volume"** y elige la opción para crear un volumen.
3. **Opción B:** Haz **clic derecho** en el lienzo del proyecto (zona vacía o sobre el servicio) y en el menú busca **"Add Volume"** o **"Create Volume"**.
4. Cuando te pida **conectar el volumen a un servicio**, selecciona el servicio **web**.
5. Donde pida **Mount Path** (o "Mount point"), escribe exactamente: **`/app/data`**
6. Crea/guarda el volumen.

### 2. Variable de entorno

1. En el mismo servicio **web**, ve a la pestaña **Variables**.
2. Añade una variable nueva:
   - **Nombre:** `DATABASE_PATH`
   - **Valor:** `/app/data/database.db`
3. Guarda. Railway volverá a desplegar.

### 3. Comportamiento

- La primera vez que arranque la app con esto, se creará `/app/data/database.db` dentro del volumen.
- Ese archivo **permanece** entre despliegues.
- Los usuarios, citas y configuración ya no se pierden al hacer push o redeploy.

### 4. Después de activar el volumen

- Si antes tenías usuarios en una BD “vieja” (sin volumen), esa BD ya no se usa. Tendrás que **crear de nuevo el primer usuario** en `/setup`.
- A partir de ahí, todo lo que crees (usuarios, reservas, configuración) quedará guardado aunque sigas desplegando.

---

## Dónde crear el usuario (y cuándo)

- **URL:** `https://tu-app.up.railway.app/setup`  
  (en tu caso: `https://web-production-59f36.up.railway.app/setup`)
- **Cuándo:** La primera vez que despliegas, o cada vez que la BD se ha “perdido” (porque no había volumen o faltaba `DATABASE_PATH`).
- **Solo el primer usuario** se crea por aquí; ese usuario ya puede entrar en el dashboard y usar el sistema.

---

## Comprobar que la persistencia está bien configurada

En Railway, en el servicio **web**:

1. **Variables:** Debe existir `DATABASE_PATH` = `/app/data/database.db`.
2. **Volumen:** En la vista del proyecto debe aparecer un recurso tipo “Volume” asociado al servicio **web**, con **Mount Path** = `/app/data`.
3. **Un solo despliegue activo:** Si tienes varias réplicas, cada una puede tener su propia copia del volumen; para evitar líos, mantén 1 réplica hasta que todo funcione.

Si falta el volumen o la variable, los datos se guardan dentro del contenedor y **se borran en cada redeploy**.

---

## Resumen

| Qué quieres              | Dónde / qué hacer                                      |
|--------------------------|--------------------------------------------------------|
| Ver logs del servidor    | Railway → servicio **web** → **Deployments** → despliegue activo → **View Logs** (o pestaña **Logs**). |
| Evitar perder usuarios  | Añadir **Volume** con mount path `/app/data` y variable `DATABASE_PATH=/app/data/database.db`. |
| Crear usuario de nuevo  | Tras configurar el volumen, ir a `/setup` y crear el primer usuario. |
