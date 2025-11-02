import { z } from 'zod';
import { logger } from './logger';

const aiEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default('gpt-4o-mini'),
  OPENAI_VECTOR_STORE_ID: z.string().min(1).optional(),
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
};

export const isAiEnabled = Boolean(aiConfig.apiKey);
