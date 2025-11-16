import { describe, expect, it } from 'vitest';

import { createEmptyAgreement } from '../createEmptyAgreement.ts';

describe('createEmptyAgreement', () => {
  it('generates an agreement with default metadata and history', () => {
    const agreement = createEmptyAgreement({
      author: 'Admin',
      idFactory: () => 'agreement-1',
      createdAt: new Date('2024-02-02T10:00:00Z'),
    });

    expect(agreement).toMatchObject({
      id: 'agreement-1',
      slug: '',
      nome: 'Novo convênio',
      averbadora: '',
      tipo: 'MUNICIPAL',
      status: 'EM_IMPLANTACAO',
      produtos: [],
      responsavel: '',
      archived: false,
      metadata: {},
      janelas: [],
      taxas: [],
    });
    expect(agreement.history).toHaveLength(1);
    expect(agreement.history[0]).toMatchObject({
      author: 'Admin',
      message: 'Convênio criado. Complete dados básicos e tabelas.',
    });
    expect(agreement.history[0].createdAt).toEqual(new Date('2024-02-02T10:00:00Z'));
  });
});
