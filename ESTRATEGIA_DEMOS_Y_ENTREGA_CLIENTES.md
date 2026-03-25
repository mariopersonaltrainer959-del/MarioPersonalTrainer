# Estrategia demos y entrega a clientes (psicólogos)

Este documento describe la forma recomendada de dar demos del sistema a psicólogos en toda España y de entregar el producto cuando el cliente lo compre, sin depender de la cuenta personal del desarrollador.

---

## 1. Fase demo: que cada psicólogo pueda probar “su” sistema

**Objetivo:** Un despliegue por demo; cada uno con sus propios datos y su propia URL.

- Usar **una sola cuenta de Railway (de negocio)** y **varios proyectos** (uno por psicólogo demo).
- El **mismo código/repo** en todos; lo que cambia es la **configuración** de cada proyecto:
  - En cada demo entrar al panel (Configuración + Landing) y poner **nombre, email y teléfono del psicólogo**.
  - Así, cuando hace una reserva de prueba, el correo de confirmación le llega **a su email** y ve **su nombre** en la web.
- Cada proyecto tiene su propia URL, por ejemplo:
  - `nombre-psicologo.railway.app` o `demo-juana.railway.app`
- En Railway cada proyecto puede tener su propia **base de datos** (SQLite por proyecto o una BD distinta por env) y sus variables de entorno (SESSION_SECRET, SMTP, etc.), así que cada demo queda aislado.

No hace falta modificar código: el sistema ya es “un negocio por instalación”; solo se despliega la misma app varias veces y se configura cada una desde el panel.

---

## 2. No mezclar con la cuenta personal y dejar demos en standby

- **Cuenta de Railway:**  
  Usar **una cuenta de Railway “de negocio”** (ej. `tuempresa@gmail.com` o `demos@tudominio.com`) para todos los demos y, luego, para los clientes que compren. Así la cuenta personal no se usa para vender.

- **Repositorio:**  
  Para no vender desde el repo personal:
  - Crear una **organización en GitHub** (ej. “TuEmpresa”).
  - Tener ahí el repo del producto (se puede copiar el código desde el repo actual).
  - Los despliegues de demos y de clientes se hacen **desde ese repo de la organización**, no desde la cuenta personal.

- **Standby:**  
  En Railway se pueden pausar proyectos o bajar a plan gratuito cuando un demo no esté activo; cuando el psicólogo quiera probar de nuevo, se reactiva ese proyecto (o se crea uno nuevo desde el mismo repo).

---

## 3. Cuando el cliente quiera quedárselo: “pasárselo todo”

### Opción A – Cliente con su propia cuenta de Railway (recomendada)

- Crear una **cuenta nueva en Railway** con el email del psicólogo (o uno que tú crees y luego le des).
- En esa cuenta crear **un único proyecto** y desplegar el **mismo código** (desde el repo de la organización).
- **Datos:**
  - Si quieren conservar las reservas de prueba: exportar la base de datos del demo (ej. el `.db` de SQLite) e importarla en el nuevo proyecto (o copiar el archivo y configurar la ruta en env).
  - Si prefieren empezar de cero: en el nuevo despliegue solo configurar otra vez desde el panel (nombre, email, landing, etc.); no hace falta migrar BD.
- Dar al cliente **acceso a esa cuenta de Railway** (o la cuenta ya está con su email) para que pague el hosting y, si se desea, el dominio más adelante.

### Opción B – Cliente en la misma cuenta de Railway

- Crear un **nuevo proyecto** en la cuenta “de negocio” y desplegar el repo.
- Dar acceso al cliente como **miembro del equipo** de ese proyecto (Railway permite invitaciones).
- Ellos pueden pasar a ser “dueños” del proyecto o tú facturas el hosting. La “entrega” es acceso + facturación.

Para que cada psicólogo tenga “lo suyo” sin depender de tu cuenta, la **Opción A** suele ser más clara: una cuenta Railway (o un proyecto claramente suyo) por cliente que compre.

---

## 4. Dominio (cuando el cliente no tiene)

- Al principio cada instalación puede usar solo la URL de Railway:  
  `https://nombre-del-proyecto.railway.app`
- Cuando el psicólogo tenga dominio (o lo compre), en Railway se añade **custom domain** y en el registrador (Porkbun, etc.) se apunta el DNS a Railway. Esto se hace cuando toque, sin cambiar la forma de hacer demos ni la entrega.

---

## 5. Resumen en tabla

| Fase | Qué hacer |
|------|-----------|
| **Demos** | Una cuenta Railway “de negocio”. Un **proyecto por psicólogo demo**. Mismo repo (mejor en una **org de GitHub**). Configurar cada demo desde el panel (nombre, email, teléfono, landing) para que la reserva de prueba y el mail sean con sus datos. |
| **Standby** | Demos que no se usen se pausan o se dejan en plan bajo coste; no hace falta “pasarlos” a otro sitio hasta que compren. |
| **Cliente compra** | Crear **cuenta Railway nueva** (con su email) → un proyecto → desplegar el mismo repo desde la org. Migrar datos (export/import de la BD del demo) si quieren conservar pruebas, o configurar desde cero en el panel. Entregarles la cuenta (o el proyecto) para que ellos paguen hosting y, más adelante, dominio. |
| **Código** | Repo del producto en **organización GitHub**; cuando “le pasas” el sistema a un cliente, en la práctica le pasas **esa cuenta/proyecto de Railway** (y opcionalmente una copia del repo en un repo suyo si quieren tener el código). No hace falta que todo siga en la cuenta personal. |

---

## 6. Persistencia de la base de datos (importante para ti y para el cliente)

Para que **los usuarios y reservas no se borren en cada deploy** en Railway hace falta:

1. **Volume** asociado al servicio **web** (en el proyecto debe aparecer algo tipo "web-volume" en la arquitectura).
2. **Variable `DATABASE_PATH`** en el servicio **web** con valor **exactamente** el **Mount Path del volumen** + **`/database.db`** (p. ej. si el volumen está montado en `/data` → `DATABASE_PATH=/data/database.db`; si está en `/app/data` → `DATABASE_PATH=/app/data/database.db`).

Si el volumen está bien pero `DATABASE_PATH` apunta a otra ruta, la app escribe en el disco del contenedor y los datos se pierden en cada push. Detalle completo en **VERIFICAR_PERSISTENCIA_BD.md**.

Al entregar el sistema a un cliente (cuenta nueva en Railway): en ese proyecto, crear el Volume, anotar el Mount Path y configurar `DATABASE_PATH` como arriba. Así su instalación mantendrá usuarios y datos entre deploys.

---

## 7. Checklist rápido

- [ ] Crear organización en GitHub y repo del producto.
- [ ] Crear cuenta Railway “de negocio”.
- [ ] Por cada demo: nuevo proyecto en Railway, mismo repo, **Volume + DATABASE_PATH** (ver §6), configurar panel con datos del psicólogo, compartir URL.
- [ ] Cuando compren: nueva cuenta Railway (cliente) → un proyecto → **Volume + DATABASE_PATH** → desplegar → migrar BD si aplica → entregar acceso.
- [ ] Dominio: cuando el cliente tenga uno, añadirlo en Railway + DNS.
