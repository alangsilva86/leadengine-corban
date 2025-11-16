import { describe, expect, it, vi } from 'vitest';

import { demoAgreementsSeed } from '../../../../../../config/demo-agreements';

vi.mock('@ticketz/storage', () => ({
  ensureTicketStageSupport: vi.fn(),
  setPrismaClient: vi.fn(),
}));

const transactionError = Object.assign(new Error('storage disabled'), {
  name: 'DatabaseDisabledError',
  code: 'DATABASE_DISABLED',
});

const transactionMock = vi.fn().mockRejectedValue(transactionError);
const agreementDelegate = {
  count: vi.fn(),
  findMany: vi.fn(),
};

vi.mock('../../../lib/prisma', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/prisma')>('../../../lib/prisma');
  return {
    ...actual,
    isDatabaseEnabled: true,
    prisma: {
      $transaction: transactionMock,
      agreement: agreementDelegate,
    },
  };
});

describe('AgreementsRepository - fallback to demo catalog', () => {
  it('uses the in-memory demo store when Prisma throws storage errors', async () => {
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
      'tenant-fallback',
      { search: undefined, status: undefined },
      { page: 1, limit: 25 }
    );

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(result.total).toBe(demoAgreementsSeed.length);
    expect(result.items).toHaveLength(demoAgreementsSeed.length);
    expect(result.items.map((item) => item.slug)).toEqual(
      demoAgreementsSeed.map((agreement) => agreement.slug)
    );
      'tenant-id',
      { search: undefined, status: undefined },
      { page: 1, limit: 10 }
    );

    expect(result.total).toBe(demoAgreementsSeed.length);
    expect(result.items).toHaveLength(demoAgreementsSeed.length);
    expect(prismaMock.transactionMock).toHaveBeenCalledTimes(1);
  });
});
