#!/bin/bash

# ============================================================================
# Script de Deploy Automatizado - Ticketz LeadEngine
# ============================================================================

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Verificar se Docker está instalado
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker não está instalado!"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose não está instalado!"
        exit 1
    fi
    
    log_success "Docker e Docker Compose encontrados"
}

# Verificar se o arquivo .env existe
check_env() {
    if [ ! -f ".env" ]; then
        if [ -f ".env.production" ]; then
            log_info "Copiando .env.production para .env"
            cp .env.production .env
        else
            log_error "Arquivo .env não encontrado! Crie um baseado no .env.production"
            exit 1
        fi
    fi
    log_success "Arquivo .env encontrado"
}

# Fazer backup do banco de dados
backup_database() {
    if [ "$SKIP_BACKUP" != "true" ]; then
        log_info "Fazendo backup do banco de dados..."
        
        # Criar diretório de backup se não existir
        mkdir -p backups
        
        # Nome do arquivo de backup com timestamp
        BACKUP_FILE="backups/ticketz_backup_$(date +%Y%m%d_%H%M%S).sql"
        
        # Fazer backup usando docker-compose
        if docker-compose ps postgres | grep -q "Up"; then
            docker-compose exec -T postgres pg_dump -U ticketz -d ticketz > "$BACKUP_FILE"
            log_success "Backup salvo em: $BACKUP_FILE"
        else
            log_warning "Container do PostgreSQL não está rodando, pulando backup"
        fi
    else
        log_info "Backup pulado (SKIP_BACKUP=true)"
    fi
}

# Parar serviços existentes
stop_services() {
    log_info "Parando serviços existentes..."
    docker-compose down --remove-orphans
    log_success "Serviços parados"
}

# Limpar imagens antigas (opcional)
cleanup_images() {
    if [ "$CLEANUP_IMAGES" = "true" ]; then
        log_info "Limpando imagens Docker antigas..."
        docker system prune -f
        docker image prune -f
        log_success "Limpeza concluída"
    fi
}

# Build das imagens
build_images() {
    log_info "Fazendo build das imagens Docker..."
    
    # Build com cache para acelerar
    docker-compose -f docker-compose.prod.yml build --parallel
    
    log_success "Build das imagens concluído"
}

# Executar migrações do banco
run_migrations() {
    log_info "Executando migrações do banco de dados..."
    
    # Iniciar apenas o banco para executar migrações
    docker-compose -f docker-compose.prod.yml up -d postgres redis
    
    # Aguardar banco ficar pronto
    log_info "Aguardando banco de dados ficar pronto..."
    sleep 10
    
    # Executar migrações
    docker-compose -f docker-compose.prod.yml run --rm api sh -c "cd apps/api && pnpm db:push && pnpm db:seed"
    
    log_success "Migrações executadas"
}

# Iniciar todos os serviços
start_services() {
    log_info "Iniciando todos os serviços..."
    
    docker-compose -f docker-compose.prod.yml up -d
    
    log_success "Serviços iniciados"
}

# Verificar saúde dos serviços
check_health() {
    log_info "Verificando saúde dos serviços..."
    
    # Aguardar um pouco para os serviços iniciarem
    sleep 30
    
    # Verificar API
    if curl -f http://localhost:4000/health > /dev/null 2>&1; then
        log_success "API está saudável"
    else
        log_error "API não está respondendo!"
        return 1
    fi
    
    # Verificar Frontend
    if curl -f http://localhost/health > /dev/null 2>&1; then
        log_success "Frontend está saudável"
    else
        log_error "Frontend não está respondendo!"
        return 1
    fi
    
    log_success "Todos os serviços estão saudáveis"
}

# Mostrar logs em caso de erro
show_logs() {
    log_error "Deploy falhou! Mostrando logs dos últimos 50 linhas:"
    echo "==================== LOGS API ===================="
    docker-compose -f docker-compose.prod.yml logs --tail=50 api
    echo "==================== LOGS WEB ===================="
    docker-compose -f docker-compose.prod.yml logs --tail=50 web
    echo "==================== LOGS POSTGRES ===================="
    docker-compose -f docker-compose.prod.yml logs --tail=50 postgres
}

# Função principal
main() {
    log_info "🚀 Iniciando deploy do Ticketz LeadEngine..."
    
    # Verificações iniciais
    check_docker
    check_env
    
    # Fazer backup se não for pulado
    backup_database
    
    # Parar serviços existentes
    stop_services
    
    # Limpar imagens se solicitado
    cleanup_images
    
    # Build das novas imagens
    build_images
    
    # Executar migrações
    run_migrations
    
    # Iniciar serviços
    start_services
    
    # Verificar saúde
    if check_health; then
        log_success "🎉 Deploy concluído com sucesso!"
        log_info "Aplicação disponível em:"
        log_info "  Frontend: http://localhost"
        log_info "  API: http://localhost:4000"
        log_info "  Logs: docker-compose -f docker-compose.prod.yml logs -f"
    else
        log_error "❌ Deploy falhou na verificação de saúde"
        show_logs
        exit 1
    fi
}

# Tratamento de erro
trap 'log_error "Deploy interrompido!"; show_logs; exit 1' ERR

# Verificar argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --cleanup-images)
            CLEANUP_IMAGES=true
            shift
            ;;
        --help)
            echo "Uso: $0 [opções]"
            echo "Opções:"
            echo "  --skip-backup     Pular backup do banco de dados"
            echo "  --cleanup-images  Limpar imagens Docker antigas"
            echo "  --help           Mostrar esta ajuda"
            exit 0
            ;;
        *)
            log_error "Opção desconhecida: $1"
            exit 1
            ;;
    esac
done

# Executar deploy
main
