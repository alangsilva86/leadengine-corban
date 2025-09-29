# 🚀 Guia de Deploy em Produção - Ticketz LeadEngine

Este guia fornece instruções passo a passo para realizar o deploy do Ticketz LeadEngine em um ambiente de produção.

## 📋 Pré-requisitos

- **Servidor Linux** (Ubuntu 20.04+ recomendado)
- **Docker** e **Docker Compose** instalados
- **Domínio** configurado (opcional, mas recomendado)
- **Certificado SSL** (Let's Encrypt recomendado)

## 🔧 Preparação do Servidor

### 1. Instalar Docker

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Clonar o Repositório

```bash
git clone https://github.com/alangsilva86/leadengine-corban.git
cd leadengine-corban
```

## ⚙️ Configuração

### 1. Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.production.example .env

# Editar configurações
nano .env
```

**⚠️ IMPORTANTE**: Altere os seguintes valores obrigatoriamente:

- `POSTGRES_PASSWORD`: Use uma senha forte
- `JWT_SECRET`: Gere com `openssl rand -base64 64`
- `FRONTEND_URL`: Seu domínio real
- `CORS_ALLOWED_ORIGINS`: Caso tenha múltiplos domínios/frontends que consomem a API, liste-os separados por vírgula
- `VITE_API_URL`: URL da API (ex: https://api.seudominio.com)

### 2. Configurar Domínio (Opcional)

Se você tem um domínio, configure os DNS:

```
A    @           IP_DO_SERVIDOR
A    api         IP_DO_SERVIDOR
A    www         IP_DO_SERVIDOR
```

## 🚀 Deploy

### 1. Deploy Automatizado

Use o script de deploy incluído:

```bash
# Dar permissão de execução
chmod +x scripts/deploy.sh

# Executar deploy
./scripts/deploy.sh
```

### 2. Deploy Manual

Se preferir fazer manualmente:

```bash
# Build das imagens
docker compose -f docker-compose.prod.yml build

# Iniciar banco de dados
docker compose -f docker-compose.prod.yml up -d postgres redis

# Aguardar banco ficar pronto
sleep 30

# Executar migrações
docker compose -f docker-compose.prod.yml run --rm api sh -c "cd apps/api && pnpm db:push && pnpm db:seed"

# Iniciar todos os serviços
docker compose -f docker-compose.prod.yml up -d
```

### 3. Deploy no Render.com

Caso utilize o Render.com para hospedar a API como serviço web, configure os comandos conforme abaixo para garantir que os pacotes compartilhados estejam compilados antes da execução do servidor:

| Etapa | Comando |
| --- | --- |
| Build Command | `pnpm --filter @ticketz/api run build` |
| Start Command | `pnpm --filter @ticketz/api start` |

> ℹ️ O script `build` da API dispara `build:dependencies` (com `pnpm --dir ../.. -r --filter ... run build`) antes do `tsup`. Assim, os diretórios `dist` dos pacotes `@ticketz/{core,shared,storage,integrations}` são gerados antes do `node dist/server.js`, evitando erros de resolução de módulos nas etapas de deploy e runtime.

> ⚠️ Se o **WhatsApp Broker** também estiver hospedado no Render, inclua/reveja as rotas permitidas para aceitar `POST /instances/:id/start` (ou o fallback `POST /instances/:id/request-pairing-code`). A API passa a utilizar esses endpoints para iniciar o pareamento e solicitar novos QR Codes; certifique-se de que o serviço do broker esteja atualizado para respondê-los.

#### Variáveis de ambiente obrigatórias no Render

Além das variáveis já definidas na seção de configuração (como `DATABASE_URL`, `JWT_SECRET`, `VITE_API_URL`, etc.), configure explicitamente no Render:

- **Serviço da API**
  - `JWT_SECRET`, `POSTGRES_PASSWORD`, `DATABASE_URL` (ou parâmetros individuais), `REDIS_URL` (quando aplicável).
  - Garanta que exista um operador demo com e-mail/senha conhecidos rodando `pnpm --filter @ticketz/api db:seed` após provisionar o banco ou criando o usuário manualmente.
- **Serviço Web (frontend)**
  - `VITE_API_URL`: URL pública da API (ex.: `https://api.seudominio.com`).
  - `VITE_DEMO_TENANT_ID`: tenant padrão para o operador demo (ex.: `demo-tenant`).
  - `VITE_DEMO_OPERATOR_EMAIL` e `VITE_DEMO_OPERATOR_PASSWORD`: credenciais que serão pré-preenchidas no modal de login do frontend.
  - (Opcional) `VITE_API_AUTH_TOKEN`: token JWT estático usado apenas como fallback caso nenhuma sessão seja gerada no navegador.

> 🔐 Caso prefira não armazenar a senha do operador em variáveis do Render, gere manualmente um JWT válido com o comando `pnpm --filter @ticketz/api exec ts-node scripts/generate-jwt.ts --email operador@exemplo.com` e preencha o valor em `VITE_API_AUTH_TOKEN`. Sem o token ou o usuário seedado, o modal de autenticação não conseguirá criar a sessão demo.

## 🔍 Verificação

### 1. Verificar Status dos Serviços

```bash
# Ver status dos containers
docker compose -f docker-compose.prod.yml ps

# Ver logs
docker compose -f docker-compose.prod.yml logs -f
```

### 2. Testar Endpoints

```bash
# Testar API
curl http://localhost:4000/health

# Testar Frontend
curl http://localhost/health
```

## 🔒 SSL/HTTPS (Recomendado)

### 1. Instalar Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Configurar Nginx Proxy

Crie um arquivo `/etc/nginx/sites-available/ticketz`:

```nginx
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;

    location / {
        proxy_pass http://localhost;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.seudominio.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Ativar Site e Obter SSL

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/ticketz /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Obter certificado SSL
sudo certbot --nginx -d seudominio.com -d www.seudominio.com -d api.seudominio.com
```

## 📊 Monitoramento

### 1. Logs

```bash
# Ver logs em tempo real
docker compose -f docker-compose.prod.yml logs -f

# Ver logs específicos
docker compose -f docker-compose.prod.yml logs api
docker compose -f docker-compose.prod.yml logs web
docker compose -f docker-compose.prod.yml logs postgres
```

### 2. Métricas

```bash
# Ver uso de recursos
docker stats

# Ver espaço em disco
df -h

# Ver uso de memória
free -h
```

## 🔄 Atualizações

### 1. Atualizar Código

```bash
# Fazer backup
./scripts/deploy.sh --skip-backup

# Puxar atualizações
git pull origin main

# Rebuild e redeploy
./scripts/deploy.sh
```

### 2. Backup Manual

```bash
# Backup do banco
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U ticketz_user -d ticketz_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup dos uploads
tar -czf uploads_backup_$(date +%Y%m%d_%H%M%S).tar.gz uploads/
```

## 🆘 Troubleshooting

### 1. Problemas Comuns

**Container não inicia:**
```bash
# Ver logs detalhados
docker compose -f docker-compose.prod.yml logs [service_name]

# Verificar configuração
docker compose -f docker-compose.prod.yml config
```

**Banco de dados não conecta:**
```bash
# Verificar se o banco está rodando
docker compose -f docker-compose.prod.yml ps postgres

# Testar conexão
docker compose -f docker-compose.prod.yml exec postgres psql -U ticketz_user -d ticketz_prod -c "SELECT 1;"
```

**API não responde:**
```bash
# Verificar logs da API
docker compose -f docker-compose.prod.yml logs api

# Verificar se a porta está aberta
netstat -tlnp | grep :4000
```

### 2. Reiniciar Serviços

```bash
# Reiniciar tudo
docker compose -f docker-compose.prod.yml restart

# Reiniciar serviço específico
docker compose -f docker-compose.prod.yml restart api
```

## 📞 Suporte

Para suporte técnico ou dúvidas sobre o deploy:

1. Verifique os logs primeiro
2. Consulte a documentação no README.md
3. Abra uma issue no repositório GitHub

---

**✅ Após seguir este guia, seu Ticketz LeadEngine estará rodando em produção!**
