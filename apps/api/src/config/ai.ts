import { z } from 'zod';
import { logger } from './logger';

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';
const RELEASE_SUFFIX_REGEX = /-(?:20\d{2}-\d{2}-\d{2}|latest)$/i;

type AiAssistantMode = 'IA_AUTO' | 'COPILOTO' | 'HUMANO';

const DEFAULT_ASSISTANT_MODE: AiAssistantMode = 'IA_AUTO';

const aiEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default(DEFAULT_OPENAI_MODEL),
  OPENAI_VECTOR_STORE_ID: z.string().min(1).optional(),
  OPENAI_RESPONSES_API_URL: z.string().min(1).optional(),
  AI_STREAM_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  AI_TOOL_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  AI_TOOL_MAX_RETRIES: z.coerce.number().int().min(0).max(5).optional(),
  AI_TOOL_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(10).optional(),
  AI_TOOL_RETRY_DELAY_MS: z.coerce.number().int().min(0).optional(),
});

const parsed = aiEnvSchema.safeParse(process.env);

if (!parsed.success) {
  logger.warn('AI config env validation failed', { error: parsed.error.flatten() });
}

const env = parsed.success ? parsed.data : aiEnvSchema.parse({});

const modeAliases: Record<string, AiAssistantMode> = {
  IA_AUTO: 'IA_AUTO',
  AUTO: 'IA_AUTO',
  AI_AUTO: 'IA_AUTO',
  IA__AUTO: 'IA_AUTO',
  IA_AUTO_REPLY: 'IA_AUTO',
  AUTO_REPLY: 'IA_AUTO',
  AUTO__REPLY: 'IA_AUTO',
  COPILOTO: 'COPILOTO',
  AI_ASSIST: 'COPILOTO',
  IA_ASSIST: 'COPILOTO',
  ASSIST: 'COPILOTO',
  ASSISTENTE: 'COPILOTO',
  HUMANO: 'HUMANO',
  HUMAN: 'HUMANO',
  IA_MANUAL: 'HUMANO',
  AI_MANUAL: 'HUMANO',
  MANUAL: 'HUMANO',
};

const resolveEnvCandidate = (...candidates: Array<string | undefined>): string | undefined => {
  for (const candidate of candidates) {
    if (candidate && candidate.trim()) {
      return candidate;
    }
  }
  return undefined;
};

export const normalizeOpenAiModel = (
  value: string | undefined | null,
  fallback: string = DEFAULT_OPENAI_MODEL
): string => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  const withoutReleaseSuffix = trimmed.replace(RELEASE_SUFFIX_REGEX, '');
  return withoutReleaseSuffix.length > 0 ? withoutReleaseSuffix : fallback;
};

const normalizeAssistantMode = (
  value: string | undefined | null,
  fallback: AiAssistantMode = DEFAULT_ASSISTANT_MODE
): AiAssistantMode => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  return modeAliases[normalized] ?? fallback;
};

export const resolveDefaultAiMode = (): AiAssistantMode => {
  const candidate = resolveEnvCandidate(
    process.env.AI_MODE,
    process.env.AI_DEFAULT_MODE,
    process.env.DEFAULT_AI_MODE
  );

  return normalizeAssistantMode(candidate, DEFAULT_ASSISTANT_MODE);
};

const defaultAssistantMode = resolveDefaultAiMode();
const defaultModel = normalizeOpenAiModel(env.OPENAI_MODEL, DEFAULT_OPENAI_MODEL);
const resolvedResponsesApiUrl = env.OPENAI_RESPONSES_API_URL?.trim();

export const aiConfig = {
  apiKey: env.OPENAI_API_KEY,
  defaultModel,
  defaultVectorStoreId: env.OPENAI_VECTOR_STORE_ID,
  streamTimeoutMs: env.AI_STREAM_TIMEOUT_MS ?? 120_000,
  toolTimeoutMs: env.AI_TOOL_TIMEOUT_MS ?? 15_000,
  toolMaxRetries: env.AI_TOOL_MAX_RETRIES ?? 1,
  toolMaxConcurrency: env.AI_TOOL_MAX_CONCURRENCY ?? 4,
  toolRetryDelayMs: env.AI_TOOL_RETRY_DELAY_MS ?? 250,
  defaultAssistantMode: defaultAssistantMode,
};

export const isAiEnabled = Boolean(aiConfig.apiKey);
export const RESPONSES_API_URL =
  resolvedResponsesApiUrl && resolvedResponsesApiUrl.length > 0
    ? resolvedResponsesApiUrl
    : DEFAULT_RESPONSES_API_URL;

// Função para logar configuração (chamada após inicialização)
export function logAiConfiguration() {
  try {
    console.log('AI Configuration:', {
      isAiEnabled,
      hasApiKey: Boolean(aiConfig.apiKey),
      apiKeyLength: aiConfig.apiKey?.length ?? 0,
      defaultModel: aiConfig.defaultModel,
      defaultAssistantMode: aiConfig.defaultAssistantMode,
    });
  } catch (error) {
    console.error('Failed to log AI configuration:', error);
  }
}

export type { AiAssistantMode };
