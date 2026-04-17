#!/bin/bash

# run_phare.sh — Script de automação para o ecossistema pHARe
# Este script inicia os servidores de Auth, API e Frontend simultaneamente.

# Cores para o terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${GREEN}      🚀 Iniciando Ecossistema pHARe Modernizado    ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Função para encerrar todos os processos ao fechar o script
cleanup() {
    echo -e "\n${YELLOW}🛑 Encerrando servidores...${NC}"
    kill $NODE_PID $JAVA_PID $FRONT_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# 1. Iniciar Auth Service (Node.js) - Porta 3000
echo -e "${YELLOW}[1/3] Iniciando Serviço de Autenticação (Node.js)...${NC}"
cd backend-node
if [ ! -d "node_modules" ]; then
    echo "Instalando dependências do Node..."
    npm install --silent
fi
node server.js > /dev/null 2>&1 &
NODE_PID=$!
cd ..

# 2. Iniciar API REST (Java) - Porta 8080
echo -e "${YELLOW}[2/3] Iniciando API REST (Spring Boot)...${NC}"
cd backend
mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=8080 > /dev/null 2>&1 &
JAVA_PID=$!
cd ..

# 3. Iniciar Frontend (Static Server) - Porta 8000
echo -e "${YELLOW}[3/3] Iniciando Servidor Frontend (Python)...${NC}"
cd frontend
python3 -m http.server 8000 > /dev/null 2>&1 &
FRONT_PID=$!
cd ..

echo -e "${GREEN}✅ Todos os serviços estão subindo!${NC}"
echo -e "----------------------------------------------------"
echo -e "🔑 Auth: http://localhost:3000"
echo -e "📡 API:  http://localhost:8080"
echo -e "🌐 App:  http://localhost:8000/login.html"
echo -e "----------------------------------------------------"
echo -e "${BLUE}Pressione CTRL+C para encerrar todos os servidores.${NC}"

# Aguarda um momento para os servidores subirem e tenta abrir o navegador
sleep 5
if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:8000/login.html
elif command -v open > /dev/null; then
    open http://localhost:8000/login.html
fi

# Mantém o script rodando para monitorar os processos
wait
