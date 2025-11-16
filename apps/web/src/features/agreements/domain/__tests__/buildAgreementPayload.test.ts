import { describe, expect, it } from 'vitest';

import { buildAgreementPayload } from '../buildAgreementPayload.ts';
import type { Agreement } from '../../useConvenioCatalog.ts';

describe('buildAgreementPayload', () => {
  const createAgreement = (overrides: Partial<Agreement> = {}): Agreement => ({
    id: 'agreement-1',
    slug: 'agreement-1',
    nome: 'Banco Exemplo',
    averbadora: 'Banco Exemplo',
    tipo: 'MUNICIPAL',
    status: 'ATIVO',
    produtos: ['consignado'],
    responsavel: 'Maria',
    archived: false,
    metadata: {},
    janelas: [],
    taxas: [],
    history: [],
    ...overrides,
  });

  it('serializes agreements and attaches audit metadata', () => {
    const agreement = createAgreement();
    const payload = buildAgreementPayload({
      agreement,
      actor: 'Admin',
      actorRole: 'admin',
      note: 'Atualização manual',
    });

    expect(payload.data).toMatchObject({
      name: 'Banco Exemplo',
      status: 'ATIVO',
    });
    expect(payload.meta?.audit).toEqual({
      actor: 'Admin',
      actorRole: 'admin',
      note: 'Atualização manual',
    });
  });

  it('merges custom metadata while enforcing audit shape', () => {
    const agreement = createAgreement({ status: 'PAUSADO' });
    const payload = buildAgreementPayload({
      agreement,
      actor: 'Coordenador',
      actorRole: 'coordinator',
      meta: { scope: 'windows', audit: { actor: 'legacy', actorRole: 'legacy', note: 'legacy' } },
    });

    expect(payload.meta).toMatchObject({ scope: 'windows' });
    expect(payload.meta?.audit).toEqual({
      actor: 'Coordenador',
      actorRole: 'coordinator',
      note: undefined,
    });
  });
});
