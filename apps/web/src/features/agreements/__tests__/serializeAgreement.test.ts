import { describe, expect, it } from 'vitest';

import { type Agreement, serializeAgreement } from '../useConvenioCatalog';

const createAgreement = (overrides: Partial<Agreement> = {}): Agreement => ({
  id: 'agreement-1',
  slug: '',
  nome: 'Banco Ótimo',
  averbadora: 'Banco Ótimo',
  tipo: 'consignado',
  status: 'draft',
  produtos: ['consignado'],
  responsavel: 'Maria',
  archived: false,
  metadata: {},
  janelas: [],
  taxas: [],
  history: [],
  ...overrides,
});

describe('serializeAgreement', () => {
  it('generates slug, products and metadata defaults when creating agreements', () => {
    const serialized = serializeAgreement(createAgreement());

    expect(serialized.slug).toBe('banco-otimo');
    expect(serialized.products).toEqual({ consignado: true });
    expect(serialized.metadata).toMatchObject({
      providerName: 'Banco Ótimo',
      responsavel: 'Maria',
      products: ['consignado'],
    });
  });

  it('preserves explicit slug and overwrites metadata defaults when provided', () => {
    const serialized = serializeAgreement(
      createAgreement({
        slug: 'custom',
        metadata: { providerName: 'Outro', products: ['antigo'] },
        averbadora: 'Novo Banco',
        responsavel: 'Joana',
        produtos: ['consignado', 'refinanciamento'],
      })
    );

    expect(serialized.slug).toBe('custom');
    expect(serialized.metadata).toMatchObject({
      providerName: 'Novo Banco',
      responsavel: 'Joana',
      products: ['consignado', 'refinanciamento'],
    });
  });
});
