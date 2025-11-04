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
  queueId?: string | null;
  config?: AiConfigRecord | null;
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

type AiConfigRecord = Awaited<ReturnType<typeof getAiConfig>>;

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
    queueId: requestedQueueId,
    config: providedConfig,
    prompt,
    contextMessages = [],
    structuredSchema,
    metadata = {},
  } = input;

  // Resolve per-tenant AI config with resilient fallback (default to configured mode)
  const fallbackMode = aiConfig.defaultAssistantMode ?? resolveDefaultAiMode();
  const normalizedQueueId = requestedQueueId ?? (providedConfig as any)?.queueId ?? null;

  let resolvedConfig: AiConfigRecord | null = providedConfig ?? null;
  let resolvedConfigId: string | null = providedConfig?.id ?? configId ?? null;

  const fetchScopedConfig = async (scopeQueueId: string | null) => {
    try {
      return await getAiConfig(tenantId, scopeQueueId);
    } catch (error) {
      logger.warn('AI suggest config fetch failed', {
        tenantId,
        queueId: scopeQueueId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  };

  if (!resolvedConfig) {
    resolvedConfig = await fetchScopedConfig(normalizedQueueId);
    if (!resolvedConfig && normalizedQueueId) {
      resolvedConfig = await fetchScopedConfig(null);
    }
  }

  if (!resolvedConfig) {
    try {
      const upserted = await upsertAiConfig({
        tenantId,
        queueId: normalizedQueueId,
        scopeKey: normalizedQueueId ?? '__global__',
        model: aiConfig.defaultModel,
        defaultMode: fallbackMode,
        structuredOutputSchema: structuredSchema,
      });
      resolvedConfig = upserted;
      resolvedConfigId = (upserted as any)?.id ?? null;
      logger.info('AI config created with fallback AI mode', {
        tenantId,
        queueId: normalizedQueueId,
        fallbackMode,
      });
    } catch (e) {
      resolvedConfig = {
        id: null,
        tenantId,
        queueId: normalizedQueueId,
        scopeKey: normalizedQueueId ?? '__global__',
        model: aiConfig.defaultModel,
        defaultMode: fallbackMode,
        systemPromptSuggest: null,
        temperature: null,
        maxOutputTokens: null,
      } as unknown as AiConfigRecord;
      logger.warn('upsertAiConfig failed; proceeding with local AI mode fallback', {
        tenantId,
        queueId: normalizedQueueId,
        error: (e as Error)?.message,
        fallbackMode,
      });
    }
  } else if (!resolvedConfigId) {
    resolvedConfigId = (resolvedConfig as any)?.id ?? null;
  }

  const resolvedMode =
    ((resolvedConfig as any)?.defaultMode as string | undefined) ??
    ((resolvedConfig as any)?.mode as string | undefined) ??
    fallbackMode;

  if (!resolvedConfig) {
    const error = new Error('AI configuration could not be resolved.');
    logger.error('AI suggest :: configuration missing after fallback', {
      tenantId,
      queueId: normalizedQueueId,
      error: error.message,
    });
    throw error;
  }

  let persistedConfig = resolvedConfig;
  if (!('defaultMode' in (resolvedConfig as any)) || !(resolvedConfig as any)?.defaultMode) {
    try {
      persistedConfig = await upsertAiConfig({
        tenantId,
        queueId: (resolvedConfig as any)?.queueId ?? normalizedQueueId ?? null,
        scopeKey: (resolvedConfig as any)?.scopeKey ?? normalizedQueueId ?? '__global__',
        model: (resolvedConfig as any)?.model ?? aiConfig.defaultModel,
        defaultMode: resolvedMode ?? fallbackMode,
      });
      resolvedConfigId = (persistedConfig as any)?.id ?? resolvedConfigId;
    } catch (error) {
      logger.warn('AI suggest :: failed to persist mode backfill', {
        tenantId,
        queueId: normalizedQueueId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const selectedConfig = persistedConfig ?? resolvedConfig;

  const selectedModel = normalizeOpenAiModel(
    (selectedConfig as any)?.model ?? undefined,
    aiConfig.defaultModel
  );
  const systemPrompt = (selectedConfig as any)?.systemPromptSuggest as string | undefined;
  const configuredTemperature = (selectedConfig as any)?.temperature;
  const configuredMaxTokens = (selectedConfig as any)?.maxOutputTokens;

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
      configId: resolvedConfigId ?? configId ?? null,
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
      queueId: normalizedQueueId ?? undefined,
      mode: resolvedMode ?? fallbackMode,
      ...(sanitizeMetadata(metadata) ?? {}),
    },
    temperature: typeof configuredTemperature === 'number' ? configuredTemperature : undefined,
    max_output_tokens: typeof configuredMaxTokens === 'number' ? configuredMaxTokens : undefined,
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
