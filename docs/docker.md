# Executando o stack Ticketz LeadEngine com Docker

Este guia mostra como subir PostgreSQL, Redis, API, frontend e (opcionalmente) o proxy Nginx usando o `docker-compose.yml` já presente no repositório.

## 1. Pré-requisitos
- Docker e Docker Compose instalados
- Arquivo `.env` na raiz (`ticketz-leadengine/.env`) com as credenciais reais que deverão ser injetadas nos containers. O mesmo arquivo pode ser reaproveitado pelo ambiente local.
- Opcional: certificados TLS em `ticketz-leadengine/ssl` caso vá utilizar o serviço `nginx` em produção.

## 2. Estrutura gerada automaticamente
Ao rodar o compose os seguintes serviços são criados:

| Serviço   | Porta host | Descrição |
|-----------|------------|-----------|
| postgres  | 5432       | Banco de dados PostgreSQL |
| redis     | 6379       | Cache / fila |
| api       | 4000       | API Ticketz (Node/Express) |
| web       | 5173       | Frontend Vite/React |
| nginx*    | 80/443     | Proxy opcional (ativa com `--profile production`) |

Volumes persistentes:
- `postgres_data` → dados do banco
- `redis_data` → dados do Redis

Além disso, o arquivo `scripts/init.sql` é montado no container do Postgres e pode ser usado para criar estruturas iniciais.

## 3. Configuração de variáveis
O `docker-compose.yml` lê variáveis do ambiente (ou de um arquivo `.env`, se você rodar `docker compose` na raiz). Exemplos mínimos:

```
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
DATABASE_URL=postgresql://ticketz:ticketz123@postgres:5432/ticketz
DATABASE_SSL=false
REDIS_URL=redis://redis:6379
JWT_SECRET=troque-por-uma-chave-forte
WHATSAPP_BROKER_URL=https://baileys-acessuswpp.onrender.com
WHATSAPP_BROKER_API_KEY=<API_KEY>
WHATSAPP_VERIFY_TOKEN=<token_gerado_no_Meta>
LEAD_ENGINE_BROKER_BASE_URL=https://lead-engine-production.up.railway.app
LEAD_ENGINE_BASIC_TOKEN=bGVhZC1...
RATE_LIMIT_WINDOW_MS=900000 # opcional (padrão: 15 minutos)
RATE_LIMIT_MAX_REQUESTS=100 # opcional (padrão: 100 requisições)
```

> Em produção substitua os defaults por credenciais reais e, se necessário, habilite SSL do banco (`DATABASE_SSL=true`).

As variáveis `RATE_LIMIT_WINDOW_MS` e `RATE_LIMIT_MAX_REQUESTS` permitem ajustar a janela e o número máximo de requisições por IP aplicados pelo middleware de rate limiting da API. Valores não numéricos ou inválidos são ignorados e os padrões (15 minutos / 100 requisições) são utilizados. Use `CORS_ALLOWED_ORIGINS` para informar uma lista (separada por vírgula) de domínios extras autorizados a consumir a API via navegador; quando ausente, a aplicação libera apenas os domínios padrão (`FRONTEND_URL`, ambientes locais e os domínios históricos do projeto).

## 4. Subindo os serviços

Na raiz do repositório:

```bash
cd ticketz-leadengine

# subir PostgreSQL + Redis + API + Web
docker compose up --build

# se quiser usar o proxy nginx também
docker compose --profile production up --build
```

A primeira execução fará o build das imagens da API e do frontend.

## 5. Verificações rápidas
- API: `curl http://localhost:4000/health`
- Web: acessar `http://localhost:5173`
- Postgres: `docker exec -it ticketz-postgres psql -U ticketz`
- Redis: `docker exec -it ticketz-redis redis-cli ping`

## 6. Parando os serviços

```bash
docker compose down

# para remover volumes (dados serão perdidos!)
docker compose down -v
```

## 7. Debug / logs

- `docker compose logs -f api`
- `docker compose logs -f web`
- `docker compose exec api sh` (para abrir shell dentro do container)

Mantenha o arquivo `.env` fora do controle de versão (listado em `.gitignore`) e lembre-se de girar senhas/tokens ao mover para produção.
