#!/bin/bash
# Script de instalación rápida

echo "🚀 DISTRIBUIDORA - Instalación Rápida"
echo "======================================"

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Backend
echo -e "${BLUE}[1/3] Instalando Backend...${NC}"
cd backend
npm install
echo -e "${GREEN}✓ Backend listo${NC}"

# 2. Frontend Web
echo -e "${BLUE}[2/3] Instalando Frontend Web...${NC}"
cd ../frontend-web
npm install
echo -e "${GREEN}✓ Frontend Web listo${NC}"

# 3. Frontend Móvil
echo -e "${BLUE}[3/3] Instalando Frontend Móvil...${NC}"
cd ../frontend-mobile
npm install
echo -e "${GREEN}✓ Frontend Móvil listo${NC}"

echo ""
echo -e "${GREEN}✅ Instalación completada${NC}"
echo ""
echo "Próximos pasos:"
echo ""
echo "1. Configurar Base de Datos:"
echo "   createdb distribuidora_db"
echo ""
echo "2. Backend:"
echo "   cd backend && npm run migrate && npm run dev"
echo ""
echo "3. Web:"
echo "   cd frontend-web && npm start"
echo ""
echo "4. Móvil:"
echo "   cd frontend-mobile && npm start"
echo ""
