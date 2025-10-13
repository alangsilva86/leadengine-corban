# ADR 0003 — Adoção do Sidecar WhatsApp

> ⚠️ **Atualização (2025-03-01):** o modo sidecar foi aposentado. A API agora opera exclusivamente com o transporte HTTP descrito nesta ADR; mantenha este registro apenas como histórico da decisão original.

## Contexto

A integração atual com o WhatsApp depende de um broker HTTP externo. O modo sidecar já
existe em `packages/integrations`, mas a API não tem uma estratégia formal para alternar o
transporte ou coordenar o ciclo de vida das sessões. Variáveis de ambiente são lidas em
arquivos dispersos, o que dificulta o rollback seguro e abre brechas de configuração.

## Decisão

1. Consolidar todas as variáveis de ambiente relacionadas ao WhatsApp em uma camada de
   configuração única (`apps/api/src/config/whatsapp-config.ts`), exportando utilitários
   memoizados para consumo em toda a aplicação.
2. Expor uma API explícita para o modo de transporte (`getWhatsAppMode`) e para os
   recursos críticos (broker, webhook, flags), permitindo alternar entre `http`,
   `sidecar`, `dryrun` e `disabled` sem alterar chamadas diretas a `process.env`.
3. Atualizar os pontos sensíveis (healthcheck e cliente do broker) para depender dessa camada,
   estabelecendo a fundação para introduzir o adaptador sidecar em fases posteriores.

## Consequências

- Testes passam a resetar o cache de configuração via `refreshWhatsAppEnv`, reduzindo o
  risco de interferência entre suites.
- Todas as validações de disponibilidade do broker utilizam a mesma fonte de verdade,
  simplificando o rollout de novas variáveis.
- O passo seguinte (Fase 1 do plano) pode introduzir o `WhatsAppTransport` sem migrar
  cada chamada individual, pois o modo ativo já está centralizado e versionado.
- O rollback para `WHATSAPP_MODE=http` torna-se previsível: basta alterar a variável e
  reinicializar, já que nenhuma chamada depende de leitura direta de `process.env`.
- O webhook inbound (`apps/api/src/features/whatsapp-inbound/routes/webhook-routes.ts`) tornou-se o caminho principal e exclusivo de ingestão.
- `/healthz` divulga o modo ativo (`apps/api/src/health.ts`), garantindo observabilidade do circuito durante rollout/rollback.
