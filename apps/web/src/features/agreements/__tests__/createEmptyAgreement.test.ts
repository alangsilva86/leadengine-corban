import { describe, expect, it, vi } from 'vitest';

import createEmptyAgreement from '../domain/createEmptyAgreement';

describe('createEmptyAgreement', () => {
  it('generates a slug derived from the base name and the generated id', () => {
    const agreement = createEmptyAgreement({
      author: 'Autor',
      idFactory: () => 'id-fixed',
    });

    expect(agreement.slug).toBe('novo-convenio-id-fixed');
  });

  it('changes the slug every time a new id is generated', () => {
    const agreementA = createEmptyAgreement({
      author: 'Autor',
      idFactory: () => 'id-1',
    });
    const agreementB = createEmptyAgreement({
      author: 'Autor',
      idFactory: () => 'id-2',
    });

    expect(agreementA.slug).not.toBe(agreementB.slug);
  });
});
