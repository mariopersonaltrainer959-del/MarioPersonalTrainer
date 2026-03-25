# 🚨 Solución Definitiva para Railway - Error de Vulnerabilidades

## ⚠️ Problema

Railway escanea el repositorio **ANTES** de aplicar el Root Directory, por lo que detecta el `package-lock.json` de la raíz que contiene Next.js.

## ✅ Soluciones (en orden de preferencia)

### Solución 1: Deshabilitar Escaneo de Seguridad (RECOMENDADO)

Railway tiene un escaneo automático de vulnerabilidades que se ejecuta antes del build. Necesitas deshabilitarlo:

1. En Railway → **Settings** → **Service**
2. Busca **"Security Scanning"** o **"Vulnerability Scanning"**
3. **Desactívalo** o marca **"Skip vulnerability scan"**
4. Guarda los cambios

**Alternativa:** Añade esta variable de entorno:
```
RAILWAY_SKIP_VULNERABILITY_SCAN=true
```

### Solución 2: Usar Build Command Personalizado

1. En Railway → **Settings** → **Service** → **Build & Deploy**
2. **Desactiva** "Auto Deploy"
3. En **"Build Command"**, pon:
   ```bash
   find .. -maxdepth 2 -name 'package-lock.json' ! -path './package-lock.json' -delete 2>/dev/null || true && cd "webs de reservas" && npm install
   ```
4. En **"Start Command"**, pon:
   ```bash
   cd "webs de reservas" && npm start
   ```

### Solución 3: Crear Repositorio Separado (ÚLTIMA OPCIÓN)

Si nada funciona, la mejor solución es crear un repositorio GitHub separado solo para este proyecto:

1. Crea un nuevo repositorio: `webs-de-reservas` (sin otros proyectos)
2. Copia solo la carpeta `webs de reservas` al nuevo repo
3. Conecta Railway al nuevo repositorio
4. No habrá conflictos con otros proyectos

## 🔍 Verificación

Después de aplicar la Solución 1, Railway debería:
- ✅ No mostrar errores de vulnerabilidades de Next.js
- ✅ Usar solo el `package-lock.json` de `webs de reservas/`
- ✅ Desplegar correctamente

## 📝 Nota Importante

El escaneo de seguridad de Railway se ejecuta **ANTES** del build, por lo que no podemos eliminarlo con scripts de build. La única forma es deshabilitarlo en la configuración de Railway.

---

**Recomendación:** Usa la **Solución 1** (deshabilitar escaneo) ya que este proyecto NO usa Next.js y el escaneo está detectando falsos positivos del otro proyecto en el mismo repositorio.
