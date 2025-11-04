import { getAiConfig, upsertAiConfig, recordAiRun } from '@ticketz/storage';
import type { Prisma } from '@prisma/client';
import {
  aiConfig as envAiConfig,
  isAiEnabled,
  normalizeOpenAiModel,
  resolveDefaultAiMode,
} from '../../config/ai';
import { logger } from '../../config/logger';

const RESPONSES_API_URL = 'https://api.openai.com/v1/responses';

interface GenerateReplyOptions {
  tenantId: string;
  conversationId: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  queueId?: string | null;
  metadata?: Record<string, unknown>;
}

interface GenerateReplyResult {
  message: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
  status: 'success' | 'stubbed' | 'error';
}

const sanitizeMetadata = (raw?: Record<string, unknown> | null): Record<string, string> | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const entries = Object.entries(raw)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, typeof value === 'string' ? value : String(value)]);
  return entries.length > 0 ? Object.fromEntries(entries) as Record<string, string> : undefined;
};

/**
 * Gera uma resposta da IA sem streaming (para uso em automações)
 */
export async function generateAiReply(
  options: GenerateReplyOptions
): Promise<GenerateReplyResult> {
  const { tenantId, conversationId, messages, queueId, metadata = {} } = options;
  const startedAt = Date.now();
  const fallbackMode = envAiConfig.defaultAssistantMode ?? resolveDefaultAiMode();

  try {
    // Se a IA não estiver habilitada, retornar mensagem stub
    if (!isAiEnabled) {
      const stubMessage =
        'Ainda estou configurando a IA neste workspace, mas já anotei a solicitação. Um atendente humano assume a conversa em instantes.';

      logger.debug('AI reply stubbed: AI is disabled', {
        tenantId,
        conversationId,
      });

      return {
        message: stubMessage,
        model: 'stub',
        usage: null,
        status: 'stubbed',
      };
    }

    // Buscar ou criar configuração de IA (com fallback configurável)
    let config: any;
    const normalizedQueueId = queueId ?? null;

    try {
      config = await getAiConfig(tenantId, normalizedQueueId);

      if (!config && normalizedQueueId) {
        const globalConfig = await getAiConfig(tenantId, null);
        if (globalConfig) {
          logger.debug('AI config fallback to global scope', {
            tenantId,
            conversationId,
            queueId: normalizedQueueId,
          });
          config = globalConfig;
        }
      }

      if (!config) {
        // Se não houver config, cria com modo padrão configurado via ambiente
        config = await upsertAiConfig({
          tenantId,
          queueId: normalizedQueueId,
          scopeKey: normalizedQueueId ?? '__global__',
          model: envAiConfig.defaultModel,
          mode: fallbackMode as any,
        });
        logger.debug('AI config created with default AI mode', {
          tenantId,
          conversationId,
          queueId: normalizedQueueId,
          defaultMode: fallbackMode,
        });
      } else if (config && (config as any).mode == null) {
        // Se existir mas não tiver `mode`, garantimos fallback configurado
        (config as any).mode = fallbackMode;
        // Tenta persistir o backfill de modo, mas não falha o fluxo se der erro
        try {
          await upsertAiConfig({
            id: (config as any).id,
            tenantId,
            queueId: normalizedQueueId,
            scopeKey: normalizedQueueId ?? '__global__',
            model: config.model ?? envAiConfig.defaultModel,
            mode: fallbackMode as any,
          } as any);
        } catch (persistErr) {
          logger.warn('Failed to persist AI mode backfill; proceeding with in-memory mode', {
            error: persistErr instanceof Error ? persistErr.message : String(persistErr),
          });
        }
      }
    } catch (cfgErr) {
      // Se falhar leitura ou escrita da config, usamos fallback local
      logger.warn('AI config load failed, using local fallback mode', {
        error: cfgErr instanceof Error ? cfgErr.message : String(cfgErr),
        tenantId,
        conversationId,
        fallbackMode,
        queueId: normalizedQueueId,
      });
      config = {
        id: null,
        model: envAiConfig.defaultModel,
        systemPromptReply: undefined,
        temperature: undefined,
        maxOutputTokens: undefined,
        mode: fallbackMode,
      } as any;
    }

    // Construir mensagens de requisição
    const normalizeContentType = (role: 'user' | 'assistant' | 'system'): 'input_text' | 'output_text' => {
      if (role === 'assistant') {
        return 'output_text';
      }
      return 'input_text';
    };

    const requestMessages = [
      ...(config.systemPromptReply
        ? [
            {
              role: 'system' as const,
              content: [{ type: 'input_text' as const, text: config.systemPromptReply }],
            },
          ]
        : []),
      ...messages.map((message) => ({
        role: message.role,
        content: [{ type: normalizeContentType(message.role), text: message.content }],
      })),
    ];

    const effectiveModel = normalizeOpenAiModel(
      (config as any)?.model ?? undefined,
      envAiConfig.defaultModel
    );

    const requestBody: Record<string, unknown> = {
      model: effectiveModel,
      input: requestMessages,
      temperature: config.temperature ?? undefined,
      max_output_tokens: config.maxOutputTokens ?? undefined,
      metadata: {
        tenantId,
        conversationId,
        ...(normalizedQueueId ? { queueId: normalizedQueueId } : {}),
        ...(sanitizeMetadata(metadata) ?? {}),
      },
    };

    logger.debug('🧩 AI AUTO-REPLY :: pacote preparado para a OpenAI', {
      tenantId,
      conversationId,
      queueId: queueId ?? null,
      metadataPreview: requestBody.metadata,
      sampleRoles: requestMessages.map((msg) => msg.role),
    });

    // Fazer requisição à API da OpenAI (sem streaming)
    const response = await fetch(RESPONSES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${envAiConfig.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `OpenAI API error (${response.status} ${response.statusText}): ${errorText}`
      );
    }

    const result = await response.json();

    // Extrair mensagem da resposta
    const message =
      result?.output?.[0]?.content?.[0]?.text ??
      result?.choices?.[0]?.message?.content ??
      'Desculpe, não consegui gerar uma resposta no momento.';

    const usage = result?.usage ?? null;

    // Registrar execução da IA
    await recordAiRun({
      tenantId,
      conversationId,
      configId: (config as any)?.id ?? null,
      runType: 'reply',
      requestPayload: requestBody as Prisma.JsonValue,
      responsePayload: {
        message,
        usage,
      } as Prisma.JsonValue,
      latencyMs: Date.now() - startedAt,
      status: 'success',
    });

    logger.info('AI reply generated successfully', {
      tenantId,
      conversationId,
      model: effectiveModel,
      mode: (config as any)?.mode ?? fallbackMode,
      messageLength: message.length,
      latencyMs: Date.now() - startedAt,
    });

    return {
      message,
      model: effectiveModel,
      usage,
      status: 'success',
    };
  } catch (error) {
    logger.error('Failed to generate AI reply', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      tenantId,
      conversationId,
    });

    // Registrar falha
    await recordAiRun({
      tenantId,
      conversationId,
      configId: null,
      runType: 'reply',
      requestPayload: { messages } as Prisma.JsonValue,
      responsePayload: {
        error: error instanceof Error ? error.message : String(error),
      } as Prisma.JsonValue,
      latencyMs: Date.now() - startedAt,
      status: 'error',
    }).catch((recordError) => {
      logger.error('Failed to record AI run error', {
        error: recordError instanceof Error ? recordError.message : String(recordError),
      });
    });

    return {
      message: 'Desculpe, ocorreu um erro ao processar sua mensagem. Um atendente humano irá ajudá-lo em breve.',
      model: 'error',
      usage: null,
      status: 'error',
    };
  }
}
