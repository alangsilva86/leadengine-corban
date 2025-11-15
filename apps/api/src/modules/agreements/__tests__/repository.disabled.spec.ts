import { describe, expect, it, vi } from 'vitest';

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
  it('returns an empty result without touching the database', async () => {
    const { AgreementsRepository } = await import('../repository');
    const repository = new AgreementsRepository();

    const result = await repository.listAgreements(
      'tenant-id',
      { search: undefined, status: undefined },
      { page: 2, limit: 50 }
    );

    expect(result).toEqual({ items: [], total: 0, page: 2, limit: 50, totalPages: 0 });
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
