import { beforeEach, describe, expect, it, vi } from 'vitest';

import { demoAgreementsSeed } from '../../../../../../config/demo-agreements';

const createPrismaMock = async () => {
  const actual = await vi.importActual<typeof import('../../../lib/prisma')>(
    '../../../lib/prisma'
  );

  const transactionMock = vi.fn().mockRejectedValue(new actual.DatabaseDisabledError());

  return {
    transactionMock,
    module: {
      ...actual,
      isDatabaseEnabled: true,
      prisma: {
        agreement: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([]),
        },
        agreementWindow: {} as never,
        agreementRate: {} as never,
        agreementHistory: {} as never,
        agreementImportJob: {
          updateMany: vi.fn(),
        } as never,
        $transaction: transactionMock,
      },
    },
  };
};

describe('AgreementsRepository - fallback mode', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.AUTH_MVP_TENANT_ID = 'tenant-id';
  });

  it('falls back to the demo store when Prisma is unavailable', async () => {
    const prismaMock = await createPrismaMock();

    vi.doMock('../../../lib/prisma', () => prismaMock.module);

    const { AgreementsRepository } = await import('../repository');
    const repository = new AgreementsRepository();

    const result = await repository.listAgreements(
      'tenant-id',
      { search: undefined, status: undefined },
      { page: 1, limit: 10 }
    );

    expect(result.total).toBe(demoAgreementsSeed.length);
    expect(result.items).toHaveLength(demoAgreementsSeed.length);
    expect(prismaMock.transactionMock).toHaveBeenCalledTimes(1);
  });
});
