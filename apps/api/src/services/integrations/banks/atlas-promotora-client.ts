import { BankIntegrationHttpClient, ensureEnvelope } from './base-client';
import type {
  BankIntegrationAgreementRaw,
  BankIntegrationRequestContext,
} from './types';

type AtlasAgreementResponse = {
  agreementId: string;
  agreementName: string;
  updatedAt?: string;
  status?: string;
  rates?: Array<{
    id: string;
    type: string;
    value: number;
    unit?: string;
    effectiveDate?: string;
    expirationDate?: string;
  }>;
  tables?: Array<{
    id: string;
    product: string;
    termMonths: number;
    coefficient: number;
    minimumValue?: number;
    maximumValue?: number;
  }>;
};

export class AtlasPromotoraClient extends BankIntegrationHttpClient {
  protected async fetchFromProvider(
    context: BankIntegrationRequestContext
  ): Promise<BankIntegrationAgreementRaw[]> {
    const records = await this.paginate<AtlasAgreementResponse>(
      '/api/v1/agreements',
      { pagination: this.settings.pagination },
      (response) => {
        const envelope = ensureEnvelope<AtlasAgreementResponse>(response);
        const hasNext = Boolean(envelope.pagination?.hasNext);
        const nextCursor = envelope.pagination?.nextCursor ?? null;
        return { items: envelope.data, hasNext, cursor: nextCursor };
      },
      context
    );

    return records.map((item): BankIntegrationAgreementRaw => ({
      agreement: {
        id: item.agreementId,
        name: item.agreementName,
        updatedAt: item.updatedAt ?? null,
        status: item.status ?? null,
      },
      rates: (item.rates ?? []).map((rate) => ({
        id: rate.id,
        type: rate.type,
        value: rate.value,
        unit: rate.unit ?? null,
        effectiveAt: rate.effectiveDate ?? null,
        expiresAt: rate.expirationDate ?? null,
      })),
      tables: (item.tables ?? []).map((table) => ({
        id: table.id,
        product: table.product,
        termMonths: table.termMonths,
        coefficient: table.coefficient,
        minValue: table.minimumValue ?? null,
        maxValue: table.maximumValue ?? null,
      })),
    }));
  }
}

