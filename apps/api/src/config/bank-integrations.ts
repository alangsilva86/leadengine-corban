import { logger } from './logger';

export type BankProviderId = 'atlas-promotora' | 'aurora-bank' | 'zenite-finance';

export type BankIntegrationAuthConfig =
  | { type: 'apiKey'; header: string; value: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'bearer'; token: string };

export interface BankIntegrationThrottleConfig {
  maxRequestsPerInterval: number;
  intervalMs: number;
}

export interface BankIntegrationPaginationConfig {
  pageParam: string;
  sizeParam: string;
  initialPage: number;
  maxPageSize: number;
}

export interface BankIntegrationSettings {
  id: BankProviderId;
  name: string;
  baseUrl: string;
  auth?: BankIntegrationAuthConfig;
  timeoutMs: number;
  maxRetries: number;
  throttle: BankIntegrationThrottleConfig;
  pagination: BankIntegrationPaginationConfig;
  enabled: boolean;
  deprecated?: boolean;
  sunsetAt?: string | null;
  tags?: string[];
}

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const DEFAULT_TIMEOUT_MS = toNumber(process.env.BANK_HTTP_TIMEOUT_MS, 15_000);
const DEFAULT_MAX_RETRIES = Math.max(toNumber(process.env.BANK_HTTP_MAX_RETRIES, 3), 1);
const DEFAULT_THROTTLE_RPS = Math.max(toNumber(process.env.BANK_HTTP_RPS, 5), 1);

const buildThrottle = (rps: number): BankIntegrationThrottleConfig => ({
  maxRequestsPerInterval: rps,
  intervalMs: 1_000,
});

const atlasBaseUrl = (process.env.BANK_ATLAS_BASE_URL ?? '').trim();
const atlasApiKey = (process.env.BANK_ATLAS_API_KEY ?? '').trim();

const auroraBaseUrl = (process.env.BANK_AURORA_BASE_URL ?? '').trim();
const auroraUser = (process.env.BANK_AURORA_USERNAME ?? '').trim();
const auroraPassword = (process.env.BANK_AURORA_PASSWORD ?? '').trim();

const zeniteBaseUrl = (process.env.BANK_ZENITE_BASE_URL ?? '').trim();
const zeniteToken = (process.env.BANK_ZENITE_TOKEN ?? '').trim();

const atlasSettings: BankIntegrationSettings = {
  id: 'atlas-promotora',
  name: 'Atlas Promotora',
  baseUrl: atlasBaseUrl,
  auth: atlasApiKey
    ? {
        type: 'apiKey',
        header: 'X-Atlas-Key',
        value: atlasApiKey,
      }
    : undefined,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  maxRetries: DEFAULT_MAX_RETRIES,
  throttle: buildThrottle(Math.max(DEFAULT_THROTTLE_RPS, 8)),
  pagination: {
    pageParam: 'page',
    sizeParam: 'pageSize',
    initialPage: 1,
    maxPageSize: 100,
  },
  enabled: Boolean(atlasBaseUrl && atlasApiKey),
  tags: ['consignado', 'promotora'],
};

const auroraSettings: BankIntegrationSettings = {
  id: 'aurora-bank',
  name: 'Aurora Bank',
  baseUrl: auroraBaseUrl,
  auth:
    auroraUser && auroraPassword
      ? {
          type: 'basic',
          username: auroraUser,
          password: auroraPassword,
        }
      : undefined,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  maxRetries: DEFAULT_MAX_RETRIES,
  throttle: buildThrottle(DEFAULT_THROTTLE_RPS),
  pagination: {
    pageParam: 'pageNumber',
    sizeParam: 'pageLength',
    initialPage: 0,
    maxPageSize: 50,
  },
  enabled: Boolean(auroraBaseUrl && auroraUser && auroraPassword),
  tags: ['banco-digital'],
};

const zeniteSettings: BankIntegrationSettings = {
  id: 'zenite-finance',
  name: 'Zênite Financeira',
  baseUrl: zeniteBaseUrl,
  auth: zeniteToken
    ? {
        type: 'bearer',
        token: zeniteToken,
      }
    : undefined,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  maxRetries: DEFAULT_MAX_RETRIES,
  throttle: buildThrottle(Math.max(DEFAULT_THROTTLE_RPS, 3)),
  pagination: {
    pageParam: 'cursor',
    sizeParam: 'limit',
    initialPage: 0,
    maxPageSize: 200,
  },
  enabled: Boolean(zeniteBaseUrl && zeniteToken),
  deprecated: Boolean(process.env.BANK_ZENITE_DEPRECATED === 'true'),
  sunsetAt: (process.env.BANK_ZENITE_SUNSET_AT ?? '').trim() || null,
  tags: ['credito-pessoal'],
};

export const bankIntegrationSettings: BankIntegrationSettings[] = [
  atlasSettings,
  auroraSettings,
  zeniteSettings,
];

export const getEnabledBankIntegrations = (): BankIntegrationSettings[] => {
  const enabled = bankIntegrationSettings.filter((settings) => settings.enabled);

  if (!enabled.length) {
    logger.warn('[AgreementsSync] Nenhuma integração de banco habilitada. Verifique as variáveis de ambiente.');
  }

  return enabled;
};

export const findBankIntegrationSettings = (providerId: BankProviderId): BankIntegrationSettings | undefined =>
  bankIntegrationSettings.find((settings) => settings.id === providerId);

export const __testing = {
  toNumber,
  buildThrottle,
};

