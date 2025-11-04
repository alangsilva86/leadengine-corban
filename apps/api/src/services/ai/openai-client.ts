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

export class AiServiceError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, options: { status?: number; details?: unknown } = {}) {
    super(message);
    this.name = 'AiServiceError';
    this.status = options.status ?? 500;
    this.details = options.details;
  }
}

type SuggestOutputFormat =
  | {
      type: 'json_schema';
      name: string;
      schema: Prisma.JsonValue;
      strict?: boolean;
    }
  | {
      type: 'text';
      name: string;
    };

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
  outputFormat?: SuggestOutputFormat;
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
const MAX_SUGGESTION_ATTEMPTS = 3;
const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const RETRY_BASE_DELAY_MS = 400;

type AiConfigRecord = Awaited<ReturnType<typeof getAiConfig>>;

const clampString = (value: string, limit = 512): string => (value.length > limit ? value.slice(0, limit) : value);

const sanitizeMetadata = (raw?: Record<string, unknown> | null): Record<string, string> | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const entries: Array<[string, string]> = [];

  for (const [key, value] of Object.entries(raw)) {
    if (entries.length >= 16) break;
    if (value === undefined || value === null) continue;
    const normalized =
      typeof value === 'string'
        ? clampString(value)
        : clampString(String(value));
    entries.push([key, normalized]);
  }

  return entries.length > 0 ? (Object.fromEntries(entries) as Record<string, string>) : undefined;
};

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const parseRetryAfterHeader = (value: string | null): number | null => {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const asDate = Date.parse(value);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now());
  }
  return null;
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
    outputFormat,
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
    const error = new AiServiceError('AI configuration could not be resolved.', {
      status: 500,
    });
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

  const responseSchema =
    structuredSchema && typeof structuredSchema === 'object'
      ? structuredSchema
      : {
          type: 'object',
          additionalProperties: false,
        };

  const appliedFormat: SuggestOutputFormat = (() => {
    if (outputFormat?.type === 'text') {
      const name = outputFormat.name && outputFormat.name.trim() ? outputFormat.name.trim() : 'plain';
      return { type: 'text', name };
    }
    if (outputFormat?.type === 'json_schema') {
      const name = outputFormat.name && outputFormat.name.trim() ? outputFormat.name.trim() : 'AiSuggestion';
      const schema = outputFormat.schema ?? responseSchema;
      return {
        type: 'json_schema',
        name,
        schema,
        strict: outputFormat.strict ?? true,
      };
    }
    return {
      type: 'json_schema',
      name: 'AiSuggestion',
      schema: responseSchema,
      strict: true,
    };
  })();

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
    text: {
      format:
        appliedFormat.type === 'json_schema'
          ? {
              type: 'json_schema',
              name: appliedFormat.name,
              schema: appliedFormat.schema,
              strict: appliedFormat.strict ?? true,
            }
          : {
              type: 'text',
              name: appliedFormat.name,
            },
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
    let response: Response | null = null;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < MAX_SUGGESTION_ATTEMPTS) {
      attempt += 1;
      try {
        response = await fetch(OPENAI_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${aiConfig.apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });
      } catch (networkError) {
        lastError = networkError instanceof Error ? networkError : new Error(String(networkError));
        const delay = RETRY_BASE_DELAY_MS * attempt;
        await wait(delay);
        continue;
      }

      if (!response.ok && RETRYABLE_STATUS_CODES.has(response.status) && attempt < MAX_SUGGESTION_ATTEMPTS) {
        const retryAfterMs = parseRetryAfterHeader(response.headers.get('retry-after'));
        const delay = retryAfterMs ?? RETRY_BASE_DELAY_MS * attempt;
        await wait(delay);
        continue;
      }

      break;
    }

    if (!response) {
      throw lastError ?? new Error('Não foi possível contatar o serviço da OpenAI.');
    }

    const requestId = response.headers.get('x-request-id') ?? null;

    if (!response.ok) {
      const rawText = await response.text().catch(() => null);
      let details: unknown = rawText;
      let message = `OpenAI request failed: ${response.status} ${response.statusText}`;

      if (rawText) {
        try {
          const parsed = JSON.parse(rawText);
          details = parsed;
          const apiMessage =
            parsed?.error?.message ??
            parsed?.message ??
            parsed?.error ??
            parsed?.details ??
            null;
          if (typeof apiMessage === 'string' && apiMessage.trim().length > 0) {
            message = apiMessage.trim();
          }
        } catch {
          // mantém texto bruto
        }
      }

      throw new AiServiceError(message, {
        status: response.status,
        details: {
          requestId,
          body: details,
        },
      });
    }

    const json = (await response.json()) as any;
    const latencyMs = Date.now() - startedAt;

    const firstContentEntry =
      Array.isArray(json?.output?.[0]?.content) && json.output[0].content.length > 0
        ? json.output[0].content.find((entry: any) => entry && entry.type === 'output_text')
        : null;

    const outputText =
      typeof json?.output_text === 'string'
        ? json.output_text
        : typeof firstContentEntry?.text === 'string'
          ? firstContentEntry.text
          : '';

    let parsedPayload: Prisma.JsonValue = {};

    if (appliedFormat.type === 'json_schema') {
      try {
        parsedPayload = JSON.parse(outputText || '{}');
      } catch (error) {
        logger.warn('Failed to parse structured output, returning raw text', { error });
        parsedPayload = { raw: outputText };
      }
    } else {
      parsedPayload = outputText;
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

    if (error instanceof AiServiceError) {
      throw error;
    }

    throw new AiServiceError(
      error instanceof Error ? error.message : 'Erro desconhecido ao gerar sugestão da IA.',
      { status: 500 }
    );
  }
};
