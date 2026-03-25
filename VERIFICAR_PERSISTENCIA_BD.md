# Verificar que la base de datos persista (usuarios no se borran)

Si cada vez que pasa un tiempo (o cada push/deploy) tienes que volver a crear el usuario, la BD no está persistiendo. Hay dos formas de conseguir persistencia en Railway.

---

## Opción recomendada: PostgreSQL en Railway (persistencia garantizada)

La forma **más robusta** es usar la **base de datos PostgreSQL** que ofrece Railway. Los datos quedan en un servicio gestionado y **no dependen de volúmenes ni del contenedor**.

1. En tu proyecto **Railway** → **+ New** → **Database** → elige **PostgreSQL**.
2. Railway crea el servicio de BD y te asigna la variable **`DATABASE_URL`**. Conéctala al servicio **web** (en la pestaña del Postgres → **Variables** → **Add reference** al servicio web, o copia `DATABASE_URL` a las variables del servicio **web**).
3. En el servicio **web** debe existir la variable **`DATABASE_URL`** (con la cadena de conexión que te da Railway).
4. **Redeploy** el servicio web. En los logs deberías ver: **`💾 Base de datos: PostgreSQL (Railway) – persistencia garantizada`**.
5. Crea el primer usuario en **/setup**. Los datos ya no se pierden en cada deploy.

No hace falta Volume ni `DATABASE_PATH` cuando usas `DATABASE_URL`. Todo queda en la nube y persistente.

---

## Alternativa: SQLite con volumen

Si no usas Postgres, la app usa un archivo SQLite. Para que persista hace falta un **Volume** y que la ruta coincida.

### Por qué se borra todo en cada deploy (SQLite)

- En cada deploy Railway arranca un **contenedor nuevo**. Todo lo que la app escribe en el disco “normal” del contenedor (por ejemplo `./database.db` o `/app/database.db`) **se pierde** cuando ese contenedor desaparece.
- La **única** forma de que los datos sobrevivan es escribir el fichero de la base de datos **dentro del path donde está montado el Volume**. Ese path lo eliges tú al crear el volumen en Railway (p. ej. `/data` o `/app/data`).
- Si tienes Volume pero **`DATABASE_PATH` no apunta a ese path**, la app sigue escribiendo en el disco del contenedor y los datos se borran en cada deploy. Por eso es **crítico** que **`DATABASE_PATH` = &lt;Mount Path del volumen&gt;/database.db** (el mismo path que ves en la configuración del volumen).

---

## 1. Comprobar en Railway

### Volumen

- En el proyecto, en la vista donde ves el servicio **web**, debe aparecer un recurso **Volume** (no "Database").
- Ese volumen debe estar **conectado al servicio web**.
- Anota el **Mount Path** del volumen (en Railway lo ves en la configuración del volumen; a veces es `/data`, `/app/data`, etc.).

Si no hay volumen, o está en otro servicio, la app escribe en el disco efímero y los datos se pierden en cada deploy.

### Variable de entorno (tiene que coincidir con el volumen)

- Servicio **web** → **Variables**.
- Debe existir **`DATABASE_PATH`** y su valor **tiene que ser exactamente** el Mount Path del volumen + **`/database.db`**.
  - Si el Mount Path del volumen es **`/app/data`** → **`DATABASE_PATH`** = **`/app/data/database.db`**.
  - Si el Mount Path es **`/data`** → **`DATABASE_PATH`** = **`/data/database.db`**.
  - Sin espacios, sin barra final, tal cual.

Si `DATABASE_PATH` apunta a otra ruta (por ejemplo `/app/database.db` cuando el volumen está en `/data`), el fichero se crea **fuera** del volumen y se pierde en cada deploy.

### Una sola réplica

- En **Settings** del servicio web, revisa si hay opción de **replicas** o **instances**.
- Debe ser **1**. Con más de una, cada una puede tener su propia copia del volumen o una sin volumen, y los usuarios creados en una no aparecen en la otra.

---

## 2. Qué ver en los logs al arrancar

Después de cada deploy, en **Railway** → **web** → **Deployments** → último deploy → **View Logs**, al iniciar la app deberías ver algo como:

```
📂 Archivo BD al arrancar: ya existía (volumen persistió)
💾 Base de datos: /app/data/database.db (persistente)
   RAILWAY_VOLUME_MOUNT_PATH = /app/data   (si Railway lo inyecta)
✅ Base de datos inicializada correctamente
🚀 Servidor iniciado en puerto XXXX
👥 Usuarios en BD: 1
```

- **📂 Archivo BD al arrancar:** Si dice **"ya existía (volumen persistió)"** en el *segundo* deploy después de crear un usuario → el volumen está persistiendo. Si siempre dice **"nuevo"** en cada deploy → el archivo no está en el volumen (path equivocado o volumen no persiste).
- Si ves **(persistente)** → la app cree estar usando el volumen; si además siempre "nuevo" y Usuarios en BD: 0, prueba la opción B más abajo.
- Si ves **(NO PERSISTENTE)** y el aviso de "Los datos se perderán en cada deploy" → falta volumen o `DATABASE_PATH`; los usuarios se borrarán.
- **Usuarios en BD: 0** después de haber creado uno → la BD que está usando no es la del volumen (o es otra instancia). Revisa volumen y variable.
- **Usuarios en BD: 1** (o más) → la BD persistente tiene usuarios; no deberías tener que volver a crearlos.

