import {
  aiConfig,
  isAiEnabled,
  normalizeOpenAiModel,
  resolveDefaultAiMode,
} from '../../config/ai';
import { getAiConfig, upsertAiConfig } from '@ticketz/storage';
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

const sanitizeMetadata = (raw?: Record<string, unknown> | null): Record<string, string> | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const entries = Object.entries(raw)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, typeof value === 'string' ? value : String(value)]);
  return entries.length > 0 ? (Object.fromEntries(entries) as Record<string, string>) : undefined;
};

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

  // Resolve per-tenant AI config with resilient fallback (default to configured mode)
  let resolvedConfig: any | null = null;
  let resolvedConfigId: string | null = null;
  const fallbackMode = aiConfig.defaultAssistantMode ?? resolveDefaultAiMode();
  try {
    // Try to get queue-scoped config when provided via configId metadata in callers; otherwise global (null queue)
    resolvedConfig = await getAiConfig(tenantId, null);
  } catch (e) {
    logger.warn('getAiConfig failed, using local fallback AI mode', {
      tenantId,
      error: (e as Error)?.message,
      fallbackMode,
    });
  }

  if (!resolvedConfig) {
    try {
      // Create a global config with fallback mode if none exists
      const upserted = await upsertAiConfig({
        tenantId,
        queueId: null,
        scopeKey: '__global__',
        model: aiConfig.defaultModel,
        mode: fallbackMode,
      });
      resolvedConfig = upserted;
      resolvedConfigId = (upserted as any)?.id ?? null;
      logger.info('AI config created with fallback AI mode', { tenantId, fallbackMode });
    } catch (e) {
      // Last-resort local fallback (not persisted)
      resolvedConfig = {
        id: null,
        tenantId,
        queueId: null,
        scopeKey: '__global__',
        model: aiConfig.defaultModel,
        mode: fallbackMode,
      };
      logger.warn('upsertAiConfig failed; proceeding with local AI mode fallback', {
        tenantId,
        error: (e as Error)?.message,
        fallbackMode,
      });
    }
  } else {
    resolvedConfigId = (resolvedConfig as any)?.id ?? null;
    if (!('mode' in resolvedConfig) || !resolvedConfig.mode) {
      // Backfill mode to fallback non-blockingly
      try {
        await upsertAiConfig({
          tenantId,
          queueId: resolvedConfig.queueId ?? null,
          scopeKey: resolvedConfig.scopeKey ?? '__global__',
          model: resolvedConfig.model ?? aiConfig.defaultModel,
          mode: fallbackMode,
        });
        resolvedConfig.mode = fallbackMode;
        logger.debug('Backfilled AI config mode to fallback value', { tenantId, fallbackMode });
      } catch (e) {
        logger.warn('Failed to backfill AI config mode; continuing with in-memory fallback', {
          tenantId,
          error: (e as Error)?.message,
          fallbackMode,
        });
        resolvedConfig.mode = fallbackMode;
      }
    }
  }

  const selectedModel = normalizeOpenAiModel(
    (resolvedConfig as any)?.model ?? undefined,
    aiConfig.defaultModel
  );
  const systemPrompt = (resolvedConfig as any)?.systemPromptSuggest as string | undefined;

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

  const normalizeContentType = (role: 'user' | 'assistant' | 'system'): 'input_text' | 'output_text' => {
    if (role === 'assistant') {
      return 'output_text';
    }
    return 'input_text';
  };

  const requestBody = {
    model: selectedModel,
    input: [
      ...(systemPrompt ? [{ role: 'system' as const, content: [{ type: 'input_text' as const, text: systemPrompt }] }] : []),
      ...contextMessages.map((message) => ({
        role: message.role,
        content: [{ type: normalizeContentType(message.role), text: message.content }],
      })),
      {
        role: 'user' as const,
        content: [{ type: 'input_text', text: prompt }],
      },
    ],
    json_schema: {
      name: 'crm_suggestion_schema',
      schema: structuredSchema,
    },
    metadata: {
      tenantId,
      conversationId,
      mode: resolvedConfig?.mode ?? fallbackMode,
      ...(sanitizeMetadata(metadata) ?? {}),
    },
  };

  logger.debug('🧪 AI SUGGEST :: requisicao lapidada', {
    tenantId,
    conversationId,
    model: requestBody.model,
    contextRoles: requestBody.input.map((entry) => entry.role),
    metadataPreview: requestBody.metadata,
  });

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
      configId: resolvedConfigId,
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
      model: json?.model ?? selectedModel,
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
      configId: resolvedConfigId,
      runType: 'suggest',
      requestPayload: requestBody as Prisma.JsonValue,
      responsePayload: { error: (error as Error).message },
      latencyMs,
      status: 'error',
    });

    throw error;
  }
};
