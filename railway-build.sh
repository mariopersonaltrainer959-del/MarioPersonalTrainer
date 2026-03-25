#!/bin/bash
set -e

echo "🔧 Railway Build Script - Webs de Reservas"
echo "=========================================="

# Eliminar package-lock.json de la raíz
echo "1. Eliminando package-lock.json de directorios padre..."
find .. -maxdepth 2 -name 'package-lock.json' ! -path './package-lock.json' -delete 2>/dev/null || true
find ../.. -maxdepth 1 -name 'package-lock.json' -delete 2>/dev/null || true

# Verificar que estamos usando el package-lock.json correcto
echo "2. Verificando package-lock.json del proyecto..."
if grep -q "plantilla-reservas-psicologo" package-lock.json; then
    echo "✅ package-lock.json correcto detectado"
else
    echo "❌ ERROR: package-lock.json incorrecto o no encontrado"
    exit 1
fi

# Verificar que NO contiene Next.js
if grep -qi "next" package-lock.json; then
    echo "❌ ERROR: package-lock.json contiene Next.js (no debería)"
    exit 1
else
    echo "✅ Confirmado: package-lock.json NO contiene Next.js"
fi

# Instalar dependencias
echo "3. Instalando dependencias..."
npm ci --ignore-scripts

echo "✅ Build completado correctamente"