---

## 3. Si sigue fallando (persistente + Usuarios en BD: 0 en cada deploy)

**Si en los logs sale "Archivo BD al arrancar: ya existía" pero "Usuarios en BD: 0":** el archivo está en el volumen, pero las escrituras (p. ej. el usuario creado en /setup) no llegaron a disco antes de que el contenedor se apagara. El código ya usa `PRAGMA synchronous = FULL` para forzar que SQLite escriba a disco. Después de un push con ese cambio, crea el usuario de nuevo y haz otro deploy; en los logs deberías ver también **"✅ Primer usuario creado desde /setup. Usuarios en BD ahora: 1"**. Si tras el siguiente deploy sigue en 0, prueba la opción B (usar la ruta que inyecta Railway).

### Opción A – Revisar path y variable

1. En Railway, abre el **Volume** asociado al servicio **web** y anota el **Mount Path** (p. ej. `/app/data` o `/data`).
2. En **Variables** del servicio **web**, pon **`DATABASE_PATH`** = **&lt;Mount Path&gt;/database.db** (ej. `/app/data/database.db` o `/data/database.db`). Debe ser **exactamente** ese path, sin otra ruta.
3. Si lo prefieres, puedes **recrear el volumen** vinculado al servicio **web** con Mount Path **`/app/data`** y entonces **`DATABASE_PATH`** = **`/app/data/database.db`**.
4. **Redeploy** (push o "Redeploy" en Railway).
5. En los logs confirma que salga **Base de datos: &lt;ruta&gt; (persistente)** y, la primera vez, **Usuarios en BD: 0**.
6. Crea el usuario **una vez** en **/setup**. En el siguiente deploy, en los logs debería salir **📂 Archivo BD al arrancar: ya existía** y **Usuarios en BD: 1**.

### Opción B – Dejar que Railway ponga la ruta (recomendada si A no funciona)

A veces Railway monta el volumen en un path que no coincide con el que pusiste en la UI. La app puede usar la variable que Railway inyecta:

1. En **Variables** del servicio **web**, **borra** la variable **`DATABASE_PATH`** (o coméntala).
2. Deja el **Volume** como está. Railway inyecta **`RAILWAY_VOLUME_MOUNT_PATH`** con el path real del volumen; la app usará esa ruta + `database.db`.
3. **Redeploy**. En los logs deberías ver **RAILWAY_VOLUME_MOUNT_PATH = &lt;ruta&gt;**; esa es la ruta donde se guarda la BD.
4. Crea el usuario en **/setup**, haz otro deploy y comprueba que salga **Archivo BD al arrancar: ya existía** y **Usuarios en BD: 1**.

### Opción C – Montar el volumen en `/data` (recomendada si "ya existía" pero 0 usuarios)

En Railway, lo que se escribe dentro de **`/app`** a veces va a un overlay temporal y **no** al volumen, por eso el archivo "existe" pero los usuarios no persisten. Prueba montar el volumen **fuera de `/app`**:

1. En Railway, en el **Volume** (web-volume) → **Settings**: cambia el **Mount Path** de **`/app/data`** a **`/data`** (si la UI lo permite). Si no se puede cambiar, crea un **nuevo** volumen con Mount Path **`/data`**, asígnale el servicio **web**, y elimina el volumen antiguo.
2. En **Variables** del servicio **web**, pon **`DATABASE_PATH`** = **`/data/database.db`**.
3. **Redeploy**. Crea el usuario en **/setup**, haz otro deploy y comprueba en logs **Usuarios en BD: 1**.

### Permisos

Si el archivo nunca aparece o hay errores de escritura, en **Variables** añade **`RAILWAY_RUN_UID=0`** para que el contenedor pueda escribir en el volumen.

---

Si en los logs sigue saliendo **(NO PERSISTENTE)** o **Usuarios en BD: 0** después de crear usuario, el volumen no está llegando al servicio o el path no coincide: revisa que el volumen esté asignado al servicio **web** y, si usas `DATABASE_PATH`, que sea exactamente &lt;Mount Path&gt;/database.db.

---

## 4. Mensaje "npm error signal SIGTERM" / "command failed"

En los logs a veces aparece algo como:

```
npm error signal SIGTERM
npm error command sh -c node database/init.js && node server.js
```

**En muchos casos es normal:** cuando haces un nuevo deploy, Railway **apaga el contenedor anterior** enviándole SIGTERM. Ese mensaje corresponde al **deploy viejo** que se está cerrando, no al nuevo. Si el **nuevo** deploy queda en "Running" y la web responde, no hay que hacer nada.

El servidor tiene apagado graceful: al recibir SIGTERM espera unos segundos para que cualquier escritura a la BD termine y luego sale. Así se evita cortar una escritura a mitad y perder datos. Si ves el mensaje de SIGTERM pero también "SIGTERM recibido. Cerrando en 5s...", es el apagado controlado del contenedor anterior.
