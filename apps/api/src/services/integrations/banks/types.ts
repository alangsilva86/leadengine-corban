import type {
  BankIntegrationPaginationConfig,
  BankIntegrationSettings,
  BankProviderId,
} from '../../../config/bank-integrations';

export interface BankIntegrationRequestContext {
  traceId: string;
}

export interface BankIntegrationAgreementRaw {
  agreement: {
    id: string;
    name: string;
    updatedAt?: string | null;
    status?: string | null;
    metadata?: Record<string, unknown> | null;
  };
  rates: BankIntegrationRateRaw[];
  tables: BankIntegrationTableRaw[];
}

export interface BankIntegrationRateRaw {
  id: string;
  type: string;
  value: number;
  unit?: string | null;
  effectiveAt?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface BankIntegrationTableRaw {
  id: string;
  product: string;
  termMonths: number;
  coefficient: number;
  minValue?: number | null;
  maxValue?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface BankPaginatedRequestConfig {
  pagination: BankIntegrationPaginationConfig;
  pageSizeOverride?: number;
}

export interface BankIntegrationClient {
  readonly settings: BankIntegrationSettings;
  fetchAgreements(
    context: BankIntegrationRequestContext
  ): Promise<BankIntegrationAgreementRaw[]>;
}

export type BankIntegrationClientFactory = (settings: BankIntegrationSettings) => BankIntegrationClient;

export interface BankIntegrationResponseEnvelope<T> {
  data: T[];
  pagination?: {
    page: number;
    totalPages?: number;
    hasNext?: boolean;
    nextCursor?: string | number | null;
  };
}

export type { BankProviderId };

