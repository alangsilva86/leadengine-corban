# IA – Checklist DevOps Sprint 2

## 1. Migrações e banco de dados
- Rodar `pnpm --filter @ticketz/storage exec prisma migrate deploy`.
- Validar `ai_memories`, `ai_configs.defaultMode` e índices (`tenantId, scopeKey`).
- Habilitar backups diários e revisar plano de retenção (LGPD): excluir memórias vencidas > 30 dias.

## 2. Variáveis de ambiente
| Variável | Ambiente | Descrição |
| --- | --- | --- |
| `OPENAI_API_KEY` | prod/stg/dev | chave responses API. Rotacionar via Secrets Manager. |
| `OPENAI_MODEL` | prod/stg/dev | `gpt-4o-mini` default, override por tenant via /api/ai/config. |
| `OPENAI_VECTOR_STORE_ID` | opcional | ID inicial do File Search. Pode ficar vazio até RAG habilitado. |
| `AI_STREAM_TIMEOUT_MS` | opcional | Timeout SSE (default 120000). |
| `AI_TOOL_MAX_CONCURRENCY` | opcional | Limite de execuções de ferramentas (default 4). |

## 3. Observabilidade
- **Prometheus**: adicionar métricas `ai_runs_total`, `ai_runs_latency_ms`, `ai_runs_tokens_total`.
- **Logging**: `crm.ai.reply.failed`, `crm.ai.mode.updated`, `crm.ai.memory.upserted` – encaminhar para stack ELK/Splunk.
- **Tracing**: propagar `x-request-id` do gateway até `responses.stream` (planejado Sprint 3).
- **Dashboards** (Grafana/Datadog):
  - Throughput IA (runs/min).
  - Latência p50/p95 de `reply` e `suggest`.
  - Porcentagem fallback humano.
  - Custo estimado (tokens * pricing).

## 4. Feature Flags / rollout
- Flag `ai.reply.streaming.enabled` por tenant/fila.
- Flag `ai.rag.vector_store.enabled`.
- Habilitar `ai.auto_mode` apenas pós-piloto (tenant corban-first).
- Canary: 10% agentes → 50% → 100% por fila, monitorando fallback.

## 5. Rede e segurança
- Liberar tráfego outbound HTTPS → `api.openai.com`.
- Configurar retry/backoff automático via API Gateway (503/429) com jitter.
- Limites:
  - Rate limit soft: `POST /api/ai/reply` 5 req/min por agente.
  - Rate limit hard: 60 req/min por tenant.
- Atualizar WAF rules para bloquear payloads > 32 KB e JSON inválido.

## 6. Operação
- Playbook incidentes:
  1. Falha OpenAI → alternar modo global para `HUMANO`.
  2. Vector store indisponível → log `ai_rag_offline`, fallback sem RAG.
  3. Tool call erro >3 seg → circuit breaker e alerta SRE.
- Alertas PagerDuty:
  - Latência média > 6s por 5 min.
  - Fallback rate > 35%.
  - Erros 5xx acima de 2/min.

## 7. Deploy check
- Executar smoke `pnpm --filter @ticketz/api exec vitest run src/routes/__tests__/ai.spec.ts`.
- Executar smoke `pnpm --filter web exec vitest run src/features/chat/components/ConversationArea/__tests__/Composer.test.jsx`.
- Rodar storybook CI (flag `CI=1 pnpm --filter web run storybook:build`) até disponibilizar preview.
- Confirmar sockets/Redis configurados (stream fallback HTTP long-poll se indisponível).

## 8. Documentação & handoff
- Atualizar runbook de atendimento com seção “Autônomo vs Copiloto”.
- Registrar novas métricas no catálogo observability (confluence/Notion).
- Agendar treinamento agentes pós-release (Roteiro 30 min).
