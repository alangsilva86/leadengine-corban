import { listMemoryRecords, appendReplyRecord } from '../../data/ai-store';
import { emitToTicket } from '../../lib/socket-registry';
import { logger } from '../../config/logger';
import {
  AiConversationMessage,
  AiMode,
  AiReplyResult,
  AiToolCall,
  TokenUsage,
} from './types';

type NormalizedAiMode = 'auto' | 'assist' | 'manual';

const normalizeAiMode = (mode: AiMode | string | undefined | null): NormalizedAiMode => {
  if (!mode) return 'auto';
  const m = String(mode).toLowerCase().replace(/\s+/g, '').replace(/-/g, '_');
  // Map aliases to normalized set; default to 'auto' (IA_AUTO fallback)
  if (m === 'ia_auto' || m === 'auto') return 'auto';
  if (m === 'assist' || m === 'ia_assist') return 'assist';
  if (m === 'manual' || m === 'ia_manual') return 'manual';
  return 'auto';
};

const collectActiveMemories = (tenantId: string, contactId: string) => {
  const now = Date.now();
  return listMemoryRecords(tenantId, contactId)
    .filter((record) => !record.expiresAt || record.expiresAt.getTime() > now)
    .map((record) => ({
      id: record.id,
      tenantId: record.tenantId,
      contactId: record.contactId,
      topic: record.topic,
      content: record.content,
      metadata: record.metadata,
      updatedAt: record.updatedAt.toISOString(),
      expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
    }));
};

const buildSystemInstructions = (mode: AiMode | string) => {
  const normalized: NormalizedAiMode = normalizeAiMode(mode);
  switch (normalized) {
    case 'auto':
      return 'Atue de forma proativa, propondo próximos passos objetivos e mantendo o tom cordial.';
    case 'manual':
      return 'Aja como assistente redator. Resuma o contexto e sugira uma resposta breve para o agente revisar.';
    case 'assist':
    default:
      return 'Forneça uma resposta colaborativa, destacando decisões já tomadas e orientando o cliente com clareza.';
  }
};

const buildPrompt = (input: GenerateReplyInput, memoriesSummary: string, systemInstructions: string) => {
  const conversationSnippet = input.conversation
    .slice(-6)
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`)
    .join('\n');

  return [
    systemInstructions,
    memoriesSummary ? `Memórias relevantes:\n${memoriesSummary}` : null,
    `Últimas mensagens:\n${conversationSnippet}`,
    `Solicitação do agente: ${input.prompt}`,
  ]
    .filter(Boolean)
    .join('\n\n');
};

const simulateToolCalls = (memoriesSummary: string): AiToolCall[] => {
  if (!memoriesSummary) {
    return [];
  }

  return [
    {
      name: 'knowledge.base.lookup',
      arguments: { topics: memoriesSummary.split('\n').map((line) => line.trim()).filter(Boolean) },
      result: {
        status: 'ok',
        references: memoriesSummary.split('\n').length,
      },
    },
  ];
};

const estimateUsage = (prompt: string, completion: string): TokenUsage => {
  const promptTokens = Math.max(20, Math.round(prompt.length / 4));
  const completionTokens = Math.max(20, Math.round(completion.length / 4));
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
};

const streamReply = (ticketId: string, content: string, metadata: Record<string, unknown>) => {
  const chunkSize = 200;
  let offset = 0;
  while (offset < content.length) {
    const chunk = content.slice(offset, offset + chunkSize);
    emitToTicket(ticketId, STREAM_EVENT, { chunk, done: false, metadata });
    offset += chunkSize;
  }
  emitToTicket(ticketId, STREAM_EVENT, { chunk: null, done: true, metadata });
};

export const generateAiReply = async (input: GenerateReplyInput): Promise<AiReplyResult> => {
  const resolvedMode: NormalizedAiMode = normalizeAiMode(input.mode);
  const systemInstructions = buildSystemInstructions(resolvedMode);

  const memories = collectActiveMemories(input.tenantId, input.contactId);
  const memoriesSummary = memories
    .map((memory) => `• ${memory.topic}: ${memory.content}`)
    .join('\n');

  const prompt = buildPrompt(input, memoriesSummary, systemInstructions);
  const completion = `${input.prompt.trim()}\n\nCom base no histórico e nas informações acima, reforço nosso compromisso em avançar com transparência. Seguem os próximos passos sugeridos: \n1. Confirmar os dados compartilhados.\n2. Enviar a documentação complementar.\n3. Agendar a próxima conversa.`;

  const usage = estimateUsage(prompt, completion);
  const toolCalls = simulateToolCalls(memoriesSummary);

  const record = appendReplyRecord(input.tenantId, input.ticketId, completion, {
    mode: resolvedMode, // IA_AUTO fallback when config/mode is missing or unknown
    prompt,
    usage,
  });

  streamReply(input.ticketId, completion, { replyId: record.id });

  logger.info('AI reply generated', {
    tenantId: input.tenantId,
    ticketId: input.ticketId,
    replyId: record.id,
    mode: resolvedMode,
    usage,
  });

  return {
    message: {
      id: record.id,
      role: 'assistant',
      content: completion,
      createdAt: record.createdAt.toISOString(),
      metadata: record.metadata,
    },
    context: {
      memories,
      retrievedAt: new Date().toISOString(),
    },
    tools: toolCalls,
    usage,
  };
};
