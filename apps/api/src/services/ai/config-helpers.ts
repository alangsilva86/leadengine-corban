import type { Prisma } from '@prisma/client';
import type { AiAssistantMode, UpsertAiConfigInput, getAiConfig } from '@ticketz/storage';
import { aiConfig as envAiConfig } from '../../config/ai';

export type AiConfigRecord = Awaited<ReturnType<typeof getAiConfig>>;

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

export const DEFAULT_MODE: AiAssistantMode = 'COPILOTO';

export const normalizeModeFromFrontend = (mode: string): AiAssistantMode | null => {
  const normalized = mode.trim().toLowerCase();

  if (normalized === 'assist') return 'COPILOTO';
  if (normalized === 'auto' || normalized === 'autonomous') return 'IA_AUTO';
  if (normalized === 'manual') return 'HUMANO';

  if (normalized === 'copiloto') return 'COPILOTO';
  if (normalized === 'ia_auto') return 'IA_AUTO';
  if (normalized === 'humano') return 'HUMANO';

  return null;
};

export const modeToFrontend = (mode: AiAssistantMode): 'assist' | 'auto' | 'manual' => {
  if (mode === 'IA_AUTO') return 'auto';
  if (mode === 'HUMANO') return 'manual';
  return 'assist';
};

type ConfigOverrides = Partial<UpsertAiConfigInput>;

export const buildConfigUpsertPayload = (
  tenantId: string,
  queueId: string | null,
  existing: AiConfigRecord,
  overrides: ConfigOverrides = {}
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
