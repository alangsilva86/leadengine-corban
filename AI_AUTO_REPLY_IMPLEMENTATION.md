# Implementação de Resposta Automática da IA

## Visão Geral

Esta implementação adiciona a funcionalidade de **resposta automática da IA** ao LeadEngine. Quando configurado no modo `IA_AUTO` (autônoma), o sistema agora:

1. ✅ Detecta mensagens inbound do WhatsApp
2. ✅ Verifica o modo de IA configurado para o ticket
3. ✅ Gera resposta automaticamente usando OpenAI
4. ✅ Envia a resposta de volta ao contato

## Arquitetura

### Fluxo de Processamento

```
Mensagem Inbound (WhatsApp)
         ↓
Pipeline de Processamento
         ↓
Persistir Mensagem no BD
         ↓
Criar/Atualizar Ticket
         ↓
[NOVO] Verificar Modo de IA
         ↓
[NOVO] Se IA_AUTO → Gerar Resposta
         ↓
[NOVO] Enviar Resposta Automática
```

### Componentes Criados

#### 1. `generate-reply.ts`
**Localização:** `apps/api/src/services/ai/generate-reply.ts`

Função auxiliar que gera respostas da IA **sem streaming** (ideal para automações):

```typescript
generateAiReply({
  tenantId: string,
  conversationId: string,
  messages: Array<{ role, content }>,
  queueId?: string | null,
  metadata?: Record<string, unknown>
})
```

**Características:**
- Usa a API da OpenAI em modo não-streaming
- Respeita configurações de modelo, temperatura, tokens
- Registra execuções no banco de dados
- Trata erros graciosamente com fallback

#### 2. `ai-auto-reply-service.ts`
**Localização:** `apps/api/src/services/ai-auto-reply-service.ts`

Serviço principal que orquestra a resposta automática:

```typescript
processAiAutoReply({
  tenantId: string,
  ticketId: string,
  messageId: string,
  messageContent: string,
  contactId: string,
  queueId?: string | null
})
```

**Responsabilidades:**
- Verificar se IA está habilitada
- Buscar configuração de IA do tenant/queue
- Verificar se modo é `IA_AUTO`
- Buscar histórico de mensagens (últimas 10)
- Gerar resposta usando `generateAiReply`
- Enviar resposta via `sendMessage`

#### 3. Integração no Pipeline
**Localização:** `apps/api/src/features/whatsapp-inbound/services/inbound-lead/pipeline.ts`

Hook adicionado após processamento da mensagem:

```typescript
// Processar resposta automática da IA se configurado
if (direction === 'INBOUND' && persistedMessage.content) {
  processAiAutoReply({
    tenantId,
    ticketId,
    messageId: persistedMessage.id,
    messageContent: persistedMessage.content,
    contactId: contactRecord.id,
    queueId: ticketRecord.queueId ?? null,
  }).catch((error) => {
    // Log de erro sem interromper o fluxo principal
  });
}
```

## Modos de IA

| Modo | Valor Backend | Valor Frontend | Comportamento |
|------|---------------|----------------|---------------|
| **IA Assistida** | `COPILOTO` | `assist` | Sugere respostas, mas não envia automaticamente |
| **IA Autônoma** | `IA_AUTO` | `auto` | ✅ **Envia respostas automaticamente** |
| **Agente no Comando** | `HUMANO` | `manual` | IA desativada, 100% manual |

## Configuração

### Variáveis de Ambiente

```bash
# Obrigatório para IA funcionar
OPENAI_API_KEY=sk-...

# Opcional - Modelo padrão
OPENAI_MODEL=gpt-4o-mini

# Opcional - Timeouts
AI_STREAM_TIMEOUT_MS=120000
AI_TOOL_TIMEOUT_MS=15000
```

### Configuração por Tenant/Queue

A configuração de modo de IA pode ser feita via API:

```bash
# Definir modo autônomo
POST /api/ai/mode
{
  "mode": "auto"  # ou "assist", "manual"
}

# Verificar modo atual
GET /api/ai/mode
```

## Comportamento Detalhado

### Quando a IA Responde Automaticamente

1. **Mensagem inbound recebida** do WhatsApp
2. **Modo de IA verificado** para o ticket/queue
3. **Se modo = IA_AUTO:**
   - Busca últimas 10 mensagens do ticket
   - Monta contexto da conversa
   - Chama OpenAI para gerar resposta
   - Envia resposta automaticamente
   - Registra execução no banco

### Quando a IA NÃO Responde

