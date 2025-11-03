import { z } from 'zod';
import { logger } from './logger';

const aiEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default('gpt-4o-mini'),
  OPENAI_VECTOR_STORE_ID: z.string().min(1).optional(),
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

export const aiConfig = {
  apiKey: env.OPENAI_API_KEY,
  defaultModel: env.OPENAI_MODEL,
  defaultVectorStoreId: env.OPENAI_VECTOR_STORE_ID,
  streamTimeoutMs: env.AI_STREAM_TIMEOUT_MS ?? 120_000,
  toolTimeoutMs: env.AI_TOOL_TIMEOUT_MS ?? 15_000,
  toolMaxRetries: env.AI_TOOL_MAX_RETRIES ?? 1,
  toolMaxConcurrency: env.AI_TOOL_MAX_CONCURRENCY ?? 4,
  toolRetryDelayMs: env.AI_TOOL_RETRY_DELAY_MS ?? 250,
};

export const isAiEnabled = Boolean(aiConfig.apiKey);

// Log de debug para verificar se AI está habilitada
logger.info('AI Configuration', {
  isAiEnabled,
  hasApiKey: Boolean(aiConfig.apiKey),
  apiKeyLength: aiConfig.apiKey?.length ?? 0,
  defaultModel: aiConfig.defaultModel,
});
