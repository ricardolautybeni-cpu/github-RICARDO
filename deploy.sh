#!/bin/bash

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Variables
BACKEND_PORT=3001
WEB_PORT=3000
DB_NAME="distribuidora_db"
DB_USER="postgres"

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        DISTRIBUIDORA MULTI-RUBRO - Script de Deploy            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Función para verificar si un servicio está corriendo
check_service() {
  local port=$1
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
    return 0
  else
    return 1
  fi
}

# Función para instalar dependencias
install_dependencies() {
  echo -e "${BLUE}[*] Instalando dependencias...${NC}"
  
  # Backend
  echo -e "${YELLOW}  → Backend${NC}"
  (cd backend && npm install 2>/dev/null)
  
  # Frontend Web
  echo -e "${YELLOW}  → Frontend Web${NC}"
  (cd frontend-web && npm install 2>/dev/null)
  
  # Frontend Móvil
  echo -e "${YELLOW}  → Frontend Móvil${NC}"
  (cd frontend-mobile && npm install 2>/dev/null)
  
  echo -e "${GREEN}✓ Dependencias instaladas${NC}"
}

# Función para crear BD
create_database() {
  echo -e "${BLUE}[*] Verificando base de datos...${NC}"
  
  if createdb -U $DB_USER $DB_NAME 2>/dev/null; then
    echo -e "${GREEN}✓ BD creada${NC}"
  else
    echo -e "${YELLOW}⚠ BD ya existe${NC}"
  fi
}

# Función para migrar BD
migrate_database() {
  echo -e "${BLUE}[*] Ejecutando migraciones...${NC}"
  (cd backend && npm run migrate 2>/dev/null)
  echo -e "${GREEN}✓ BD migrada${NC}"
}

# Función para iniciar servicios
start_services() {
  echo -e "${BLUE}[*] Iniciando servicios...${NC}"
  
  # Backend
  echo -e "${YELLOW}  → Backend (puerto $BACKEND_PORT)${NC}"
  (cd backend && npm run dev > /tmp/backend.log 2>&1 &)
  sleep 2
  
  if check_service $BACKEND_PORT; then
    echo -e "${GREEN}✓ Backend corriendo${NC}"
  else
    echo -e "${RED}✗ Backend falló - Ver /tmp/backend.log${NC}"
    return 1
  fi
  
  # Frontend Web
  echo -e "${YELLOW}  → Frontend Web (puerto $WEB_PORT)${NC}"
  (cd frontend-web && npm start > /tmp/web.log 2>&1 &)
  sleep 3
  
  echo -e "${GREEN}✓ Frontend Web iniciado${NC}"
  
  echo ""
  echo -e "${GREEN}✅ Todos los servicios están corriendo${NC}"
  echo ""
  echo "URLs:"
  echo "  🔌 Backend API:  http://localhost:$BACKEND_PORT/api"
  echo "  🌐 Frontend Web: http://localhost:$WEB_PORT"
  echo "  📱 Mobile:       npm start en frontend-mobile/"
  echo ""
  echo "Logs:"
  echo "  Backend: tail -f /tmp/backend.log"
  echo "  Web:     tail -f /tmp/web.log"
}

# Función para verificar requisitos
check_requirements() {
  echo -e "${BLUE}[*] Verificando requisitos...${NC}"
  
  local missing=0
  
  # Node.js
  if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js no instalado${NC}"
    missing=$((missing+1))
  else
    echo -e "${GREEN}✓ Node.js $(node --version)${NC}"
  fi
  
  # PostgreSQL
  if ! command -v psql &> /dev/null; then
    echo -e "${RED}✗ PostgreSQL no instalado${NC}"
    missing=$((missing+1))
  else
    echo -e "${GREEN}✓ PostgreSQL$(psql --version | cut -d' ' -f3)${NC}"
  fi
  
  # npm
  if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm no instalado${NC}"
    missing=$((missing+1))
  else
    echo -e "${GREEN}✓ npm $(npm --version)${NC}"
  fi
  
  if [ $missing -gt 0 ]; then
    echo -e "${RED}Instala los requisitos faltantes${NC}"
    return 1
  fi
  
  return 0
}

# Función para mostrar status
show_status() {
  echo -e "${BLUE}[*] Estado de servicios:${NC}"
  
  if check_service $BACKEND_PORT; then
    echo -e "${GREEN}✓ Backend corriendo (puerto $BACKEND_PORT)${NC}"
  else
    echo -e "${RED}✗ Backend no está corriendo${NC}"
  fi
  
  if check_service $WEB_PORT; then
    echo -e "${GREEN}✓ Frontend Web corriendo (puerto $WEB_PORT)${NC}"
  else
    echo -e "${RED}✗ Frontend Web no está corriendo${NC}"
  fi
}

# Menú principal
if [ $# -eq 0 ]; then
  echo "Uso: $0 [comando]"
  echo ""
  echo "Comandos:"
  echo "  install   - Instalar dependencias"
  echo "  db        - Crear y migrar BD"
  echo "  start     - Iniciar todos los servicios"
  echo "  setup     - Setup completo (install + db + start)"
  echo "  status    - Ver estado de servicios"
  echo "  clean     - Limpiar logs temporales"
  echo ""
  exit 0
fi

case "$1" in
  install)
    check_requirements && install_dependencies
    ;;
  db)
    create_database && migrate_database
    ;;
  start)
    start_services
    ;;
  setup)
    check_requirements && \
    install_dependencies && \
    create_database && \
    migrate_database && \
    start_services
    ;;
  status)
    show_status
    ;;
  clean)
    echo -e "${BLUE}[*] Limpiando logs...${NC}"
    rm -f /tmp/backend.log /tmp/web.log
    echo -e "${GREEN}✓ Logs limpios${NC}"
    ;;
  *)
    echo "Comando no reconocido: $1"
    exit 1
    ;;
esac
