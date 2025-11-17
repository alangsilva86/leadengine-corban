import { beforeEach, describe, expect, it, vi } from 'vitest';

import { demoAgreementsSeed } from '../../../../../../config/demo-agreements';

vi.mock('@ticketz/storage', () => ({
  ensureTicketStageSupport: vi.fn(),
  setPrismaClient: vi.fn(),
}));

const createPrismaMock = async () => {
  const actual = await vi.importActual<typeof import('../../../lib/prisma')>(
    '../../../lib/prisma'
  );

  return {
    transactionMock: vi.fn().mockRejectedValue(new Error('should not hit database in demo mode')),
    module: {
      ...actual,
      isDatabaseEnabled: true,
      prisma: {
        agreement: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
        agreementWindow: {} as never,
        agreementRate: {} as never,
        agreementHistory: {} as never,
        agreementImportJob: {
          create: vi.fn(),
          findFirst: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn(),
          findMany: vi.fn(),
        } as never,
        $transaction: vi.fn().mockResolvedValue([0, []]),
      },
    },
  } as const;
};

const createFailingPrismaMock = async () => {
  const actual = await vi.importActual<typeof import('../../../lib/prisma')>(
    '../../../lib/prisma'
  );

  const failingDelegate = {
    count: vi.fn().mockRejectedValue(new Error('boom')),
    findMany: vi.fn().mockRejectedValue(new Error('boom')),
  } as never;

  return {
    module: {
      ...actual,
      isDatabaseEnabled: true,
      prisma: {
        agreement: failingDelegate,
        agreementWindow: {} as never,
        agreementRate: {} as never,
        agreementHistory: {} as never,
        agreementImportJob: {} as never,
        $transaction: vi.fn().mockRejectedValue(new Error('boom')),
      },
    },
  } as const;
};

describe('AgreementsRepository storage strategy', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.AGREEMENTS_DEMO_MODE;
  });

  it('serves demo agreements when demo mode is enabled', async () => {
    const prismaMock = await createPrismaMock();
    vi.doMock('../../../lib/prisma', () => prismaMock.module);

    const { refreshAgreementsConfig } = await import('../config');
    refreshAgreementsConfig({ demoModeEnabled: true });

    const { AgreementsRepository } = await import('../repository');
    const repository = new AgreementsRepository();

    const result = await repository.listAgreements(
      'tenant-demo',
      { search: undefined, status: undefined },
      { page: 1, limit: 25 }
    );

    expect(result.total).toBe(demoAgreementsSeed.length);
    expect(result.items).toHaveLength(demoAgreementsSeed.length);
    expect(result.items.map((item) => item.slug)).toEqual(
      demoAgreementsSeed.map((agreement) => agreement.slug)
    );
  });

  it('propagates database errors when demo mode is disabled', async () => {
    const prismaMock = await createFailingPrismaMock();
    vi.doMock('../../../lib/prisma', () => prismaMock.module);

    const { refreshAgreementsConfig } = await import('../config');
    refreshAgreementsConfig({ demoModeEnabled: false });

    const { AgreementsRepository } = await import('../repository');
    const repository = new AgreementsRepository();

    await expect(
      repository.listAgreements('tenant-real', { search: undefined, status: undefined }, { page: 1, limit: 25 })
    ).rejects.toThrow('boom');
  });
});
