import { describe, expect, it, vi } from 'vitest';

import { demoAgreementsSeed } from '../../../../../../config/demo-agreements';

const transactionMock = vi.fn();

vi.mock('../../../lib/prisma', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/prisma')>('../../../lib/prisma');
  return {
    ...actual,
    isDatabaseEnabled: false,
    prisma: { $transaction: transactionMock },
  };
});

describe('AgreementsRepository - database disabled', () => {
  it('returns the seeded demo agreements without touching the database', async () => {
    const { AgreementsRepository } = await import('../repository');
    const repository = new AgreementsRepository();

    const result = await repository.listAgreements(
      'tenant-id',
      { search: undefined, status: undefined },
      { page: 2, limit: 50 }
    );

    expect(result.page).toBe(2);
    expect(result.limit).toBe(50);
    expect(result.total).toBe(demoAgreementsSeed.length);
    expect(result.items).toHaveLength(demoAgreementsSeed.length);
    expect(result.items.map((item) => item.name)).toEqual(
      demoAgreementsSeed.map((agreement) => agreement.name)
    );
    expect(result.items.every((item) => Array.isArray(item.tables) && item.tables.length > 0)).toBe(true);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
