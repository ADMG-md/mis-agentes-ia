#!/bin/bash

# ==============================================================================
# Script de Configuración de Entorno para VPS (Optimizado para Ubuntu 24.04 con Nginx)
# COE Caribe IPS - Junio 2026
# ==============================================================================

# Detener el script si ocurre algún error
set -e

# Colores para la salida
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # Sin Color

echo -e "${BLUE}=== Iniciando la configuración optimizada en la VPS ===${NC}\n"

# 1. Verificar que se ejecuta como root/sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: Este script debe ser ejecutado con privilegios de superusuario (sudo).${NC}"
  echo -e "Ejecuta: sudo bash $0"
  exit 1
fi

# 2. Instalar paquetes de sistema esenciales (SQLite y compiladores para HNSW)
echo -e "${YELLOW}[1/4] Instalando dependencias de base de datos local y compilación...${NC}"
apt update
apt install -y sqlite3 build-essential python3-pip python3-venv

# 3. Crear directorios del proyecto
echo -e "${YELLOW}[2/4] Creando directorios para la aplicación...${NC}"
APP_DIR="/var/www/mis-agentes-ia"
mkdir -p "$APP_DIR"

# Determinar el usuario real para asignarle los permisos
REAL_USER=${SUDO_USER:-$USER}
chown -R "$REAL_USER":"$REAL_USER" "$APP_DIR"
echo -e "${GREEN}Directorio '$APP_DIR' configurado para el usuario '$REAL_USER'.${NC}"

# 4. Configurar variables de entorno (.env)
echo -e "${YELLOW}[3/4] Creando archivo de variables de entorno (.env)...${NC}"
cd "$APP_DIR"

if [ ! -f ".env" ]; then
  cat <<EOT > .env
# Configuración de Servidor de Agentes
PORT=3010
GOOGLE_API_KEY=AQ.Ab8RN6Ipip52AFJaqMewTVjAOv2cox4tBnpICqKAQ4XQevErsA
# ANTHROPIC_API_KEY=tu_api_key_de_anthropic_aqui
CLAUDE_FLOW_MODE=v3
CLAUDE_FLOW_TOPOLOGY=hierarchical
CLAUDE_FLOW_MAX_AGENTS=5
CLAUDE_FLOW_MEMORY_BACKEND=hybrid

# Conexión con WhatsApp Gateway (Evolution API)
WHATSAPP_API_URL=http://localhost:8080
WHATSAPP_API_KEY=TuClaveSecretaWhatsApp123
EOT
  chown "$REAL_USER":"$REAL_USER" .env
  echo -e "${GREEN}Archivo .env creado en $APP_DIR. Ajusta la API Key cuando sea necesario.${NC}"
else
  echo -e "${GREEN}El archivo .env ya existía, se omitió su sobreescritura.${NC}"
fi

# 5. Instalar dependencias de Node.js y compilar servidores MCP de Growth Marketing
echo -e "${YELLOW}[4/5] Instalando dependencias del monorepo y compilando servidores MCP...${NC}"
cd "$APP_DIR"
if command -v npm &> /dev/null; then
  # Correr con privilegios de usuario para evitar problemas de permisos con better-sqlite3
  sudo -u "$REAL_USER" npm run bootstrap
  sudo -u "$REAL_USER" npm run build
  echo -e "${GREEN}Dependencias de Node.js y compilación de TypeScript completadas con éxito.${NC}"
else
  echo -e "${RED}Advertencia: 'npm' no está instalado. Asegúrate de instalar Node.js >= 20 antes de continuar.${NC}"
fi

# 6. Generar plantilla de configuración para Nginx
echo -e "${YELLOW}[5/5] Generando plantilla para bloque de servidor Nginx...${NC}"
NGINX_CONF="/etc/nginx/sites-available/coe-caribe"

if [ ! -f "$NGINX_CONF" ]; then
  cat <<EOT > "$NGINX_CONF"
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;

    # Nginx Proxy para el Dashboard Web (puerto 3030)
    location / {
        proxy_pass http://127.0.0.1:3030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOT
  echo -e "${GREEN}Plantilla de Nginx creada en $NGINX_CONF.${NC}"
  echo -e "${YELLOW}Para activarla cuando definas tu dominio, ejecuta:${NC}"
  echo -e "  sudo ln -s $NGINX_CONF /etc/nginx/sites-enabled/"
  echo -e "  sudo nginx -t"
  echo -e "  sudo systemctl restart nginx"
else
  echo -e "${GREEN}El archivo de configuración de Nginx para coe-caribe ya existía.${NC}"
fi

echo -e "\n${GREEN}=== Configuración optimizada de la VPS completada con éxito ===${NC}\n"
echo -e "${BLUE}Comandos para arrancar los servicios en segundo plano con PM2:${NC}"
echo -e "1. Iniciar el puente de Telegram (Control del bot conversacional):"
echo -e "   ${GREEN}pm2 start scripts/telegram_agent_bridge.js --name \"rrss-telegram-bridge\"${NC}"
echo -e "2. Iniciar el Dashboard visual de Growth Marketing (Puerto 3030):"
echo -e "   ${GREEN}pm2 start npm --name \"rrss-dashboard\" -- run start:dashboard${NC}"
echo -e "3. Configurar la escucha social (Social Listening) para ejecutarse cada 30 minutos:"
echo -e "   ${GREEN}pm2 start scripts/find_leads.js --name \"rrss-social-listening\" --cron \"*/30 * * * *\" --no-autorestart${NC}"
echo -e "4. Levantar la API de WhatsApp (Evolution API) en puerto 8080 (Docker):"
echo -e "   ${GREEN}sudo docker run -d --name evolution_api --restart always -p 8080:8080 -e API_KEY=TuClaveSecretaWhatsApp123 -v evolution_instances:/evolution/instances atendare/evolution-api:latest${NC}"
echo -e "5. Iniciar Ruflo MCP (Soporte Swarm/CLI):"
echo -e "   ${GREEN}pm2 start npx --name \"ruflo-mcp\" -- -y ruflo@latest mcp start${NC}"
