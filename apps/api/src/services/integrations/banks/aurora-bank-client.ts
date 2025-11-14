import { BankIntegrationHttpClient } from './base-client';
import type {
  BankIntegrationAgreementRaw,
  BankIntegrationRequestContext,
} from './types';

type AuroraAgreementResponse = {
  code: string;
  name: string;
  modifiedAt?: string;
  state?: string;
  pricing?: Array<{
    id: string;
    label: string;
    factor: number;
    unit?: string;
    validFrom?: string;
    validUntil?: string;
  }>;
  matrix?: Array<{
    id: string;
    productCode: string;
    term: number;
    price: number;
    minimum?: number;
    maximum?: number;
  }>;
};

type AuroraEnvelope = {
  items: AuroraAgreementResponse[];
  meta?: {
    pageNumber: number;
    totalPages?: number;
  };
};

export class AuroraBankClient extends BankIntegrationHttpClient {
  protected async fetchFromProvider(
    context: BankIntegrationRequestContext
  ): Promise<BankIntegrationAgreementRaw[]> {
    const records = await this.paginate<AuroraAgreementResponse>(
      '/agreements',
      { pagination: this.settings.pagination },
      (response, page) => {
        const envelope = this.normalize(response);
        const totalPages = envelope.meta?.totalPages ?? 0;
        const hasNext = totalPages > 0 ? page + 1 < totalPages : Boolean(envelope.items.length);
        return {
          items: envelope.items,
          hasNext,
        };
      },
      context
    );

    return records.map((item): BankIntegrationAgreementRaw => ({
      agreement: {
        id: item.code,
        name: item.name,
        updatedAt: item.modifiedAt ?? null,
        status: item.state ?? null,
      },
      rates: (item.pricing ?? []).map((rate) => ({
        id: rate.id,
        type: rate.label,
        value: rate.factor,
        unit: rate.unit ?? null,
        effectiveAt: rate.validFrom ?? null,
        expiresAt: rate.validUntil ?? null,
      })),
      tables: (item.matrix ?? []).map((table) => ({
        id: table.id,
        product: table.productCode,
        termMonths: table.term,
        coefficient: table.price,
        minValue: table.minimum ?? null,
        maxValue: table.maximum ?? null,
      })),
    }));
  }

  private normalize(payload: unknown): AuroraEnvelope {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const record = payload as Record<string, unknown>;
      return {
        items: Array.isArray(record.items) ? (record.items as AuroraAgreementResponse[]) : [],
        meta:
          record.meta && typeof record.meta === 'object'
            ? (record.meta as AuroraEnvelope['meta'])
            : undefined,
      };
    }

    if (Array.isArray(payload)) {
      return { items: payload as AuroraAgreementResponse[] };
    }

    return { items: [] };
  }
}

