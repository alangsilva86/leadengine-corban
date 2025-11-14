import { BankIntegrationHttpClient } from './base-client';
import type {
  BankIntegrationAgreementRaw,
  BankIntegrationRequestContext,
} from './types';

type ZeniteAgreementResponse = {
  id: string;
  title: string;
  status?: string;
  lastUpdated?: string;
  pricing?: {
    baseRate?: {
      id: string;
      type: string;
      value: number;
      unit?: string;
      effectiveAt?: string;
      expiresAt?: string;
    };
    variations?: Array<{
      id: string;
      type: string;
      value: number;
      unit?: string;
      effectiveAt?: string;
      expiresAt?: string;
    }>;
  };
  tables?: Array<{
    hash: string;
    product: string;
    termInMonths: number;
    coefficient: number;
    minAmount?: number;
    maxAmount?: number;
  }>;
};

type ZeniteEnvelope = {
  agreements?: ZeniteAgreementResponse[];
  nextCursor?: string | number | null;
};

export class ZeniteFinanceClient extends BankIntegrationHttpClient {
  protected async fetchFromProvider(
    context: BankIntegrationRequestContext
  ): Promise<BankIntegrationAgreementRaw[]> {
    const records = await this.paginate<ZeniteAgreementResponse>(
      '/v2/agreements',
      { pagination: this.settings.pagination },
      (response) => {
        const envelope = this.normalize(response);
        const hasNext = Boolean(envelope.nextCursor);
        return {
          items: envelope.agreements ?? [],
          hasNext,
          cursor: envelope.nextCursor ?? null,
        };
      },
      context
    );

    return records.map((item): BankIntegrationAgreementRaw => {
      const rates = [] as BankIntegrationAgreementRaw['rates'];
      if (item.pricing?.baseRate) {
        const { baseRate } = item.pricing;
        rates.push({
          id: baseRate.id,
          type: baseRate.type,
          value: baseRate.value,
          unit: baseRate.unit ?? null,
          effectiveAt: baseRate.effectiveAt ?? null,
          expiresAt: baseRate.expiresAt ?? null,
        });
      }
      if (Array.isArray(item.pricing?.variations)) {
        for (const variation of item.pricing.variations) {
          rates.push({
            id: variation.id,
            type: variation.type,
            value: variation.value,
            unit: variation.unit ?? null,
            effectiveAt: variation.effectiveAt ?? null,
            expiresAt: variation.expiresAt ?? null,
          });
        }
      }

      return {
        agreement: {
          id: item.id,
          name: item.title,
          updatedAt: item.lastUpdated ?? null,
          status: item.status ?? null,
        },
        rates,
        tables: (item.tables ?? []).map((table) => ({
          id: table.hash,
          product: table.product,
          termMonths: table.termInMonths,
          coefficient: table.coefficient,
          minValue: table.minAmount ?? null,
          maxValue: table.maxAmount ?? null,
        })),
      } satisfies BankIntegrationAgreementRaw;
    });
  }

  private normalize(payload: unknown): ZeniteEnvelope {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const record = payload as Record<string, unknown>;
      return {
        agreements: Array.isArray(record.agreements)
          ? (record.agreements as ZeniteAgreementResponse[])
          : undefined,
        nextCursor:
          record.nextCursor !== undefined && record.nextCursor !== null
            ? (record.nextCursor as ZeniteEnvelope['nextCursor'])
            : null,
      };
    }

    if (Array.isArray(payload)) {
      return { agreements: payload as ZeniteAgreementResponse[], nextCursor: null };
    }

    return { agreements: [], nextCursor: null };
  }
}

