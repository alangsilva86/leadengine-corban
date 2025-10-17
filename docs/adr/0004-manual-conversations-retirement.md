# ADR 0004 — Descontinuação da rota de conversas manuais

- Status: Aprovado
- Data: 2025-03-10

## Contexto

A rota `POST /api/manual-conversations` foi criada como solução provisória para
operadores iniciarem diálogos rápidos via WhatsApp sem abrir tickets. Desde a
migração do fluxo para abertura automática de tickets por contato (deploy
2024-12), a squad de Operações deixou de acionar esse endpoint. As execuções
mais recentes do `pnpm ts-prune` e os dashboards de observabilidade não
registraram tráfego desde janeiro de 2025, caracterizando o código como
obsoleto.

## Decisão

Remover definitivamente o módulo `manual-conversations` da API, incluindo:

1. Router Express (`apps/api/src/routes/manual-conversations.ts`) e seus
   validadores inline.
2. Testes de integração dedicados (`apps/api/src/routes/__tests__/manual-conversations.spec.ts`).
3. Registro do router em `apps/api/src/server.ts` e documentação no `README.md`.
4. Comunicar squads dependentes e registrar o aceite antes da remoção.

## Consequências

- Simplificação do `server.ts`, reduzindo uma rota que não possuía consumidores
  ativos e evitando manutenção futura (ex.: atualizações de validação, mocks).
- A próxima etapa do backlog de Operações é retirar o atalho de "conversa
  manual" do frontend (`useManualConversationLauncher`), agora documentado como
  follow-up.
- Nenhum dado histórico é afetado: leads e tickets continuam sendo abertos pelo
  fluxo padrão de atendimento.

## Aprovação

- Squad Operações — assinado por Patrícia Souza (gerente de atendimento) em
  2025-03-10 via thread `#operations-manual-conv-sunset` (Slack).
- Squad Plataforma — assinado por Marcelo Tavares (staff engineer) em
  2025-03-10, acompanhando o ticket TECH-2817.
