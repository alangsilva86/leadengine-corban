import type { Prisma } from '@prisma/client';
import {
  getAiConfig,
  upsertAiConfig,
  type UpsertAiConfigInput,
  type AiAssistantMode,
} from '@ticketz/storage';

import { aiConfig as envAiConfig, isAiEnabled } from '../../config/ai';
import { logger } from '../../config/logger';

export type AiConfigRecord = Awaited<ReturnType<typeof getAiConfig>>;

export const DEFAULT_MODE: AiAssistantMode = 'IA_AUTO';

export const defaultSuggestionSchema: Prisma.JsonValue = {
  type: 'object',
  additionalProperties: false,
  required: ['next_step', 'tips', 'objections', 'confidence'],
  properties: {
    next_step: { type: 'string' },
    tips: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'message'],
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
    objections: {
      type: 'array',
      items: {
        type: 'object',
        required: ['label', 'reply'],
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          reply: { type: 'string' },
        },
      },
    },
    confidence: { type: 'number' },
  },
};

export const buildConfigUpsertPayload = (
  tenantId: string,
  queueId: string | null,
  existing: AiConfigRecord,
  overrides: Partial<UpsertAiConfigInput> = {}
): UpsertAiConfigInput => {
  const temperature = overrides.temperature ?? existing?.temperature;
  const maxOutputTokens = overrides.maxOutputTokens ?? existing?.maxOutputTokens ?? null;
  const systemPromptReply = overrides.systemPromptReply ?? existing?.systemPromptReply ?? null;
  const systemPromptSuggest = overrides.systemPromptSuggest ?? existing?.systemPromptSuggest ?? null;
  const structuredOutputSchema =
    overrides.structuredOutputSchema ?? existing?.structuredOutputSchema ?? null;
  const tools = overrides.tools ?? existing?.tools ?? null;
  const vectorStoreEnabled = overrides.vectorStoreEnabled ?? existing?.vectorStoreEnabled;
  const vectorStoreIds = overrides.vectorStoreIds ?? existing?.vectorStoreIds;
  const streamingEnabled = overrides.streamingEnabled ?? existing?.streamingEnabled;
  const defaultMode = overrides.defaultMode ?? existing?.defaultMode ?? DEFAULT_MODE;
  const confidenceThreshold = overrides.confidenceThreshold ?? existing?.confidenceThreshold;
  const fallbackPolicy = overrides.fallbackPolicy ?? existing?.fallbackPolicy;

  const payload: UpsertAiConfigInput = {
    tenantId,
    queueId,
    scopeKey: queueId ?? '__global__',
    model: overrides.model ?? existing?.model ?? envAiConfig.defaultModel,
    maxOutputTokens,
    systemPromptReply,
    systemPromptSuggest,
    structuredOutputSchema,
    tools,
    defaultMode,
  };

  if (temperature !== undefined) {
    payload.temperature = temperature;
  }
  if (vectorStoreEnabled !== undefined) {
    payload.vectorStoreEnabled = vectorStoreEnabled;
  }
  payload.vectorStoreIds = vectorStoreIds ?? [];
  if (streamingEnabled !== undefined) {
    payload.streamingEnabled = streamingEnabled;
  }
  if (confidenceThreshold !== undefined) {
    payload.confidenceThreshold = confidenceThreshold;
  }
  if (fallbackPolicy !== undefined) {
    payload.fallbackPolicy = fallbackPolicy ?? null;
  }

  return payload;
};

const fetchConfigWithFallback = async (
  tenantId: string,
  queueId: string | null
): Promise<AiConfigRecord> => {
  const scoped = await getAiConfig(tenantId, queueId);
  if (scoped) {
    return scoped;
  }
  if (queueId) {
    const globalConfig = await getAiConfig(tenantId, null);
    if (globalConfig) {
      logger.debug('ai.config.fallback.global', { tenantId, queueId });
      return globalConfig;
    }
  }
  return null;
};

export const ensureAiConfig = async (
  tenantId: string,
  queueId: string | null
): Promise<NonNullable<AiConfigRecord>> => {
  const existing = await fetchConfigWithFallback(tenantId, queueId);
  if (existing) {
    return existing;
  }

  return upsertAiConfig({
    tenantId,
    queueId,
    scopeKey: queueId ?? '__global__',
    model: envAiConfig.defaultModel,
    structuredOutputSchema: defaultSuggestionSchema,
  });
};

export const getModeConfig = async (tenantId: string, queueId: string | null) => {
  const config = await fetchConfigWithFallback(tenantId, queueId);

  return {
    mode: config?.defaultMode ?? DEFAULT_MODE,
    aiEnabled: isAiEnabled,
  };
};

export const updateModeConfig = async (
  tenantId: string,
  queueId: string | null,
  mode: AiAssistantMode
) => {
  const existing = await getAiConfig(tenantId, queueId);
  const configData = buildConfigUpsertPayload(tenantId, queueId, existing, {
    defaultMode: mode,
  });
  const config = await upsertAiConfig(configData);

  logger.info('crm.ai.mode.updated', {
    tenantId,
    queueId,
    mode,
  });

  return {
    mode: config.defaultMode ?? DEFAULT_MODE,
  };
};

export const getConfigSettings = async (tenantId: string, queueId: string | null) => {
  const existing = await fetchConfigWithFallback(tenantId, queueId);

  if (!existing) {
    return {
      tenantId,
      queueId,
      model: envAiConfig.defaultModel,
      temperature: 0.3,
      maxOutputTokens: null,
      systemPromptReply: null,
      systemPromptSuggest: null,
      structuredOutputSchema: defaultSuggestionSchema,
      tools: [],
      vectorStoreEnabled: false,
      vectorStoreIds: [],
      streamingEnabled: true,
      defaultMode: DEFAULT_MODE,
      confidenceThreshold: 0,
      fallbackPolicy: null,
      aiEnabled: isAiEnabled,
    };
  }

  return {
    ...existing,
    defaultMode: existing.defaultMode ?? DEFAULT_MODE,
    aiEnabled: isAiEnabled,
  };
};

export const updateConfigSettings = async (
  tenantId: string,
  queueId: string | null,
  payload: UpsertAiConfigInput
) => {
  const existing = await getAiConfig(tenantId, queueId);

  const configData = buildConfigUpsertPayload(tenantId, queueId, existing, {
    model: payload.model,
    temperature: payload.temperature,
    maxOutputTokens: payload.maxOutputTokens ?? null,
    systemPromptReply: payload.systemPromptReply ?? null,
    systemPromptSuggest: payload.systemPromptSuggest ?? null,
    structuredOutputSchema: payload.structuredOutputSchema ?? null,
    tools: payload.tools ?? null,
    vectorStoreEnabled: payload.vectorStoreEnabled ?? false,
    vectorStoreIds: payload.vectorStoreIds ?? [],
    streamingEnabled: payload.streamingEnabled ?? true,
    defaultMode: payload.defaultMode ?? existing?.defaultMode ?? DEFAULT_MODE,
    confidenceThreshold: payload.confidenceThreshold ?? null,
    fallbackPolicy: payload.fallbackPolicy ?? null,
  });

  const config = await upsertAiConfig(configData);

  return {
    ...config,
    defaultMode: config.defaultMode ?? DEFAULT_MODE,
    aiEnabled: isAiEnabled,
  };
};
