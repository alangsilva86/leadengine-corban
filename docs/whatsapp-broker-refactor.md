# WhatsApp Broker Refactor (Baileys oficial)

## Changelog

- Atualizamos o cliente HTTP (`apps/api/src/services/whatsapp-broker-client.ts`) para consumir exclusivamente as rotas oficiais do `baileys-acessuswpp` (`/instances`, `/instances/:id/send-text`, `/instances/:id/pair`, `/instances/:id/logout`, `/instances/:id/status`, `/instances/:id/exists`, `/instances/:id/groups`, `/instances/:id/metrics`).
- Padronizamos os cabeçalhos (`X-API-Key`, `Content-Type`, `Accept`) e o timeout baseado em `WHATSAPP_BROKER_TIMEOUT_MS` ou `LEAD_ENGINE_TIMEOUT_MS`.
- Endpoints legados `/api/integrations/whatsapp/session/*` agora retornam `410 Gone` orientando o uso das rotas de instância.
- A API passa a expor proxies diretos para `exists`, `groups` e `metrics`, mantendo o frontend isolado do broker.
- Os testes unitários e de rota cobrem os novos fluxos, incluindo erros de rede encapsulados como `WhatsAppBrokerError` 502.
- Documentação (`README.md`, `docs/whatsapp-broker-contracts.md`) e variáveis de ambiente foram alinhadas ao contrato atual do broker.

## Removal Checklist

- [x] Removidos fallbacks e menções a rotas `/broker/**` e `/instances/:id/connect`.
- [x] Endpoints `/api/integrations/whatsapp/session/connect|logout|status` marcados como `410 Gone`.
- [x] Atualizado o payload de criação de instância para `{ id, webhookUrl, verifyToken }`.
- [x] Adicionadas rotas da API para `exists`, `groups` e `metrics` alinhadas às rotas oficiais.
- [x] Atualizados testes unitários e de integração para cobrir o novo contrato do broker.
