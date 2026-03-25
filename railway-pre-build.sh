#!/bin/bash
# Script para Railway que elimina el package-lock.json de la raíz antes de instalar

echo "🔧 Limpiando package-lock.json de la raíz del repositorio..."
rm -f ../package-lock.json || true
rm -f ../../package-lock.json || true

echo "✅ Limpieza completada. Instalando dependencias del proyecto..."
