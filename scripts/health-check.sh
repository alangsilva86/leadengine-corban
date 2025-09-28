#!/bin/bash

# ============================================================================
# Script de Health Check - Ticketz LeadEngine
# ============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
API_URL="${API_URL:-http://localhost:4000}"
WEB_URL="${WEB_URL:-http://localhost}"
TIMEOUT="${TIMEOUT:-10}"

# Funções de log
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se curl está disponível
check_curl() {
    if ! command -v curl &> /dev/null; then
        log_error "curl não está instalado!"
        exit 1
    fi
}

# Verificar API
check_api() {
    log_info "Verificando API em $API_URL..."
    
    # Health check endpoint
    if curl -f -s --max-time $TIMEOUT "$API_URL/health" > /dev/null; then
        log_success "API está respondendo"
        return 0
    else
        log_error "API não está respondendo"
        return 1
    fi
}

# Verificar Frontend
check_frontend() {
    log_info "Verificando Frontend em $WEB_URL..."
    
    # Health check endpoint
    if curl -f -s --max-time $TIMEOUT "$WEB_URL/health" > /dev/null; then
        log_success "Frontend está respondendo"
        return 0
    else
        log_error "Frontend não está respondendo"
        return 1
    fi
}

# Verificar banco de dados
check_database() {
    log_info "Verificando banco de dados..."
    
    if docker compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
        log_success "PostgreSQL está rodando"
        return 0
    else
        log_error "PostgreSQL não está rodando"
        return 1
    fi
}

# Verificar Redis
check_redis() {
    log_info "Verificando Redis..."
    
    if docker compose -f docker-compose.prod.yml ps redis | grep -q "Up"; then
        log_success "Redis está rodando"
        return 0
    else
        log_error "Redis não está rodando"
        return 1
    fi
}

# Verificar containers Docker
check_containers() {
    log_info "Verificando containers Docker..."
    
    local containers=("postgres" "redis" "api" "web")
    local failed=0
    
    for container in "${containers[@]}"; do
        if docker compose -f docker-compose.prod.yml ps $container | grep -q "Up"; then
            log_success "Container $container está rodando"
        else
            log_error "Container $container não está rodando"
            failed=$((failed + 1))
        fi
    done
    
    if [ $failed -eq 0 ]; then
        return 0
    else
        return 1
    fi
}

# Verificar uso de recursos
check_resources() {
    log_info "Verificando uso de recursos..."
    
    # Verificar espaço em disco
    local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $disk_usage -gt 90 ]; then
        log_warning "Uso de disco alto: ${disk_usage}%"
    else
        log_success "Uso de disco OK: ${disk_usage}%"
    fi
    
    # Verificar memória
    local mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ $mem_usage -gt 90 ]; then
        log_warning "Uso de memória alto: ${mem_usage}%"
    else
        log_success "Uso de memória OK: ${mem_usage}%"
    fi
}

# Verificar conectividade com APIs externas
check_external_apis() {
    log_info "Verificando conectividade com APIs externas..."
    
    # Lead Engine
    if curl -f -s --max-time $TIMEOUT "https://lead-engine-production.up.railway.app" > /dev/null; then
        log_success "Lead Engine está acessível"
    else
        log_warning "Lead Engine não está acessível"
    fi
    
    # Lead Engine Credit
    if curl -f -s --max-time $TIMEOUT "https://lead-engine-credit-production.up.railway.app" > /dev/null; then
        log_success "Lead Engine Credit está acessível"
    else
        log_warning "Lead Engine Credit não está acessível"
    fi
}

# Função principal
main() {
    log_info "🔍 Iniciando health check do Ticketz LeadEngine..."
    echo
    
    local failed=0
    
    # Verificações básicas
    check_curl
    
    # Verificar containers
    if ! check_containers; then
        failed=$((failed + 1))
    fi
    echo
    
    # Verificar serviços
    if ! check_database; then
        failed=$((failed + 1))
    fi
    
    if ! check_redis; then
        failed=$((failed + 1))
    fi
    echo
    
    # Verificar endpoints
    if ! check_api; then
        failed=$((failed + 1))
    fi
    
    if ! check_frontend; then
        failed=$((failed + 1))
    fi
    echo
    
    # Verificar recursos
    check_resources
    echo
    
    # Verificar APIs externas
    check_external_apis
    echo
    
    # Resultado final
    if [ $failed -eq 0 ]; then
        log_success "✅ Todos os health checks passaram!"
        exit 0
    else
        log_error "❌ $failed health check(s) falharam!"
        exit 1
    fi
}

# Verificar argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        --api-url)
            API_URL="$2"
            shift 2
            ;;
        --web-url)
            WEB_URL="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --help)
            echo "Uso: $0 [opções]"
            echo "Opções:"
            echo "  --api-url URL     URL da API (padrão: http://localhost:4000)"
            echo "  --web-url URL     URL do frontend (padrão: http://localhost)"
            echo "  --timeout SECS    Timeout para requests (padrão: 10)"
            echo "  --help           Mostrar esta ajuda"
            exit 0
            ;;
        *)
            log_error "Opção desconhecida: $1"
            exit 1
            ;;
    esac
done

# Executar health check
main
