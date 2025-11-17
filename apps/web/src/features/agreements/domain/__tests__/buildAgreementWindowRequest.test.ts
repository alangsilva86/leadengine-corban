import { describe, expect, it } from 'vitest';
import { buildAgreementWindowRequest } from '../buildAgreementWindowRequest.ts';

const baseWindow = {
  id: 'window-1',
  label: 'Janeiro',
  start: new Date('2024-01-01T00:00:00Z'),
  end: new Date('2024-01-31T00:00:00Z'),
  firstDueDate: new Date('2024-02-05T00:00:00Z'),
};

describe('buildAgreementWindowRequest', () => {
  it('creates request envelope with audit metadata', () => {
    const request = buildAgreementWindowRequest({
      window: baseWindow,
      actor: 'Admin',
      actorRole: 'admin',
      note: 'Criou janela',
    });

    expect(request.data).toMatchObject({
      id: 'window-1',
      label: 'Janeiro',
      startsAt: '2024-01-01T00:00:00.000Z',
      endsAt: '2024-01-31T00:00:00.000Z',
      metadata: { firstDueDate: '2024-02-05T00:00:00.000Z' },
    });
    expect(request.meta?.audit).toEqual({ actor: 'Admin', actorRole: 'admin', note: 'Criou janela' });
  });

  it('preserves custom metadata while overriding audit', () => {
    const request = buildAgreementWindowRequest({
      window: baseWindow,
      actor: 'User',
      actorRole: 'seller',
      note: 'Atualizou janela',
      meta: { scope: 'windows', audit: { actor: 'legacy', actorRole: 'legacy', note: 'legacy' } },
    });

    expect(request.meta).toMatchObject({ scope: 'windows' });
    expect(request.meta?.audit).toEqual({ actor: 'User', actorRole: 'seller', note: 'Atualizou janela' });
  });
});
