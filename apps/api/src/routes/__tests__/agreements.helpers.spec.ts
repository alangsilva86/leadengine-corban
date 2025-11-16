import { describe, expect, it } from 'vitest';

import { translateLegacyAgreementFields } from '@ticketz/shared';

describe('agreements helpers', () => {
  it('translates legacy payloads filling slug, products and metadata defaults', () => {
    const payload = translateLegacyAgreementFields({
      nome: 'Banco Ótimo',
      tipo: 'consignado',
      produtos: ['consignado', 'refinanciamento'],
      averbadora: 'Banco Ótimo',
      responsavel: 'Maria',
    });

    expect(payload).toMatchObject({
      name: 'Banco Ótimo',
      slug: 'banco-otimo',
      type: 'consignado',
      products: {
        consignado: true,
        refinanciamento: true,
      },
      metadata: {
        providerName: 'Banco Ótimo',
        responsavel: 'Maria',
        products: ['consignado', 'refinanciamento'],
      },
    });
  });

  it('keeps existing slug and metadata values when already present', () => {
    const payload = translateLegacyAgreementFields({
      name: 'Convênio',
      slug: 'custom-slug',
      metadata: { providerName: 'Outro' },
      responsavel: 'Maria',
      averbadora: 'Banco Ótimo',
    });

    expect(payload.slug).toBe('custom-slug');
    expect(payload.metadata).toEqual({ providerName: 'Outro', responsavel: 'Maria' });
  });
});
