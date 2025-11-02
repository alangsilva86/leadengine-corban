  # Roadmap de IA – Preparação Sprint 1 ➝ Sprint 2

## Pendências finais da Sprint 1 (Copiloto configurável)

| Item | Descrição | Dono sugerido | Status |
| --- | --- | --- | --- |
| Testes automatizados backend | Cobrir `/api/ai/config`, `/api/ai/mode`, `/api/ai/suggest` e `/api/ai/memory/upsert` com Vitest/Supertest, incluindo paths de erro (sem chave, schema inválido) | Backend | 🔄 |
| Migração `ai_memories` | Executar `prisma migrate deploy` e validar credenciais nas pipelines | DevOps | ⏳ |
| Documentação de onboarding | Incluir seção IA no handbook interno (env vars, limites conhecidos) | Tech Writing | ⏳ |
| Aviso LGPD | Definir copy/banners padrão para o front (exposição no chat e na aba de Config) | Produto + Legal | ⏳ |

## Sprint 2 – IA Auto, Streaming e Ferramentas

### Backend
- `POST /api/ai/reply` com streaming (SSE inicialmente, WebSocket quando socket server estiver pronto).
- Motor de tool-calling:
  - Registrar ferramentas em `apps/api/src/services/ai/tool-registry.ts`.
  - Despachar execuções assíncronas com timeouts e retries limitados.
  - Logar resultados no `ai_runs` (runType `tool_call`).
- File Search / Vector Store:
  - Endpoint `POST /api/ai/config/vector-store/test` para validar IDs.
  - Resolver RAG no serviço `openai-client` usando `tool_resources`.
- Observabilidade:
  - Métricas Prometheus (`ai_runs_total`, `ai_tokens_total`, `ai_latency_bucket`).
  - Logs estruturados para `tool.call.start/end` e `stream.fallback`.

### Frontend
- Chat:
  - Ajustar header para alternar modo (Copiloto ↔ IA Auto ↔ Humano) chamando `/api/ai/mode`.
  - Consumir streaming via SSE: indicador “IA digitando…”, botão de cancelar, fallback para mensagem pronta.
  - Painel lateral exibe tool-calls (ex.: "Follow-up agendado") com possibilidade de desfazer.
- Configurações:
  - Editor de tools (CRUD básico) conectado ao backend.
  - Preview de streaming (simulação) usando Responses API stub.
- Storybook/Testes:
  - Histórias para chat em cada modo + estado de streaming.
  - Tests (Vitest/RTL) cobrindo mudança de modo e exibição de tool-call.

### DevOps / Segurança
- Feature flags por tenant para IA Auto e RAG.
- Rate limiting dedicado para `/api/ai/*`.
- Dashboards (Grafana / Datadog) com:
  - Tokens por minuto
  - Latência p50/p95
  - Porcentagem de fallback humano.
- Revisão de playbooks de incidentes (indisponibilidade OpenAI, erro no vector store).

## Preparação para Sprint 3 (preview)
- Integrações externas como calendários (tool-call `scheduleFollowUp`).
- Memória de longo prazo via data warehouse.
- Sugestões multimodais (voz/documentos) usando File Upload.
