# Arquitetura Híbrida: Ticketz + Lead Engine

## 🚀 Visão Geral

O LeadEngine consolida tickets, leads e a integração WhatsApp em um monorepo TypeScript. A API Express orquestra tickets/leads, expõe Socket.IO multi-tenant e absorve mensagens do WhatsApp. O frontend React consome os contratos compartilhados e mantém o chat em tempo real.

## 🧭 Topologia do Monorepo

```
leadengine-corban/
├── apps/
│   ├── api/                  # Express + Socket.IO + Prisma
│   └── web/                  # React 19 + Vite + design system shadcn
├── packages/
│   ├── contracts/            # OpenAPI, zod e tipos gerados
│   ├── core/                 # Domínio puro (tickets, leads, erros)
│   ├── integrations/         # Adaptadores Baileys e helpers de sessão
│   ├── shared/               # Logger/config, métricas e utilitários
│   └── storage/              # Prisma Client e repositórios
├── prisma/                   # schema.prisma, migrations, seed
├── docs/                     # ADRs, decisões e guias operacionais
├── scripts/                  # Automação (doctor, deploy, smoke tests)
└── docker-compose*.yml       # Orquestração local/produção
```

Todos os pacotes compartilham build com `tsup` e são publicados internamente via `workspace:*`.

## 🔄 Interface de transporte WhatsApp unificada

- `apps/api/src/config/whatsapp-config.ts` centraliza variáveis e expõe `getWhatsAppMode()` (fixo em `http`; valores legados como `sidecar` apenas geram aviso e convertem automaticamente).
- `apps/api/src/config/whatsapp.ts` distribui getters (`getBrokerBaseUrl`, `getWebhookApiKey`, `shouldBypassTenantGuards` etc.), removendo leituras diretas de `process.env`.
- `/healthz` revela o estado do transporte WhatsApp via `apps/api/src/health.ts`, expondo `whatsapp.runtime` (com `mode`, `transport`, `status`, `disabled`) para auditar a disponibilidade do broker HTTP.

## 📥 Pipeline inbound consolidado

1. Webhook único (`apps/api/src/features/whatsapp-inbound/routes/webhook-routes.ts`) normaliza eventos Baileys, persiste mensagens e aciona `messages.new` em Socket.IO.
2. A fila interna (`apps/api/src/features/whatsapp-inbound/queue/event-queue.ts`) e o worker (`workers/inbound-processor.ts`) permanecem para reprocessamentos/passthrough, alimentando o logger de debug e mantendo compatibilidade com jobs herdados.
3. O processamento assíncrono é centralizado no worker `inbound-processor` (`apps/api/src/features/whatsapp-inbound/workers/inbound-processor.ts`), que consome a fila, aplica dedupe e mantém o pipeline consistente sem caminhos paralelos.

## 📊 Observabilidade e circuit breaker

- Rotas de integrações invocam `respondWhatsAppNotConfigured` (`apps/api/src/routes/integrations.ts`), retornando `503 WHATSAPP_NOT_CONFIGURED` sempre que a configuração HTTP estiver incompleta.
- As métricas (`apps/api/src/lib/metrics.ts`) cobrem webhook (`whatsapp_webhook_events_total`), HTTP client (`whatsapp_http_requests_total`), outbound e eventos Socket.IO.
- `scripts/whatsapp-smoke-test.mjs` executa smoke tests REST + Socket.IO para o modo HTTP.

## 🗄️ Persistência de sessão e deploy híbrido

- `docker-compose.yml` e `docker-compose.prod.yml` foram simplificados para operar somente com o broker HTTP.
- Rotas de integrações invocam `respondWhatsAppNotConfigured` (`apps/api/src/routes/integrations.ts`), retornando `503 WHATSAPP_NOT_CONFIGURED` quando o transporte HTTP não está apto — o circuito permanece fechado até que as variáveis do broker sejam restauradas.
- As métricas (`apps/api/src/lib/metrics.ts`) cobrem webhook (`whatsapp_webhook_events_total`), HTTP client (`whatsapp_http_requests_total`), outbound e eventos Socket.IO.
- `scripts/whatsapp-smoke-test.mjs` executa smoke tests REST + Socket.IO no modo `http` (o antigo caminho `sidecar` agora reutiliza o mesmo fluxo).

## 🗄️ Persistência de sessão e deploy híbrido

- O runtime sidecar foi aposentado — os manifests `docker-compose*.yml` seguem válidos, mas o volume `whatsapp_sessions_data` deixou de ser pré-requisito para subir a API.
- O guia `DEPLOY_GUIDE.md` orienta a manter Postgres/Redis gerenciados e reaproveitar o volume entre releases.
- `scripts/whatsapp-smoke-test.mjs` executa smoke tests REST + Socket.IO garantindo a integridade do pipeline HTTP.

## 🗄️ Persistência de sessão e deploy híbrido

- O deploy padrão depende exclusivamente do broker HTTP externo; não há sidecars locais nem volumes de sessão dedicados.
- O guia `DEPLOY_GUIDE.md` orienta a manter Postgres/Redis gerenciados e focar na disponibilidade do broker HTTP remoto.

## 🔁 Operação contínua

Remova `WHATSAPP_MODE` de ambientes legados; `/healthz` confirma o transporte HTTP ativo.
Qualquer valor diferente de `http` gera erro de inicialização. Valores herdados como `sidecar` apenas disparam aviso e convertem automaticamente para HTTP, garantindo compatibilidade até a remoção definitiva da variável.
Com apenas o transporte HTTP habilitado, não há fluxos de rollback entre modos. A operação se concentra em manter as credenciais e o endpoint do broker disponíveis; `/healthz` continua sendo a referência para confirmar o status durante deploys e incidentes.
