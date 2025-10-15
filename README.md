# 🧭 Ticketz LeadEngine — Guia do Explorador Tecnológico

> Um diário de bordo lúdico (e completo!) para quem precisa navegar pelo ecossistema híbrido de tickets, leads e WhatsApp.

## 📚 Sumário rápido
- [Capítulo 0 – O que é o Ticketz LeadEngine?](#capítulo-0--o-que-é-o-ticketz-leadengine)
- [Capítulo 1 – O mapa do tesouro (arquitetura do monorepo)](#capítulo-1--o-mapa-do-tesouro-arquitetura-do-monorepo)
- [Capítulo 2 – Personagens principais (stacks & dependências)](#capítulo-2--personagens-principais-stacks--dependências)
- [Capítulo 3 – Jornada cronológica de setup](#capítulo-3--jornada-cronológica-de-setup)
- [Capítulo 4 – Bastidores da API](#capítulo-4--bastidores-da-api)
- [Capítulo 5 – Palco do frontend](#capítulo-5--palco-do-frontend)
- [Capítulo 6 – Pacotes compartilhados](#capítulo-6--pacotes-compartilhados)
- [Capítulo 7 – Rotas, eventos e contratos](#capítulo-7--rotas-eventos-e-contratos)
- [Capítulo 8 – Observabilidade, scripts e automação](#capítulo-8--observabilidade-scripts-e-automação)
- [Capítulo 9 – Docker, deploy e ambientes](#capítulo-9--docker-deploy-e-ambientes)
- [Capítulo 10 – Qualidade e manutenção contínua](#capítulo-10--qualidade-e-manutenção-contínua)
- [Capítulo 11 – Trilhas adicionais](#capítulo-11--trilhas-adicionais)

---

## Capítulo 0 – O que é o Ticketz LeadEngine?

O **Ticketz LeadEngine** reúne o fluxo de tickets do ecossistema Ticketz, a orquestração de leads do LeadEngine e uma integração profunda com WhatsApp, tudo rodando em um monorepo TypeScript. A plataforma entrega:

- 🎫 **Gestão de tickets** com atribuição, histórico, filas e chat em tempo real via Socket.IO.
- 👥 **Pipeline de leads** com qualificação, tags, campanhas e dashboards alimentados pela API oficial do LeadEngine.
- 📱 **Integração WhatsApp** utilizando exclusivamente o broker HTTP, com ingestão inbound consolidada no webhook (persistência imediata + Socket.IO) e fila interna para orquestrar o processamento com pipeline único.
- 🏢 **Multi-tenant completo**: cada requisição exige `tenantId`, há bypass controlado para demos e todas as entidades principais carregam isolamento lógico.
- 🧱 **Arquitetura modular** com pacotes de domínio, storage, integrações e contratos compartilhados entre backend e frontend.

---

## Capítulo 1 – O mapa do tesouro (arquitetura do monorepo)

```
leadengine-corban/
├── apps/
│   ├── api/                  # API Express + Socket.IO + Prisma
│   ├── web/                  # Frontend React 19 + Vite + Tailwind tokens
│   └── baileys-acessuswpp/   # Manifesto Render do broker oficial
├── packages/
│   ├── contracts/            # OpenAPI + tipos TypeScript gerados
│   ├── core/                 # Regras de negócio (tickets, leads, erros comuns)
│   ├── integrations/         # Adaptadores para Baileys e utilidades
│   ├── shared/               # Logger Winston, config e helpers cross-app
│   └── storage/              # Prisma Client e repositórios de dados
├── prisma/                   # schema.prisma, migrations e seeds
├── docs/                     # ADRs, design system, troubleshooting e guias
├── scripts/                  # Automação (doctor, deploy, smoke tests)
├── docker-compose*.yml       # Orquestração local e de produção
├── README.md                 # Este guia 🎉
└── ...
```

Cada pasta tem owner claro:
- **apps/** entrega experiências (API, frontend e manifesto do broker).
- **packages/** guarda blocos reutilizáveis – são buildados antes de qualquer app.
- **prisma/** versiona o modelo de dados PostgreSQL usado pela API.
- **docs/** registra decisões, tokens de design e receitas de operação.
- **scripts/** automatiza build, deploy, health-check, rastreamento e testes.

---

## Capítulo 2 – Personagens principais (stacks & dependências)

### Backend (`apps/api`)
- **Framework**: Express 4.18, Socket.IO 4.7, middlewares de segurança (Helmet, CORS, RateLimit, Compression).
- **Autenticação**: JWT (`jsonwebtoken`), bcrypt (`bcryptjs`), RBAC por tenant e bypass controlado via variáveis MVP.
- **Persistência**: Prisma Client 5.7 conectado a PostgreSQL; há repositórios dedicados em `packages/storage`.
- **Validação**: `express-validator` e erros ricos em `@ticketz/core`.
- **Integrações**: `undici` para HTTP resiliente com o LeadEngine e o broker WhatsApp.
- **Observabilidade**: Winston (`@ticketz/shared/logger`), métricas Prometheus (`prom-client`) e endpoints health/metrics.

### Frontend (`apps/web`)
- **Stack**: React 19 + Vite 6, Tailwind CSS com design tokens próprios e `shadcn/ui` Radix.
- **Estado**: React Query 5, Socket.IO client, Context API para preferências.
- **UI/UX**: biblioteca de componentes em `src/components`, features modulares (`features/chat`, `features/leads`, `features/whatsapp-inbound`), Storybook 8 para documentação visual.

### Pacotes compartilhados
- **@ticketz/contracts**: contrato OpenAPI (`openapi.yaml`) e tipos gerados para mensagens & APIs.
- **@ticketz/core**: domínios `tickets`/`leads`, erros (`ValidationError`, `NotFoundError`) e helpers comuns.
- **@ticketz/integrations**: adaptadores do broker Baileys (`whatsapp/baileys-provider.ts`) e utilidades (normalização, tipos).
- **@ticketz/shared**: configuração central (`src/config`), logger (`src/logger`), parseadores e formatação.
- **@ticketz/storage**: bootstrap do Prisma Client, factories de repositório e operações de dados.

### DevOps e tooling
- **Gerenciador**: pnpm 9.12.3 com `only-allow` e `doctor` para garantir ambiente.
- **Build**: tsup (pacotes) + Vite (web) + Prisma generate pré-build.
- **Testes**: Vitest + Supertest na API; Testing Library + Storybook no frontend; scripts dedicados para smoke tests WhatsApp.

---

## Capítulo 3 – Jornada cronológica de setup

### 0. Requisitos de bordo
- Node.js `>=20.19 <21` (use Volta/nvm/asdf). `corepack enable` habilita pnpm.
- pnpm `9.12.3` (já travado via `packageManager`).
- PostgreSQL 15+ e Redis 7 (ou use Docker Compose).
- Docker + Docker Compose (opcional, mas recomendado para o pacote completo).
- Variáveis de ambiente conforme descritas abaixo.

### 1. Clonar o repositório
```bash
git clone <repository-url>
cd leadengine-corban
```

### 2. Conferir o ambiente
```bash
corepack enable
pnpm run doctor
```
O script `scripts/doctor.mjs` valida Node, pnpm e dependências críticas antes de qualquer instalação.

### 3. Instalar dependências (monorepo inteiro)
```bash
corepack prepare pnpm@9.12.3 --activate
pnpm -w install --frozen-lockfile
```
Este comando builda workspaces, gera links entre `apps/*` e `packages/*` e garante a compatibilidade com os pipelines.

### 4. Variáveis de ambiente
- **Backend**: crie `apps/api/.env` (ou `.env.local`) baseado nas chaves usadas em produção.
  - Campos essenciais: `PORT`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `JWT_SECRET`, `DATABASE_URL`, `WHATSAPP_BROKER_URL`, `WHATSAPP_BROKER_API_KEY`, `WHATSAPP_WEBHOOK_API_KEY`, `WHATSAPP_WEBHOOK_HMAC_SECRET`, `AUTH_MVP_*`, `LEAD_ENGINE_*`, `REDIS_URL` (quando aplicável).
  - Configure os limites de falha do circuito outbound via `WHATSAPP_OUTBOUND_CIRCUIT_MAX_FAILURES`, `WHATSAPP_OUTBOUND_CIRCUIT_WINDOW_MS` e `WHATSAPP_OUTBOUND_CIRCUIT_COOLDOWN_MS` para personalizar tolerância e cooldown de envio.
  - `WHATSAPP_SESSION_STORE_DRIVER` suporta `postgres` (persistência via Prisma), `redis` ou `memory` (apenas desenvolvimento). Use `WHATSAPP_SESSION_STORE_URL` para apontar para o banco/cluster e `WHATSAPP_SESSION_STORE_REDIS_TTL` para definir TTL opcional ao usar Redis.
  - Mantenha `WHATSAPP_PASSTHROUGH_MODE=false` em produção e QA. Isso força a API a validar `x-api-key`/`x-signature-sha256` para cada evento e garante que apenas instâncias autorizadas — identificadas pelo `instanceId` — consigam movimentar leads.
  - O modo HTTP é fixo: a variável legada `WHATSAPP_MODE` foi removida e a API aborta a inicialização caso ela esteja definida.
  - Use `docs/environments/ticketzapi-production.env` como referência de produção.
- **Frontend**: crie `apps/web/.env.local` com `VITE_API_URL=http://localhost:4000` e `VITE_WS_URL=ws://localhost:4000`.
- **Broker**: quando for hospedar o Baileys externo, alinhe chaves com `apps/baileys-acessuswpp/render.yaml`.

### 5. Banco de dados & Prisma
```bash
pnpm -F @ticketz/api run db:generate   # Gera client
pnpm -F @ticketz/api run db:push       # Aplica schema no Postgres local
pnpm -F @ticketz/api run db:seed       # Popular dados iniciais (se necessário)
```
As migrations estão em `prisma/migrations`. Para resetar, use `pnpm -F @ticketz/api run db:reset`.

### 6. Execução em desenvolvimento
```bash
# Terminal 1 – API
cd apps/api
pnpm dev

# Terminal 2 – Frontend
cd apps/web
pnpm dev
```
A API sobe em `http://localhost:4000` e expõe Socket.IO no mesmo host; o frontend responde em `http://localhost:5173` com proxy para a API.

Para rodar tudo em paralelo:
```bash
pnpm run dev
```
Esse script usa `pnpm -r --parallel dev` para iniciar API e web simultaneamente.

### 7. Ambiente com Docker Compose
```bash
docker compose up --build
```
Sobe Postgres, Redis, API e Web com variáveis lidas de `.env` na raiz. Para adicionar Nginx e ajustes de produção, execute `docker compose --profile production up --build`.

### 8. Build & testes antes do deploy
```bash
pnpm run build:libs   # contracts → shared → core → storage → integrations
pnpm run build:api    # tsup + Prisma generate automático
pnpm run build:web    # scripts/run-build.mjs + Vite
pnpm run test         # Vitest e2e da API
pnpm run lint         # ESLint com regras customizadas
pnpm run typecheck    # Checagem estrita de tipos
```
O comando `pnpm run build` encadeia libs → API → Web. Use `pnpm run test:whatsapp` para validar o broker com smoke tests (`scripts/whatsapp-smoke-test.mjs`).

---

## Capítulo 4 – Bastidores da API

### Organização interna (`apps/api/src`)
- **config/**: logger Winston (`config/logger.ts`), flags e configuração WhatsApp.
- **clients/** & **services/**: wrappers HTTP (`lead-engine-client.ts`, `whatsapp-broker-client.ts`), sincronização de campanhas (`campaigns-upstream.ts`) e serviço de tenants.
- **data/**: seeds, fixtures e builders usados em testes.
- **middleware/**: autenticação (`middleware/auth.ts`), auditoria de requisições, validação e tratamento de erros.
- **routes/**: módulos independentes para auth, tickets, leads, contatos, campanhas, preferências, filas, conversas manuais, integrações e webhooks.
- **features/**: pipelines especializados; no WhatsApp inbound o webhook normaliza e persiste eventos de forma síncrona (`features/whatsapp-inbound/routes/webhook-routes.ts`) usando `ingestInboundWhatsAppMessage` como orquestrador principal.
- **socket/**: handlers de conexão multi-tenant (`socket/connection-handlers.ts`).
- **utils/** e **lib/**: parse de telefone, normalização de slug, métricas Prometheus, registrador Socket.IO, Prisma singleton e helpers HTTP.

### Fluxo WhatsApp resumido
1. Os eventos inbound chegam por `/api/integrations/whatsapp/webhook`, são normalizados e persistidos de forma síncrona (`features/whatsapp-inbound/routes/webhook-routes.ts`) e geram `messages.new` via Socket.IO.
2. A ingestão utiliza diretamente `ingestInboundWhatsAppMessage` (`features/whatsapp-inbound/services/inbound-lead-service.ts`), que aplica dedupe, atualiza tickets/leads e dispara sockets no mesmo ciclo de requisição.
3. Não há fila ou worker internos: falhas retornam erro HTTP ao broker, facilitando retentativas a partir da origem e simplificando a observabilidade do pipeline.
4. O router `/api/integrations/whatsapp` centraliza instâncias, QR, pareamento, envio de mensagens e circuit breaker de configuração (`routes/integrations.ts`), além de expor métricas/health específicas para observabilidade.

### Health & métricas
- `GET /healthz`: resumo do status da API (`buildHealthPayload`).
- `GET /metrics`: exporta métricas Prometheus, incluindo contadores do broker (`lib/metrics.ts`).
- `GET /api/integrations/metrics`: visão específica das filas/eventos WhatsApp.

---

## Capítulo 5 – Palco do frontend

### Estrutura (`apps/web/src`)
- **features/**: módulos isolados para chat, leads, dashboards, WhatsApp inbound e debug.
- **components/**: biblioteca design system (botões, formulários, navegação, layout) pronta para Storybook.
- **lib/** e **hooks/**: clientes REST/WS, stores de tema, preferências e helpers.
- **styles/**: tokens Tailwind (`tailwind.tokens.js`) e utilidades globais (`styles/animations.css`, etc.).
- **stories/**: catálogos do Storybook alinhados com o design system documentado em `docs/design-system`.

### Highlights
- Consumo da API com React Query e cache por tenant.
- Socket.IO client para eventos de tickets/mensagens em tempo real.
- QR code generator (`features/whatsapp/`) para pareamento de instâncias.
- Debug dashboards (`features/debug/`) conectados às métricas da API.

---

## Capítulo 6 – Pacotes compartilhados

| Pacote | Responsabilidade | Destaques |
| ------ | ---------------- | --------- |
| `@ticketz/contracts` | Contratos compartilhados | `openapi.yaml`, geração de tipos (`src/types.gen.ts`) e mensagens padronizadas (`src/messages.ts`). |
| `@ticketz/core` | Domínios puros | Serviços de tickets/leads, modelos, erros (`ValidationError`, `NotFoundError`) e utilidades em `src/common`. |
| `@ticketz/integrations` | Adaptadores externos | Provider Baileys, gerenciador de instâncias e helpers para normalizar payloads. |
| `@ticketz/shared` | Infraestrutura cross-cutting | Logger Winston, config centralizada (`src/config`), parsers/formatadores. |
| `@ticketz/storage` | Persistência e repositórios | Prisma Client singleton (`prisma-client.ts`), repositórios por domínio (`src/repositories`). |

Todos os pacotes possuem `tsup.config.ts` e `tsconfig.build.json`, seguindo o mesmo padrão de build.

---

## Capítulo 7 – Rotas, eventos e contratos

### Autenticação (`/api/auth`)
- `POST /login` – autentica usuário (aceita `tenantId` opcional).
- `POST /register` – cria usuário (ADMIN/supervisor).
- `GET /me`, `PUT /profile`, `PUT /password`, `POST /logout` – gerenciamento de sessão atual.

### Tickets (`/api/tickets`)
- CRUD completo (`GET`, `POST`, `GET/:id`, `PUT/:id`, `DELETE/:id`) com filtros, anexos (via `multer`) e emissão de eventos Socket.IO (`ticket.created`, `ticket.updated`, `ticket.assigned`).
- Mensagens de ticket em `/api/tickets/:id/messages` com suporte a anexos e status.

### Leads e contatos
- `/api/leads` – paginação, filtros por status, criação/edição (LeadStatus/LeadSource), tags e qualificação.
- `/api/contacts` – CRUD de contatos com normalização telefônica e associação a tickets/leads.
- `/api/lead-engine/allocations` – leitura de alocações filtradas por `instanceId` (obrigatório nos fluxos de WhatsApp) e `campaignId`; suporta exportação via `/export` com os mesmos filtros.

#### Exemplos de cURL para QA/Operação (allocations por instância)

```bash
# Listar alocações da instância corrente
curl -X GET "https://ticketzapi-production.up.railway.app/api/lead-engine/allocations?instanceId=$INSTANCE_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Exportar CSV respeitando o filtro de instância
curl -X GET "https://ticketzapi-production.up.railway.app/api/lead-engine/allocations/export?instanceId=$INSTANCE_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -o allocations-$INSTANCE_ID.csv
```

- Substitua `$ACCESS_TOKEN` pelo JWT do operador autenticado e `$INSTANCE_ID` pelo identificador provisionado na criação da instância WhatsApp. O backend exige que a instância esteja com `WHATSAPP_PASSTHROUGH_MODE=false` para validar credenciais antes de processar o filtro.

### Campanhas e pipeline comercial
- `/api/lead-engine/campaigns` – sincronização com upstream, filtros por `agreementId` e `status`.
- `/api/lead-engine/agreements` – lista acordos ativos/ disponíveis.
- `/api/campaigns` – gestão interna de campanhas (status, métricas, webhooks).

### Preferências, filas e conversas manuais
- `/api/preferences` – salva preferências de usuários (tema, filtros, layout).
- `/api/queues` – CRUD de filas/etapas do fluxo de tickets.
- `/api/manual-conversations` – permite criar conversas sem ticket para interações rápidas.

### Integração WhatsApp
- `/api/integrations/whatsapp/instances` – CRUD de instâncias, QR (`/qr.png`), pareamento (`/pair`), métricas e status.
- `/api/integrations/whatsapp/instances/:instanceId/messages` – envio outbound (texto/mídia).
- `/api/integrations/whatsapp/session/*` – conectar/logout/status da sessão atual.
- `/api/integrations/whatsapp/webhook` – recepção inbound com validação de assinatura/API key.
- `/api/integrations/whatsapp/polls` – disparo de enquetes.

### Eventos WebSocket (Socket.IO)
- Namespaces multi-tenant com `join-tenant` e `join-user`.
- Eventos principais: `ticket.created`, `ticket.updated`, `ticket.assigned`, `message.sent`, `message.received`, `whatsapp.connected`, `whatsapp.qr`.

Todos os contratos formais vivem em `packages/contracts/openapi.yaml` e são consumidos pelo frontend via tipos gerados.

---

## Capítulo 8 – Observabilidade, scripts e automação

- **Logs**: `@ticketz/shared/logger` usa Winston com níveis configuráveis (`LOG_LEVEL`). Logs ficam em `apps/api/logs/*` quando configurado.
- **Métricas**: Prometheus (`/metrics`), contadores específicos de WhatsApp (`whatsappHttpRequestsCounter`) e dashboards no frontend debug.
- **Scripts** (`/scripts`):
  - `doctor.mjs` – checagem de ambiente.
  - `health-check.sh` – valida endpoints health.
  - `trace_whatsapp_inbound.sh` e `replay-baileys-log.mjs` – troubleshooting da fila WhatsApp.
  - `build-api-render.sh` / `build-web-render.sh` – builds prontos para hospedar na Render.
  - `deploy.sh` – pipeline automatizada (build + migrações + restart).
  - `whatsapp-smoke-test.mjs` – valida inbound/webhook no transporte HTTP, escutando Socket.IO e REST.
- **Circuit breaker & modo de transporte**: `/healthz` retorna o status do transporte WhatsApp via bloco `whatsapp.runtime` (`apps/api/src/health.ts`), enquanto as rotas de integrações devolvem `503 WHATSAPP_NOT_CONFIGURED` quando a configuração HTTP está incompleta (`apps/api/src/routes/integrations.ts`).
  - `whatsapp-smoke-test.mjs` – valida inbound/webhook no modo `http` (entrada legada `sidecar` usa o mesmo caminho), escutando Socket.IO e REST.
- **Circuit breaker & modo de transporte**: `/healthz` retorna o modo ativo do transporte WhatsApp via bloco `whatsapp.runtime` (modo, transport, status, disabled) (`apps/api/src/health.ts`), enquanto as rotas de integrações devolvem `503 WHATSAPP_NOT_CONFIGURED` quando o transporte não está habilitado (`apps/api/src/routes/integrations.ts`).
  - `whatsapp-smoke-test.mjs` – valida o pipeline HTTP do webhook, escutando Socket.IO e REST.
- **Circuit breaker & modo de transporte**: `/healthz` retorna o resumo do transporte WhatsApp via bloco `whatsapp.runtime` (modo, transport, status, disabled) (`apps/api/src/health.ts`), enquanto as rotas de integrações devolvem `503 WHATSAPP_NOT_CONFIGURED` quando o transporte não está habilitado (`apps/api/src/routes/integrations.ts`).

---

## Capítulo 9 – Docker, deploy e ambientes

- `docker-compose.yml` sobe Postgres 15, Redis 7, API e Web com as variáveis necessárias para o broker HTTP.
- `docker-compose.yml` sobe Postgres 15, Redis 7, API e Web.
- `docker-compose.prod.yml` adiciona Nginx e ajustes de build multi-stage.
- `apps/api/Dockerfile` e `apps/web/Dockerfile` usam multi-stage (builder → runner) com pnpm cache.
- `apps/baileys-acessuswpp/render.yaml` descreve o deploy oficial do broker Baileys na Render (incluindo `API_KEY`).
- Para Railway/Render: consultar `docs/docker.md`, `docs/whatsapp-broker-contracts.md` e `docs/whatsapp-railway-curl-recipes.md` para validar rotas e webhooks.
- O transporte WhatsApp opera exclusivamente em modo HTTP; `/healthz` expõe o status atual para auditoria.
- Rollback/feature flag: `WHATSAPP_MODE` foi removido; qualquer definição interrompe o boot. Um rollback para sidecar exige reverter a release para uma tag anterior que ainda aceitava o modo legado.
- O transporte HTTP é fixo; utilize `/healthz` para confirmar a disponibilidade do broker remoto durante o deploy.

---

## Capítulo 10 – Qualidade e manutenção contínua

- **Linting**: `pnpm run lint` aplica `eslint.config.js` com regras personalizadas (ex.: `no-forbidden-tailwind-colors`).
- **Storybook**: `pnpm --filter web run storybook` documenta componentes; use `storybook:build`/`storybook:deploy` para Chromatic.
- **Testes**: `pnpm run test` roda os E2E da API (`apps/api/src/routes/__tests__`). Frontend utiliza Vitest/Testing Library sob demanda.
- **Typecheck**: `pnpm run typecheck` reforça que integrações estejam saudáveis antes do build.
- **CI-friendly**: `pnpm -C apps/web exec vite build --config apps/web/vite.build.ci.mjs` economiza memória em ambientes restritos.

---

## Capítulo 11 – Trilhas adicionais

- **ADRs**: `docs/adr` registra decisões arquiteturais; use `0000-template.md` para novas propostas.
- **Design System**: `docs/design-system/foundations.md` e `docs/design-system/tokens.md` descrevem tokens, cores e guidelines de acessibilidade.
- **Qualidade**: `docs/qa/cors-troubleshooting.md` e `docs/data-retention.md` cobrem suporte e compliance.
- **WhatsApp**: `docs/whatsapp-broker-contracts.md`, `docs/whatsapp-instances-troubleshooting.md` e `docs/whatsapp-railway-curl-recipes.md` funcionam como playbook.
- **Arquitetura híbrida**: `hybrid-architecture.md` apresenta a visão estratégica que originou este monorepo.

---

**Bom passeio!** Qualquer descoberta nova pode (e deve!) virar ADR, doc ou script para manter o mapa atualizado para o próximo explorador. 💡
