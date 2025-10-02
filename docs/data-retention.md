# Plano de Retenção de Dados (LeadEngine)

## Escopo
- **Leads & Allocations**: registros gerados a partir de mensagens inbound ou lotes de demonstração.
- **Campanhas/Instâncias**: metadados históricos (logs em `metadata.history`).
- **Eventos do broker**: tabelas `integration_states`, `processed_integration_events`.

## Política de Retenção
- **Leads**: manter por 90 dias a partir de `receivedAt`. Após esse período:
  1. aplicar _soft delete_ (`deletedAt`, mascarar PII) para preservar métricas agregadas.
  2. tarefa assíncrona diária remove definitivamente registros marcados com mais de 7 dias em soft delete.
- **Histórico de campanhas/instâncias**: manter últimos 50 eventos em memória/metadata; não persistir PII.
- **Eventos do broker**: purgar entradas com mais de 30 dias para evitar crescimento da tabela.

## Implementação (próximos passos)
1. Criar coluna `deletedAt`/`masked` nas tabelas de leads (ou coleção equivalente) e job `retention-worker` para execução noturna.
2. Rotina remove PII (documento/telefone) ao marcar `deletedAt`.
3. Hard delete semanal (`cron`) para campanhas sem leads ativos e instâncias excluídas há >30 dias.
4. Monitorar execução via logs estruturados (`logger.info('retention-run', ...)`).

## Observabilidade
- Registrar métricas de contagem (`leads.retained`, `leads.purged`) e tempo da rotina.
- Alertar em caso de falha (Slack/Email) quando job não executar em 24h.

Este plano garante conformidade com LGPD e evita crescimento indefinido da base.
