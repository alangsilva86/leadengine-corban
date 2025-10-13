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

- `apps/api/src/config/whatsapp-config.ts` centraliza variáveis e expõe `getWhatsAppMode()` (sempre `http`).
- `apps/api/src/config/whatsapp.ts` distribui getters (`getBrokerBaseUrl`, `getWebhookApiKey`, `shouldBypassTenantGuards` etc.), removendo leituras diretas de `process.env`.
- `/healthz` revela o modo de transporte WhatsApp (`running`, `inactive`, `disabled`) via `apps/api/src/health.ts`, expondo `whatsapp.runtime` (com `mode`, `transport`, `status`, `disabled`) para facilitar auditoria pós-switch.

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
- O guia `DEPLOY_GUIDE.md` orienta a manter Postgres/Redis gerenciados e reaproveitar o volume entre releases.

## 🔁 Rollback sem rebuild

Remova `WHATSAPP_MODE` de ambientes legados; `/healthz` confirma o transporte HTTP ativo.
