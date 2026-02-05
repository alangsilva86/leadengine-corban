import { z, ZodError } from 'zod';
import { logger } from './logger';

const isoDateString = z
  .string()
  .trim()
  .refine((value) => value.length > 0, {
    message: 'A data não pode estar vazia quando informada.',
  })
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Use uma data/hora no formato ISO 8601 (ex.: 2025-01-01T00:00:00Z).',
  });

const ConfigSchema = z
  .object({
    baseUrl: z.string().url({ message: 'LEAD_ENGINE_BROKER_BASE_URL precisa ser uma URL válida.' }),
    creditBaseUrl: z.string().url().optional(),
    basicToken: z.string().min(1, { message: 'LEAD_ENGINE_BASIC_TOKEN é obrigatório.' }),
    timeoutMs: z.number().int().positive().default(8000),
    defaultStartDate: isoDateString.optional(),
    defaultEndDate: isoDateString.optional(),
  })
  .superRefine((config, ctx) => {
    if (config.defaultStartDate && config.defaultEndDate) {
      const start = Date.parse(config.defaultStartDate);
      const end = Date.parse(config.defaultEndDate);
      if (start > end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'LEAD_ENGINE_DEFAULT_START_DATE deve ser anterior à LEAD_ENGINE_DEFAULT_END_DATE.',
          path: ['defaultStartDate'],
        });
      }
    }
  });

const normaliseBasicToken = (token?: string | null): string | undefined => {
  if (!token) {
    return undefined;
  }

  return token.replace(/^Basic\s+/i, '').trim();
};

const rawBaseUrl =
  process.env.LEAD_ENGINE_BROKER_BASE_URL || process.env.LEAD_ENGINE_BASE_URL || '';
const rawCreditBaseUrl =
  process.env.LEAD_ENGINE_CREDIT_BASE_URL || process.env.LEAD_ENGINE_CREDIT_BASEURL;

const rawBasicToken =
  normaliseBasicToken(process.env.LEAD_ENGINE_BASIC_TOKEN) ||
  normaliseBasicToken(
    process.env.LEAD_ENGINE_BASIC_USER && process.env.LEAD_ENGINE_BASIC_PASSWORD
      ? Buffer.from(
          `${process.env.LEAD_ENGINE_BASIC_USER}:${process.env.LEAD_ENGINE_BASIC_PASSWORD}`
        ).toString('base64')
      : undefined
  );

let parsedConfig: z.infer<typeof ConfigSchema>;

try {
  parsedConfig = ConfigSchema.parse({
    baseUrl: rawBaseUrl,
    creditBaseUrl: rawCreditBaseUrl,
    basicToken: rawBasicToken,
    timeoutMs: process.env.LEAD_ENGINE_TIMEOUT_MS
      ? Number(process.env.LEAD_ENGINE_TIMEOUT_MS)
      : undefined,
    defaultStartDate: process.env.LEAD_ENGINE_DEFAULT_START_DATE,
    defaultEndDate: process.env.LEAD_ENGINE_DEFAULT_END_DATE,
  });
} catch (error) {
  logger.error('Lead Engine configuration is invalid', {
    issues: error instanceof ZodError ? error.issues : error,
  });
  throw error;
}

export const leadEngineConfig = parsedConfig;

logger.info('Lead Engine configuration normalised', {
  effectiveBaseUrl: leadEngineConfig.baseUrl,
  effectiveCreditBaseUrl: leadEngineConfig.creditBaseUrl || null,
  tokenPreview: leadEngineConfig.basicToken ? `${leadEngineConfig.basicToken.slice(0, 6)}…` : null,
  timeoutMs: leadEngineConfig.timeoutMs,
  defaultStartDate: leadEngineConfig.defaultStartDate || null,
  defaultEndDate: leadEngineConfig.defaultEndDate || null,
});

export interface BrokerLeadRecord {
  id: string;
  fullName: string;
  document: string;
  registrations: string[];
  agreementId: string;
  phone?: string;
  margin?: number;
  netMargin?: number;
  score?: number;
  tags?: string[];
}
