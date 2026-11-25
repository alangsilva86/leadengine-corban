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

- `DATABASE_URL`: string completa de conexão PostgreSQL usada pela API (Compose já exporta, mas pipelines como Render exigem o valor explícito).
- `POSTGRES_PASSWORD`: Use uma senha forte para o banco interno (caso utilize Compose).
- `JWT_SECRET`: Gere com `openssl rand -base64 64` — sem ele a emissão de tokens falhará.
- `FRONTEND_URL`: Seu domínio real.
- `CORS_ALLOWED_ORIGINS`: Caso tenha múltiplos domínios/frontends que consomem a API, liste-os separados por vírgula.
- `VITE_API_URL`: URL da API (ex: https://api.seudominio.com) consumida pelo frontend.
- `VITE_AUTH_PROVIDER`, `VITE_DEFAULT_TENANT_HINT`, `VITE_AUTH_PREFILL_EMAIL`, `VITE_AUTH_PREFILL_PASSWORD`: controlam o formulário de login e o link "Iniciar onboarding guiado" quando o provider é `invite`.
- `ONBOARDING_INVITE_EMAIL_FROM`, `ONBOARDING_INVITE_SMS_SENDER` e `ONBOARDING_PORTAL_BASE_URL`: habilitam o envio de convites e o link público `/onboarding`.
- Remova qualquer variável `WHATSAPP_MODE` legada; o transporte HTTP é o único modo disponível e a aplicação aborta o boot se detectar a variável. Configure `WHATSAPP_BROKER_URL`, `WHATSAPP_BROKER_API_KEY`, `WHATSAPP_WEBHOOK_API_KEY` e (se aplicável) `WHATSAPP_WEBHOOK_HMAC_SECRET`.

### 1.1. Nota sobre o sidecar legado

O runtime sidecar Baileys foi removido desta base. Não é mais necessário preparar volumes ou diretórios dedicados a sessões — qualquer configuração existente com `WHATSAPP_MODE=sidecar` agora falha na inicialização até que a variável seja removida do ambiente.
- Integração WhatsApp: configure `WHATSAPP_BROKER_URL`, `WHATSAPP_BROKER_API_KEY`, `WHATSAPP_WEBHOOK_API_KEY` (se aplicável) e mantenha `WHATSAPP_MODE` ausente; qualquer definição interrompe a aplicação.

### 2. Configurar Domínio (Opcional)

Se você tem um domínio, configure os DNS:

```
A    @           IP_DO_SERVIDOR
A    api         IP_DO_SERVIDOR
A    www         IP_DO_SERVIDOR
```

## 🚀 Deploy

### ✅ Validação obrigatória dos pacotes

Antes de iniciar qualquer estratégia de deploy, valide a geração dos artefatos do pacote core para evitar falhas de tipagem em produção:

```bash
corepack enable
corepack prepare pnpm@9.12.3 --activate
pnpm -w install --frozen-lockfile
pnpm --filter @ticketz/core --filter @ticketz/storage run build:clean
pnpm --filter @ticketz/core --filter @ticketz/storage run typecheck
```

Os dois últimos comandos garantem que os pacotes de domínio (`@ticketz/core`) e persistência (`@ticketz/storage`) gerem artefatos consistentes **antes** de qualquer build da API. A geração limpa vem primeiro para produzir as declarações e, em seguida, o `typecheck` valida os tipos (`TS6307`, `TS2307`, etc.) já com o contexto completo, evitando surpresas em produção.
O primeiro comando executa o bundle e recompila apenas as declarações TypeScript necessárias para o pacote, garantindo que os módulos `common`, `tickets` e `leads` estejam listados corretamente. Na sequência, o `typecheck` roda o `tsc --noEmit` e confirma que os tipos usados pelos serviços (`common/types.ts`, `tickets/types.ts`, `tickets/services.ts` e `leads/types.ts`) não geram o erro `TS6307` durante o pipeline.
pnpm --filter @ticketz/core --filter @ticketz/storage --filter @ticketz/integrations run build:clean
pnpm --filter @ticketz/core --filter @ticketz/storage --filter @ticketz/integrations run typecheck
```

Os dois últimos comandos garantem que os pacotes de domínio (`@ticketz/core`), persistência (`@ticketz/storage`) e integrações (`@ticketz/integrations`) gerem artefatos consistentes **antes** de qualquer build da API. A geração limpa vem primeiro para produzir as declarações e, em seguida, o `typecheck` valida os tipos (`TS6307`, `TS2307`, etc.) já com o contexto completo, evitando surpresas em produção.

```bash
pnpm --filter @ticketz/core build
pnpm --filter @ticketz/core typecheck
```

O primeiro comando executa o bundle e recompila apenas as declarações TypeScript necessárias para o pacote, garantindo que os contratos de domínio ativos permaneçam sincronizados. Na sequência, o `typecheck` roda o `tsc --noEmit` e confirma que os tipos usados pelos serviços (`common/types.ts` e demais contratos consumidos pelo core) não geram o erro `TS6307` durante o pipeline.

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

# Executar migrações (imagem one-off do alvo `migrate`, na rede do Compose)
docker build -f apps/api/Dockerfile --target migrate -t ticketz-api-migrate .
docker run --rm --network "$(basename "$PWD")_ticketz-network" \
  -e DATABASE_URL="postgresql://USUARIO:SENHA@postgres:5432/BANCO" \
  -e DATABASE_DIRECT_URL="postgresql://USUARIO:SENHA@postgres:5432/BANCO" \
  ticketz-api-migrate

# Iniciar todos os serviços
docker compose -f docker-compose.prod.yml up -d
```

#### Imagens Docker (API e Web)

As duas imagens são construídas a partir da **raiz** do monorepo (o `.dockerignore` da raiz mantém `node_modules`, `dist`, `.env*` e cópias `* 2` do iCloud fora do contexto):

| Imagem | Comando | Runtime |
| --- | --- | --- |
| API | `docker build -f apps/api/Dockerfile -t ticketz-api .` | `node:22.22.2-bookworm-slim`, usuário `node`, `node dist/server.mjs` na porta `4000`, healthcheck em `/ready` |
| Migrações | `docker build -f apps/api/Dockerfile --target migrate -t ticketz-api-migrate .` | workspace completo; executa `pnpm run db:migrate:deploy` |
| Web | `docker build -f apps/web/Dockerfile -t ticketz-web --build-arg VITE_API_URL=... .` | `nginx-unprivileged` (uid 101) na porta **8080**, `/health` |

- pnpm 9.12.3 vem do `packageManager` via Corepack e a instalação usa `pnpm install --frozen-lockfile`.
- A imagem da API contém só as dependências de produção (`pnpm deploy --prod`), o cliente Prisma gerado e o bundle. Diretórios graváveis: `/app/logs`, `/app/uploads` e `/app/data` (`POLL_METADATA_STORE_PATH=/app/data/poll-metadata.json`). Com bind mounts em Linux, dê permissão de escrita ao uid `1000`.
- As variáveis `VITE_*` do frontend são **build args** (entram no bundle); defini-las no runtime não tem efeito. Sem `VITE_API_URL` o app usa a mesma origem e o nginx encaminha `/api/` e `/socket.io/` para `API_UPSTREAM` (padrão `http://api:4000`, resolvido via DNS do Docker em `NGINX_RESOLVER=127.0.0.11`).
- A porta do container web passou de 80 para 8080 (nginx sem root); os arquivos Compose já publicam `5173:8080` (dev) e `${WEB_PORT:-80}:8080` (prod).

### 3. Deploy no Render.com

O ambiente da Render deve ser dividido em **dois serviços**: a API (serviço Node) e o frontend (serviço Static Site). Essa separação garante builds mais rápidos, isolamento de falhas e políticas de escalonamento independentes.

#### Serviço Node (API)

| Campo | Valor |
| --- | --- |
| Build Command | `bash scripts/build-api-render.sh` |
| Start Command | `NODE_ENV=production NODE_OPTIONS="--max-old-space-size=320" node apps/api/dist/server.mjs` |
| Node version | Defina `NODE_VERSION=22.22.2` (ou deixe o Render ler o `.node-version`/`.nvmrc`; o `package.json` exige `>=22.12 <23`) |

- **Cache**: habilite o diretório `./.pnpm-store` no menu de _Build Cache_ da Render. Os scripts já exportam `PNPM_STORE_PATH=.pnpm-store`, portanto a restauração será automática entre deploys.
- **Migrações**: utilize um _background worker_ ou _job manual_ com `pnpm run db:migrate:deploy` antes de promover novas releases. O script aplica `prisma migrate deploy` com limite de conexões (1 por padrão) e repetirá automaticamente em caso de saturação temporária do Postgres.
- **Health check**: configure `Path = /healthz`, `Timeout = 30s` e `Interval = 60s` para evitar reinícios agressivos.

Variáveis de ambiente (além das já mencionadas na seção de configuração geral):

- `DATABASE_URL`
- `NODE_ENV=production`
- `PRISMA_CLIENT_ENGINE_TYPE=binary` (opcional, acelera cold start)
- `PRISMA_MIGRATE_MAX_ATTEMPTS` (opcional, padrão `5`) e `PRISMA_MIGRATE_RETRY_DELAY_MS` (opcional, padrão `5000`) para ajustar as tentativas automáticas do script de migração
- `PRISMA_MIGRATE_ENGINE_MAX_DATABASE_CONNECTIONS` (opcional, padrão `1`) para limitar o número de conexões simultâneas usadas pelo engine do Prisma durante o deploy das migrações
- `PORT` (opcional; o Render define automaticamente, mas mantenha-a visível para debugging)
- `LOG_LEVEL` (opcional, padrão `info`)
- `JWT_SECRET`, `POSTGRES_PASSWORD`, `REDIS_URL`, etc.

> ℹ️ O script `build-api-render.sh` executa `pnpm run doctor` e o `build` da API, garantindo que todos os pacotes compartilhados sejam verificados antes do bundle final (`tsup`).

#### Serviço Static (Frontend)

| Campo | Valor |
| --- | --- |
| Build Command | `bash scripts/build-web-render.sh` |
| Publish Directory | `apps/web/dist` |

- **Rewrites**: adicione `/* -> /index.html` caso utilize o modo SPA (padrão).
- **Cache**: habilite também o diretório `./.pnpm-store` para reaproveitar o cache entre builds do frontend.
- **Variáveis**: defina `VITE_API_URL`, `VITE_WS_URL`, `VITE_AUTH_PROVIDER`, `VITE_DEFAULT_TENANT_HINT`, `VITE_AUTH_PREFILL_EMAIL` e `VITE_AUTH_PREFILL_PASSWORD` (opcional). Use `VITE_AUTH_PROVIDER=invite` para exibir o link do portal público.

> ⚠️ Se o **WhatsApp Broker** também estiver hospedado no Render, inclua/reveja as rotas permitidas para aceitar `POST /instances/:id/pair` (ou o fallback `POST /instances/:id/request-pairing-code`). A API passa a utilizar esses endpoints para iniciar o pareamento e solicitar novos QR Codes; certifique-se de que o serviço do broker esteja atualizado para respondê-los.

#### Variáveis de ambiente obrigatórias no Render

Além das variáveis já definidas na seção de configuração (como `DATABASE_URL`, `JWT_SECRET`, `VITE_API_URL`, etc.), configure explicitamente no Render:

- **Serviço da API**
  - `JWT_SECRET`, `POSTGRES_PASSWORD`, `DATABASE_URL` (ou parâmetros individuais), `REDIS_URL` (quando aplicável).
  - `ONBOARDING_INVITE_EMAIL_FROM`, `ONBOARDING_INVITE_SMS_SENDER`, `ONBOARDING_PORTAL_BASE_URL` apontando para a URL pública do frontend (`https://app.seudominio.com/onboarding`).
  - Garanta que exista um operador demo com e-mail/senha conhecidos rodando `pnpm --filter @ticketz/api db:seed` após provisionar o banco ou criando o usuário manualmente.
- **Serviço Web (frontend)**
  - `VITE_API_URL`: URL pública da API (ex.: `https://api.seudominio.com`).
  - `VITE_WS_URL`: host usado pelo Socket.IO público.
  - `VITE_AUTH_PROVIDER`: `internal` (padrão) ou `invite` para expor o CTA "Iniciar onboarding guiado".
  - `VITE_DEFAULT_TENANT_HINT`: tenant sugerido no formulário de login.
  - `VITE_AUTH_PREFILL_EMAIL` e `VITE_AUTH_PREFILL_PASSWORD`: pré-preenchimento opcional para ambientes de QA.
  - (Opcional) `VITE_API_AUTH_TOKEN`: token JWT estático usado apenas como fallback caso nenhuma sessão seja gerada no navegador.

> 🔐 Caso prefira não armazenar a senha do operador em variáveis do Render, gere manualmente um JWT válido com o comando `pnpm --filter @ticketz/api exec ts-node scripts/generate-jwt.ts --email operador@exemplo.com` e preencha o valor em `VITE_API_AUTH_TOKEN`. Sem o token ou o usuário seedado, o modal de autenticação não conseguirá criar a sessão demo.

### 4. Railway (API via nixpacks)

O serviço da API no Railway é construído pelo `nixpacks.toml` da raiz:

| Fase | Comandos |
| --- | --- |
| setup | `nodejs_22` + `openssl` do nixpkgs `01fbdeef22b76df85ea168fbfe1bfd9e63681b30` (Node 22.22.2) |
| install | `npm install -g corepack@0.24.1 && corepack enable` → `pnpm install --frozen-lockfile --prefer-offline` |
| build | `pnpm --filter @ticketz/storage run prisma:generate` → `pnpm --filter @ticketz/api run build` |
| start | `pnpm --filter @ticketz/api run start` (`node dist/server.mjs`) |

Por que o arquivo mudou (nov/2026):

- O `package.json` raiz exige `node >=22.12 <23` e `pnpm 9.12.3` com `engine-strict=true`. A configuração anterior (`nixPkgs = ['nodejs-20_x', 'pnpm']`) entregava, no nixpacks 1.41, Node **20.18.1** e o pnpm do nixpkgs (**9.15.x**); as duas versões faziam o `pnpm install` abortar com `ERR_PNPM_UNSUPPORTED_ENGINE`. O pnpm exato vem do Corepack, como o provider Node do nixpacks já faz por padrão quando existe `packageManager`.
- **Node 22 (nov/2026)**: o Node 20 saiu de suporte (EOL em abr/2026) e o AWS SDK v3 exige Node 22 a partir de jan/2027. O archive `01fbdeef22b76df85ea168fbfe1bfd9e63681b30` (nixpkgs-unstable, 23/abr/2026) tem `nodejs_22 = 22.22.2`, a mesma versão do `.nvmrc` e das imagens Docker. Como foi verificado: o `pkgs/development/web/nodejs/v22.nix` desse commit declara `version = "22.22.2"` com `sha256 = b6bedd3a…3132`, igual ao `node-v22.22.2.tar.xz` do `SHASUMS256.txt` oficial do nodejs.org; o commit é ancestral de `nixpkgs-unstable`; e as saídas `x86_64-linux` (`/nix/store/6x6v11xjf0psckgqmyhfyhw9bdma0rn6-nodejs-22.22.2`) e `aarch64-linux` estão no `cache.nixos.org` (narinfo 200), então o Railway baixa o binário em vez de compilar. O archive padrão do nixpacks 1.41 para Node 22 (`e6f23dc0…`) traz 22.14.0.
- Para atualizar o patch do Node: mude `.nvmrc`, `.node-version`, `ARG NODE_VERSION` dos dois Dockerfiles e escolha um commit do nixpkgs com a mesma versão (ex.: `curl "https://search.devbox.sh/v1/resolve?name=nodejs&version=<versão>"` devolve um commit com binário em cache; confira o `v22.nix` do commit).
- `openssl` voltou à lista: o provider o adiciona automaticamente para projetos com Prisma, mas uma lista `nixPkgs` própria o remove.
- Saíram os `echo`/`grep` de depuração e o `cat CACHE_BUSTER`; o `ls` do bundle virou desnecessário (o build falha se o `tsup` falhar).
- **Não** é preciso rodar `build:libs` antes do build da API: o `tsup` empacota `@ticketz/{core,shared,storage,contracts,wa-contracts}` a partir do código-fonte (pelos `paths` do `apps/api/tsconfig.json`) e `@leadengine/wa-status` é compilado no `postinstall`. Validado com um clone limpo: build com os comandos acima, `node apps/api/dist/server.mjs` respondendo `/ready` 200 e login (consulta ao Postgres via Prisma) 200.
- Migrações continuam fora do build: rode `pnpm run db:migrate:deploy` (pre-deploy command ou job manual) antes de promover a release.

### 👤 Provisionar operadores via onboarding

1. Gere um token e registre em `onboarding_invites` (pode usar Prisma Studio, `psql` ou um script de seed). Campos mínimos: `token`, `email`, `channel` (`email`/`sms`), `organization` e, opcionalmente, `tenantSlugHint`.
2. Configure `ONBOARDING_INVITE_EMAIL_FROM`, `ONBOARDING_INVITE_SMS_SENDER` e `ONBOARDING_PORTAL_BASE_URL` apontando para a URL pública do frontend (`https://app.seudominio.com/onboarding`).
3. Envie para o cliente o link `${ONBOARDING_PORTAL_BASE_URL}?token=<TOKEN>`; o operador valida o convite, cadastra nome/slug e senha e a API executa `/api/onboarding/setup`, criando tenant, fila, campanha e primeiro administrador.
4. Após a conclusão, o operador recebe o JWT na resposta e já pode continuar o fluxo conectando o WhatsApp diretamente no portal.

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
curl http://localhost:4000/healthz

# Testar Frontend
curl http://localhost/health
```

### 3. Validar Integração WhatsApp

Após configurar o broker HTTP (URL, API key e variáveis relacionadas) e finalizar o deploy, valide os fluxos principais:
Após configurar o broker HTTP (variáveis `WHATSAPP_BROKER_*` e webhook) e finalizar o deploy, valide os fluxos principais:

```bash
curl -H "x-tenant-id: <TENANT_ID>" http://localhost:4000/api/integrations/whatsapp/instances
curl -H "x-tenant-id: <TENANT_ID>" http://localhost:4000/api/integrations/whatsapp/instances/<INSTANCE_ID>/qr
curl -H "x-tenant-id: <TENANT_ID>" http://localhost:4000/api/integrations/whatsapp/instances/<INSTANCE_ID>/status
```

Os retornos devem refletir os dados reais do broker, sem recorrer ao QR de fallback, confirmando que a criação e conexão das instâncias estão operando end-to-end.

Para validar o pipeline completo (webhook → Socket.IO → persistência) execute o smoke test automatizado:

```bash
API_URL="https://ticketzapi-production.up.railway.app" \
WHATSAPP_WEBHOOK_API_KEY="<API_KEY>" \
TENANT_ID="demo-tenant" \
INSTANCE_ID="alan" \
pnpm test:whatsapp
```

O script `scripts/whatsapp-smoke-test.ts` envia um evento inbound sintético, aguarda `messages.new` e confirma a mensagem via REST. Caso necessário, utilize `pnpm exec tsx scripts/replay-baileys-log.ts` para reproduzir logs reais do connector Baileys diretamente no webhook HTTP.

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
