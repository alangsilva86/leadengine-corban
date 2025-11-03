import { getAiConfig, upsertAiConfig, recordAiRun } from '@ticketz/storage';
import type { Prisma } from '@prisma/client';
import { aiConfig as envAiConfig, isAiEnabled } from '../../config/ai';
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

/**
 * Gera uma resposta da IA sem streaming (para uso em automações)
 */
export async function generateAiReply(
  options: GenerateReplyOptions
): Promise<GenerateReplyResult> {
  const { tenantId, conversationId, messages, queueId, metadata = {} } = options;
  const startedAt = Date.now();

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

    // Buscar ou criar configuração de IA
    const config =
      (await getAiConfig(tenantId, queueId ?? null)) ??
      (await upsertAiConfig({
        tenantId,
        queueId: queueId ?? null,
        scopeKey: queueId ?? '__global__',
        model: envAiConfig.defaultModel,
      }));

    // Construir mensagens de requisição
    const requestMessages = [
      ...(config.systemPromptReply
        ? [
            {
              role: 'system' as const,
              content: [{ type: 'text' as const, text: config.systemPromptReply }],
            },
          ]
        : []),
      ...messages.map((message) => ({
        role: message.role,
        content: [{ type: 'text' as const, text: message.content }],
      })),
    ];

    const requestBody: Record<string, unknown> = {
      model: config.model ?? envAiConfig.defaultModel,
      input: requestMessages,
      temperature: config.temperature ?? undefined,
      max_output_tokens: config.maxOutputTokens ?? undefined,
      // Nova API Responses (novembro/2025)
      text: {
        format: 'plain' as const,
      },
      metadata: {
        tenantId,
        conversationId,
        ...metadata,
      },
    };

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
      configId: config.id,
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
      model: config.model,
      messageLength: message.length,
      latencyMs: Date.now() - startedAt,
    });

    return {
      message,
      model: config.model ?? envAiConfig.defaultModel,
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
