
import { z, ZodError } from 'zod';
import { logger } from './logger';

export interface AgreementDefinition {
  id: string;
  name: string;
  slug: string;
  description: string;
  region: string;
  basePrice: number;
  unit: 'lead';
  suggestedBatch: number;
  tags: string[];
}

export const agreementDefinitions: AgreementDefinition[] = [
  {
    id: 'saec-goiania',
    name: 'SAEC Goiânia',
    slug: 'SaecGoiania',
    description: 'Servidores municipais de Goiânia com folha SAEC.',
    region: 'GO',
    basePrice: 12,
    unit: 'lead',
    suggestedBatch: 25,
    tags: ['prefeitura', 'consignado'],
  },
  {
    id: 'saec-curaca',
    name: 'SAEC Curaçá',
    slug: 'SaecCuraca',
    description: 'Convênio ativo para consignado em Curaçá (BA).',
    region: 'BA',
    basePrice: 12,
    unit: 'lead',
    suggestedBatch: 20,
    tags: ['prefeitura'],
  },
  {
    id: 'saec-caldas-novas',
    name: 'SAEC Caldas Novas',
    slug: 'SaecCaldasNovas',
    description: 'Convênio municipal com alta taxa de resposta à URA.',
    region: 'GO',
    basePrice: 12,
    unit: 'lead',
    suggestedBatch: 25,
    tags: ['prefeitura', 'hotspot'],
  },
  {
    id: 'rf1-boa-vista',
    name: 'RF1 Boa Vista',
    slug: 'Rf1BoaVista',
    description: 'Convênio estadual de Roraima com forte adesão.',
    region: 'RR',
    basePrice: 12,
    unit: 'lead',
    suggestedBatch: 20,
    tags: ['estado'],
  },
  {
    id: 'econsig-londrina',
    name: 'EConsig Londrina',
    slug: 'EConsigLondrina',
    description: 'Convênio do município de Londrina com integração eConsig.',
    region: 'PR',
    basePrice: 12,
    unit: 'lead',
    suggestedBatch: 30,
    tags: ['prefeitura'],
  },
  {
    id: 'consigtec-maringa',
    name: 'ConsigTec Maringá',
    slug: 'ConsigTecMaringa',
    description: 'Convênio ativo do ConsigTec com servidores de Maringá.',
    region: 'PR',
    basePrice: 12,
    unit: 'lead',
    suggestedBatch: 25,
    tags: ['prefeitura'],
  },
  {
    id: 'econsig-guaratuba',
    name: 'EConsig Guaratuba',
    slug: 'EConsigGuaratuba',
    description: 'Convênio com integração eConsig para o município de Guaratuba.',
    region: 'PR',
    basePrice: 12,
    unit: 'lead',
    suggestedBatch: 20,
    tags: ['prefeitura'],
  },
];

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

export interface AgreementSummary extends AgreementDefinition {
  availableLeads: number;
  hotLeads: number;
  lastSyncAt: string | null;
}

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
