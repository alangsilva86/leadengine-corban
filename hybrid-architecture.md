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
│   ├── shared/               # Logger/config, métricas e utilitários
│   ├── storage/              # Prisma Client e repositórios
│   │   └── prisma/           # schema.prisma, migrations, seed (PostgreSQL)
│   ├── wa-contracts/         # Contratos canônicos do transporte WhatsApp
│   └── wa-status/            # Normalização de status do WhatsApp
├── docs/                     # ADRs, decisões e guias operacionais
├── scripts/                  # Automação (doctor, deploy, smoke tests)
└── docker-compose*.yml       # Orquestração local/produção
```

Todos os pacotes compartilham build com `tsup` e são publicados internamente via `workspace:*`.

## 🔄 Interface de transporte WhatsApp unificada

- `apps/api/src/config/whatsapp-config.ts` centraliza variáveis do broker HTTP; o transporte é sempre HTTP e não depende mais de `WHATSAPP_MODE`.
- `apps/api/src/config/whatsapp.ts` distribui getters (por exemplo, `getBrokerBaseUrl`, `getWebhookApiKey`) removendo leituras diretas de `process.env`.
- `/healthz` revela o estado do transporte WhatsApp via `apps/api/src/health.ts`, expondo apenas os dados relevantes do broker (circuit breaker, endpoints e timeouts) sem campos de modo.

## 📥 Pipeline inbound consolidado

1. Webhook único (`apps/api/src/features/whatsapp-inbound/routes/webhook-controller.ts`) normaliza eventos Baileys, persiste mensagens e aciona `messages.new` em Socket.IO.
2. O serviço `ingestInboundWhatsAppMessage` realiza dedupe, provisiona filas de atendimento (`prisma.queue`) e cria tickets/mensagens de forma síncrona.
3. Logs e métricas (`features/whatsapp-inbound/utils/baileys-event-logger.ts`, `apps/api/src/lib/metrics.ts`) monitoram throughput e falhas sem depender de workers separados.

## 📊 Observabilidade e circuit breaker

- Rotas de integrações invocam `respondWhatsAppNotConfigured` (`apps/api/src/routes/integrations.ts`), retornando `503 WHATSAPP_NOT_CONFIGURED` sempre que a configuração HTTP estiver incompleta.
- As métricas (`apps/api/src/lib/metrics.ts`) cobrem webhook (`whatsapp_webhook_events_total`), HTTP client (`whatsapp_http_requests_total`), outbound e eventos Socket.IO.
- `scripts/whatsapp-smoke-test.ts` executa smoke tests REST + Socket.IO para o modo HTTP.

## 🗄️ Persistência de sessão e deploy híbrido

- `docker-compose.yml` e `docker-compose.prod.yml` foram simplificados para operar somente com o broker HTTP.
- Rotas de integrações invocam `respondWhatsAppNotConfigured` (`apps/api/src/routes/integrations.ts`), retornando `503 WHATSAPP_NOT_CONFIGURED` quando o transporte HTTP não está apto — o circuito permanece fechado até que as variáveis do broker sejam restauradas.
- O runtime sidecar foi aposentado — os manifests `docker-compose*.yml` seguem válidos, mas o volume `whatsapp_sessions_data` deixou de ser pré-requisito para subir a API.
- O guia `DEPLOY_GUIDE.md` orienta a manter Postgres/Redis gerenciados e focar na disponibilidade do broker HTTP remoto.
- `scripts/whatsapp-smoke-test.ts` executa smoke tests REST + Socket.IO garantindo a integridade do pipeline HTTP.

## 🔁 Operação contínua

Com apenas o transporte HTTP habilitado, não há fluxos de rollback entre modos. A operação se concentra em manter as credenciais e o endpoint do broker disponíveis; `/healthz` continua sendo a referência para confirmar o status durante deploys e incidentes.
