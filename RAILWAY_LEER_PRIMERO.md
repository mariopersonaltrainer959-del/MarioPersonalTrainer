# ⚠️ Railway: configurar para que el deploy no falle

Railway bloquea el deploy por **Next.js vulnerable** porque está usando un `package-lock.json` de la raíz del repo (esta app es **Express**, no usa Next). Hay que decirle que use solo la carpeta de esta app.

---

## 1. Root Directory (obligatorio)

1. **Railway** → proyecto → servicio **web**.
2. Pestaña **Settings**.
3. En la sección **Source** (donde ves el repo conectado y "CI/CD Root necessary"):
   - Busca el campo **Root Directory** o **Root** o **CI/CD Root**.
   - Escribe exactamente: **`webs de reservas`**  
     (con espacio, sin `/` al final.)
4. Guarda los cambios. Railway hará un nuevo deploy usando solo esa carpeta y el error de Next.js desaparecerá.

Si no ves ese campo, puede estar más abajo en Source o con otro nombre parecido; es el que indica “desde qué carpeta del repo se construye”.

---

## 2. Rollouts / “Wait for CI” (opcional)

En **Settings** → **Source** tienes **Rollouts** con “Wait for CI” activado: Railway solo despliega cuando **todas** las GitHub Actions terminan bien.

- Si quieres que Railway despliegue **en cuanto hagas push**, sin depender de que pasen los workflows: cambia a **“Don’t wait for CI”** (o la opción que no espere a GitHub Actions).
- Si prefieres que solo se despliegue cuando CI pase: déjalo en “Wait for CI” (ya hemos ajustado el workflow para que pase).

---

## 3. Base de datos permanente (evitar perder usuario en cada push)

**Por qué se borra todo:** Sin volumen, la base de datos vive dentro del contenedor y Railway **crea un contenedor nuevo en cada deploy**. Por eso cada push borra usuarios y datos.

**Solución:** usar un **volumen** y guardar la BD ahí.

1. En la **vista del proyecto** (donde ves el recuadro del servicio **web**), abre la paleta con **Cmd+K** (Mac) o **Ctrl+K** (Windows) y busca **“Volume”** o **“Add Volume”**.
2. Crea un volumen y **conéctalo al servicio web**. En **Mount Path** pon: **`/app/data`**.
3. (Opcional) En el servicio **web** → **Variables**, puedes añadir `DATABASE_PATH` = `/app/data/database.db`. Si no, la app usa la ruta del volumen automáticamente.
4. Guarda y redespliega. En los **logs** del deploy busca: `💾 Base de datos: ... (volumen: ...)`. A partir de entonces la BD **persiste** entre pushes.

**Crear el primer usuario (solo una vez después de esto):**  
👉 **https://web-production-59f36.up.railway.app/setup**

---

## Resumen

| Dónde        | Qué poner / hacer                          |
|-------------|---------------------------------------------|
| Source      | **Root Directory** = `webs de reservas`    |
| Rollouts    | Opcional: “Don’t wait for CI” si lo prefieres |
| Persistencia| **Volume** mount `/app/data` + variable **`DATABASE_PATH`** = `/app/data/database.db` |
| Crear usuario | https://web-production-59f36.up.railway.app/setup (tras configurar el volumen) |

Cuando **Root Directory** esté en `webs de reservas`, el build usará el `package-lock.json` de esta app (sin Next) y el aviso de vulnerabilidades no debería volver a salir. Con **volumen + DATABASE_PATH**, la base de datos y el usuario no se borran en cada push.