- Modo configurado como `COPILOTO` (assist) ou `HUMANO` (manual)
- IA desabilitada globalmente (sem `OPENAI_API_KEY`)
- Mensagem sem conteúdo de texto
- Erro ao gerar resposta (fallback silencioso)

## Metadata das Mensagens

Mensagens geradas pela IA incluem metadata:

```json
{
  "aiGenerated": true,
  "aiModel": "gpt-4o-mini",
  "aiMode": "auto",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 50,
    "total_tokens": 200
  }
}
```

## Logs

### Logs de Sucesso

```
AI auto-reply: generating response
AI auto-reply: sending response
AI auto-reply: response sent successfully
```

### Logs de Skip

```
AI auto-reply skipped: AI is disabled globally
AI auto-reply skipped: mode is not IA_AUTO
AI auto-reply skipped: no messages to process
```

### Logs de Erro

```
AI auto-reply: failed to generate response
AI auto-reply: failed to process
```

## Limitações Atuais

1. **Sem suporte a ferramentas (tools)** - A versão sem streaming não implementa tool calling
2. **Sem streaming** - Resposta é gerada completamente antes de enviar
3. **Contexto limitado** - Apenas últimas 10 mensagens
4. **Sem rate limiting específico** - Usa rate limiting geral do sistema

## Próximas Melhorias

### Curto Prazo
- [ ] Adicionar rate limiting específico para auto-reply
- [ ] Implementar retry com backoff exponencial
- [ ] Adicionar circuit breaker para falhas consecutivas
- [ ] Métricas Prometheus específicas

### Médio Prazo
- [ ] Suporte a tool calling em modo não-streaming
- [ ] Configuração de contexto (número de mensagens)
- [ ] Templates de prompt por queue/campanha
- [ ] Modo "assist" com sugestões em tempo real

### Longo Prazo
- [ ] IA multi-modal (imagens, áudio)
- [ ] Aprendizado com feedback dos agentes
- [ ] A/B testing de prompts
- [ ] Integração com knowledge base (RAG)

## Testes

### Teste Manual

1. Configure `OPENAI_API_KEY` no ambiente
2. Defina modo autônomo:
   ```bash
   curl -X POST http://localhost:3000/api/ai/mode \
     -H "Content-Type: application/json" \
     -d '{"mode": "auto"}'
   ```
3. Envie mensagem via WhatsApp para uma instância conectada
4. Verifique logs do backend
5. Confirme que resposta foi enviada automaticamente

### Teste de Modo

```bash
# Modo assistido (não responde automaticamente)
curl -X POST /api/ai/mode -d '{"mode": "assist"}'

# Modo autônomo (responde automaticamente)
curl -X POST /api/ai/mode -d '{"mode": "auto"}'

# Modo manual (IA desativada)
curl -X POST /api/ai/mode -d '{"mode": "manual"}'
```

## Troubleshooting

### IA não está respondendo

1. **Verificar OPENAI_API_KEY**
   ```bash
   echo $OPENAI_API_KEY
   ```

2. **Verificar modo de IA**
   ```bash
   curl http://localhost:3000/api/ai/mode
   ```

3. **Verificar logs do backend**
   ```bash
   grep "AI auto-reply" logs/app.log
   ```

4. **Verificar se mensagem tem conteúdo**
   - Mensagens de mídia sem caption podem não ter `content`

### Respostas muito lentas

- Ajustar `max_output_tokens` na configuração
- Usar modelo mais rápido (gpt-4o-mini)
- Reduzir número de mensagens de contexto

### Erros de API

- Verificar créditos da OpenAI
- Verificar rate limits da OpenAI
- Verificar conectividade de rede

## Segurança

### Dados Sensíveis

- Mensagens são enviadas para OpenAI
- Implementar mascaramento de PII se necessário
- Considerar usar Azure OpenAI para dados sensíveis

### Rate Limiting

- Implementar limite de mensagens por minuto/hora
- Prevenir loops de resposta automática
- Monitorar custos de API

## Monitoramento

### Métricas Importantes

- Taxa de respostas automáticas enviadas
- Latência de geração de resposta
- Taxa de erro da API OpenAI
- Custo por resposta (tokens)
- Taxa de conversão (resposta → resolução)

### Alertas Recomendados

- Taxa de erro > 5%
- Latência > 10 segundos
- Custo diário > threshold
- Falhas consecutivas > 3

---

**Implementado em:** 02/11/2025  
**Versão:** 1.0.0  
**Status:** ✅ Funcional - Aguardando testes em produção
