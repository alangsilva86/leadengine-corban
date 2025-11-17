# Sprint 1 – Fundamentos da IA do LeadEngine

Este documento acompanha o estado atual da feature de IA depois da conclusão da Sprint 1 (copiloto configurável) e deixa ganchos preparados para a Sprint 2 (streaming + RAG em produção).

## Variáveis de ambiente

- `OPENAI_API_KEY` – chave privada usada **somente** no backend. Se não estiver definida, os endpoints retornam respostas _stub_ e sinalizam `aiEnabled: false`.
- `OPENAI_MODEL` – modelo padrão carregado pelo backend; `gpt-4o-mini` é o valor default seguro.
- `OPENAI_VECTOR_STORE_ID` – opcional; serve como valor inicial quando o tenant habilita File Search / Vector Store.

Todas são lidas em `apps/api/src/config/ai.ts`. O backend loga um aviso caso os envs estejam ausentes ou inválidos.

## Esquema e persistência

Novas tabelas Prisma (migração `20251101234323_add_ai_tables`):

- `ai_configs` – guarda preferências por tenant/fila, incluindo `defaultMode`.
- `ai_suggestions` – histórico das notas internas estruturadas.
- `ai_runs` – trilha de auditoria (latência, tokens, custo estimado).
- `ai_memories` – memória curta por contato (`topic`, `content`, metadata, TTL).

Repositório central: `packages/storage/src/repositories/ai-repository.ts`.

## Endpoints concluídos

- `GET /api/ai/config` – retorna as configurações atuais (ou defaults do ambiente).
- `PUT /api/ai/config` – persiste ajustes com validação de schema JSON.
- `GET /api/ai/mode` / `POST /api/ai/mode` – controla o modo padrão (`IA_AUTO`, `COPILOTO`, `HUMANO`) por tenant/fila.
- `POST /api/ai/reply` – streaming SSE com tool calling; cai no fallback stub quando a IA estiver desabilitada.
- `POST /api/ai/suggest` – chama a Responses API (ou fallback) com Structured Outputs.
- `POST /api/ai/memory/upsert` – grava/atualiza memória contextual para sincronizar com o chat.

Os handlers ficam em `apps/api/src/routes/ai.ts` e registram telemetria via `logger.info`.

> 2025-04-27: `aiRouter` virou o único entrypoint; os routers/controller antigos em `apps/api/src/routes/ai/*` foram removidos para evitar drift de código morto.

## Observabilidade inicial

- Cada chamada de sugestão registra um `AiRun` com latência e uso de tokens.
- Mutação de modo (`crm.ai.mode.updated`) e memória (`crm.ai.memory.upserted`) gera logs estruturados com tenant/queue.
- `AiSettingsTab` exibe se a chave está configurada (`Badge` dinâmico) e bloqueia "Salvar" quando o schema é inválido.

## Frontend – Aba Configurações da IA

Arquivo principal: `apps/web/src/components/settings/AiSettingsTab.tsx`.

Highlights:

- Fetch/PUT desacoplados com `fetch` nativo (mockável em testes/storybook).
- Seleção de modo padrão com `Select`, explicação contextual e controle de streaming.
- Cards para prompts, schema, tool calling (placeholder) e vector store.
- Storybook (`AiSettingsTab.stories.tsx`) mocka `fetch` para demos com/sem chave OpenAI.
- Teste de interação (`AiSettingsTab.test.tsx`) garante mudança de modo + persistência.

## Próximos ganchos para a Sprint 2

- Completar `POST /api/ai/reply` com streaming (SSE/WebSocket) reaproveitando `ai_runs`.
- Popular `tool-registry` (placeholder em `apps/api/src/services/ai/tool-registry.ts`, a ser criado) com schemas e adapters reais.
- Plugar File Search usando `vector_store_ids` a partir das configurações gravadas.
- Expandir métricas para Prometheus (tokens, custo, fallback rate) e dashboards.
- Integrar a aba de chat com `/api/ai/mode` para alternar Copiloto/IA Auto em tempo real.

> **LGPD**: garantir mascaramento de PII nos logs de AI e configurar retenção na nova tabela `ai_memories`.
