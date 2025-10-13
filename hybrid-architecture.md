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

- `apps/api/src/config/whatsapp-config.ts` centraliza variáveis e expõe apenas getters de credencial; o transporte está fixado em HTTP mas mantém o bloco `runtime` (`rawMode`, `correlationSeed`, `sidecarSessionsPath`) para compatibilidade.
- `apps/api/src/config/whatsapp.ts` distribui getters (`getBrokerBaseUrl`, `getWebhookApiKey`, `shouldBypassTenantGuards` etc.), removendo leituras diretas de `process.env`.
- `/healthz` revela o transporte WhatsApp em execução (`http`) via `apps/api/src/health.ts`, expondo `whatsapp.runtime` (com `mode`, `transport`, `status`, `disabled`) para auditoria operacional.

## 📥 Pipeline inbound consolidado

1. Webhook único (`apps/api/src/features/whatsapp-inbound/routes/webhook-routes.ts`) normaliza eventos Baileys, persiste mensagens e aciona `messages.new` em Socket.IO.
2. A fila interna (`apps/api/src/features/whatsapp-inbound/queue/event-queue.ts`) e o worker (`workers/inbound-processor.ts`) permanecem para reprocessamentos/passthrough, alimentando o logger de debug e mantendo compatibilidade com jobs herdados.
3. O processamento assíncrono é centralizado no worker `inbound-processor` (`apps/api/src/features/whatsapp-inbound/workers/inbound-processor.ts`), que consome a fila, aplica dedupe e mantém o pipeline consistente sem caminhos paralelos.

## 📊 Observabilidade e circuit breaker

- Rotas de integrações invocam `respondWhatsAppNotConfigured` (`apps/api/src/routes/integrations.ts`) quando credenciais obrigatórias faltam, mantendo o circuito consistente para o transporte HTTP.
- As métricas (`apps/api/src/lib/metrics.ts`) cobrem webhook (`whatsapp_webhook_events_total`), HTTP client (`whatsapp_http_requests_total`), outbound e eventos Socket.IO.
- `scripts/whatsapp-smoke-test.ts` executa smoke tests REST + Socket.IO assumindo o transporte HTTP.

## 🗄️ Persistência de sessão e deploy híbrido

- `docker-compose.yml` e `docker-compose.prod.yml` mantêm o volume `whatsapp_sessions_data` para quem ainda executa o sidecar legado manualmente.
- O guia `DEPLOY_GUIDE.md` orienta a manter Postgres/Redis gerenciados e reaproveitar o volume entre releases.

## 🔁 Rollback sem rebuild

Como o transporte está fixo em HTTP, o rollback consiste apenas em restaurar credenciais válidas e reiniciar o serviço; `/healthz` confirma o status operacional.
