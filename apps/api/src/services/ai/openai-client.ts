import { aiConfig, isAiEnabled } from '../../config/ai';
import { recordAiRun } from '@ticketz/storage';
import type { Prisma } from '@prisma/client';
import { logger } from '../../config/logger';

export interface SuggestInput {
  tenantId: string;
  conversationId: string;
  configId?: string | null;
  prompt: string;
  contextMessages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  structuredSchema: Prisma.JsonValue;
  metadata?: Record<string, unknown>;
}

export interface SuggestResult {
  payload: Prisma.JsonValue;
  confidence?: number | null;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  raw?: unknown;
}

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

export const suggestWithAi = async (input: SuggestInput): Promise<SuggestResult> => {
  const {
    tenantId,
    conversationId,
    configId,
    prompt,
    contextMessages = [],
    structuredSchema,
    metadata = {},
  } = input;

  if (!isAiEnabled) {
    const fallback = {
      next_step: 'Aguardando contato humano',
      tips: [
        {
          title: 'Configurar chave da OpenAI',
          message: 'Defina OPENAI_API_KEY no ambiente para ativar as respostas da IA.',
        },
      ],
      objections: [],
      confidence: 0,
    };

    await recordAiRun({
      tenantId,
      conversationId,
      configId: configId ?? null,
      runType: 'suggest',
      requestPayload: { prompt, contextMessages, structuredSchema },
      responsePayload: fallback,
      status: 'stubbed',
    });

    return {
      payload: fallback,
      confidence: 0,
      model: 'stub',
    };
  }

  const requestBody = {
    model: aiConfig.defaultModel,
    input: [
      ...contextMessages.map((message) => ({
        role: message.role,
        content: [{ type: 'text', text: message.content }],
      })),
      {
        role: 'user' as const,
        content: [{ type: 'text', text: prompt }],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'crm_suggestion_schema',
        schema: structuredSchema,
      },
    },
    metadata,
  };

  const startedAt = Date.now();

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiConfig.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${errorPayload}`);
    }

    const json = (await response.json()) as any;
    const latencyMs = Date.now() - startedAt;

    const outputText = json?.output?.[0]?.content?.[0]?.text ?? '{}';
    let parsedPayload: Prisma.JsonValue = {};

    try {
      parsedPayload = JSON.parse(outputText);
    } catch (error) {
      logger.warn('Failed to parse structured output, returning raw text', { error });
      parsedPayload = { raw: outputText };
    }

    await recordAiRun({
      tenantId,
      conversationId,
      configId: configId ?? null,
      runType: 'suggest',
      requestPayload: requestBody as Prisma.JsonValue,
      responsePayload: json as Prisma.JsonValue,
      latencyMs,
      promptTokens: json?.usage?.prompt_tokens ?? null,
      completionTokens: json?.usage?.completion_tokens ?? null,
      totalTokens: json?.usage?.total_tokens ?? null,
      status: 'success',
    });

    return {
      payload: parsedPayload,
      confidence: (parsedPayload as any)?.confidence ?? null,
      model: json?.model ?? aiConfig.defaultModel,
      usage: {
        promptTokens: json?.usage?.prompt_tokens ?? undefined,
        completionTokens: json?.usage?.completion_tokens ?? undefined,
        totalTokens: json?.usage?.total_tokens ?? undefined,
      },
      raw: json,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    logger.error('Failed to generate AI suggestion', { error });

    await recordAiRun({
      tenantId,
      conversationId,
      configId: configId ?? null,
      runType: 'suggest',
      requestPayload: requestBody as Prisma.JsonValue,
      responsePayload: { error: (error as Error).message },
      latencyMs,
      status: 'error',
    });

    throw error;
  }
};
