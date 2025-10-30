# ADR 0003 — Adoção do Sidecar WhatsApp

> ⚠️ **Atualização (2025-03-01):** o modo sidecar foi aposentado. A API agora opera exclusivamente com o transporte HTTP descrito nesta ADR; mantenha este registro apenas como histórico da decisão original.
> ℹ️ **Atualização**: o runtime sidecar foi descontinuado em favor do transporte HTTP. Este ADR permanece apenas como registro histórico da decisão original.

## Contexto

A integração atual com o WhatsApp depende de um broker HTTP externo. O modo sidecar já
existia em um pacote de integrações dedicado (posteriormente descontinuado), mas a API não tem uma estratégia formal para alternar o
transporte ou coordenar o ciclo de vida das sessões. Variáveis de ambiente são lidas em
arquivos dispersos, o que dificulta o rollback seguro e abre brechas de configuração.

## Decisão

1. Consolidar todas as variáveis de ambiente relacionadas ao WhatsApp em uma camada de
   configuração única (`apps/api/src/config/whatsapp-config.ts`), exportando utilitários
   memoizados para consumo em toda a aplicação.
2. Manter o transporte HTTP como modo único exposto por `getWhatsAppMode`, assegurando
   que nenhuma alternância dinâmica entre sidecar e http aconteça em produção.
3. Atualizar os pontos sensíveis (healthcheck e cliente do broker) para depender dessa camada,
   garantindo auditoria do transporte HTTP e preparando eventual expansão futura sem toggles operacionais.

## Consequências

- Testes passam a resetar o cache de configuração via `refreshWhatsAppEnv`, reduzindo o
  risco de interferência entre suites.
- Todas as validações de disponibilidade do broker utilizam a mesma fonte de verdade,
  simplificando o rollout de novas variáveis.
- O passo seguinte (Fase 1 do plano) pode introduzir novos transportes sem migrar
  cada chamada individual, pois o modo ativo já está centralizado e versionado.
- Operações deixam de executar rollback entre `http` e `sidecar`; o foco passa a ser
  garantir que as credenciais HTTP estejam corretas antes de promover novas versões.
- O webhook inbound (`apps/api/src/features/whatsapp-inbound/routes/webhook-controller.ts`) tornou-se o caminho principal e exclusivo de ingestão.
- `/healthz` divulga o modo ativo (`apps/api/src/health.ts`), garantindo observabilidade do circuito durante rollout/rollback.
