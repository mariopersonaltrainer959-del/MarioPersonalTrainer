# 🔧 Solución Definitiva para el Error de Railway

## ⚠️ Problema

Railway está leyendo el `package-lock.json` de la raíz del repositorio (que contiene Next.js de otro proyecto) en lugar del de `webs de reservas/`.

## ✅ Solución Aplicada

Se han creado múltiples capas de protección:

1. **`nixpacks.toml`** - Elimina el package-lock.json de la raíz antes de instalar
2. **`.railwayignore`** - Ignora archivos de la raíz
3. **Scripts de limpieza** - Eliminan el package-lock.json problemático

## 📋 Configuración en Railway (CRÍTICO)

### Opción 1: Root Directory (RECOMENDADO)

1. En Railway → **Settings** → **Service**
2. Busca **"Root Directory"** o **"Working Directory"**
3. Pon exactamente: `webs de reservas`
4. Guarda

### Opción 2: Si no hay Root Directory

Configura los comandos manualmente:

**Build Command:**
```bash
cd "webs de reservas" && rm -f ../package-lock.json && npm install
```

**Start Command:**
```bash
cd "webs de reservas" && npm start
```

### Opción 3: Variables de Entorno

Añade esta variable para forzar el directorio:

```
RAILWAY_ROOT_DIRECTORY=webs de reservas
```

## 🔍 Verificación

Después de configurar, en los logs de Railway deberías ver:

```
🔧 Eliminando package-lock.json de la raíz...
✅ Instalando dependencias del proyecto...
```

Y NO deberías ver:
- ❌ `next@15.4.6`
- ❌ Errores de vulnerabilidades de Next.js

## 🚨 Si Sigue Fallando

1. **Elimina el servicio en Railway** completamente
2. **Crea uno nuevo** desde cero
3. **Configura el Root Directory ANTES del primer deploy**
4. **Asegúrate de que el Root Directory sea exactamente**: `webs de reservas` (con el espacio)

## 📝 Nota Importante

El `package-lock.json` en la raíz (`/Users/albertogarciaarroyo/package-lock.json`) es de otro proyecto y NO debe ser usado por Railway para este proyecto.

El `package-lock.json` correcto está en: `webs de reservas/package-lock.json`

---

**La configuración del Root Directory es la solución más importante.** Sin ella, Railway seguirá leyendo archivos de la raíz.
