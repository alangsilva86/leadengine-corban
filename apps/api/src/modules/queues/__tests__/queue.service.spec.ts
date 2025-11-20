import type { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { QueueService } from '../queue.service';

const buildQueueRecord = (overrides: {
  tenantId: string;
  orderIndex: number;
  name?: string;
}) => ({
  id: `queue-${overrides.orderIndex}`,
  tenantId: overrides.tenantId,
  name: overrides.name ?? `Queue ${overrides.orderIndex}`,
  description: null,
  color: null,
  isActive: true,
  orderIndex: overrides.orderIndex,
  settings: {},
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
});

const createPrismaMock = () => {
  const queues: ReturnType<typeof buildQueueRecord>[] = [];
  let transactionChain = Promise.resolve<unknown>(null);

  const transactionQueueFindFirst = vi.fn(async ({ where }: { where?: { tenantId?: string } }) => {
    const tenantQueues = queues.filter((queue) => queue.tenantId === where?.tenantId);
    if (tenantQueues.length === 0) {
      return null;
    }

    const highestOrderQueue = tenantQueues.reduce((prev, current) =>
      current.orderIndex > prev.orderIndex ? current : prev
    );

    return { orderIndex: highestOrderQueue.orderIndex } satisfies { orderIndex: number };
  });

  const transactionQueueCreate = vi.fn(async ({ data }: Prisma.QueueCreateArgs) => {
    const record = buildQueueRecord({
      tenantId: data.tenantId as string,
      orderIndex: data.orderIndex as number,
      name: data.name as string,
    });
    queues.push(record);
    return record;
  });

  const transactionClient = {
    queue: {
      findFirst: transactionQueueFindFirst,
      create: transactionQueueCreate,
    },
  } satisfies Partial<Prisma.TransactionClient>;

  const prismaMock = {
    $transaction: vi.fn(async (callback: (tx: Prisma.TransactionClient) => unknown) => {
      transactionChain = transactionChain.then(() => callback(transactionClient as Prisma.TransactionClient));
      return transactionChain;
    }),
  } satisfies Partial<PrismaClient>;

  return { queues, prismaMock, transactionQueueCreate, transactionQueueFindFirst };
};

describe('QueueService', () => {
  describe('createQueue', () => {
    it('derives the next orderIndex in a transaction with a locked max lookup', async () => {
      const { prismaMock, transactionQueueCreate, transactionQueueFindFirst, queues } = createPrismaMock();
      queues.push(buildQueueRecord({ tenantId: 'tenant-1', orderIndex: 2, name: 'Existing' }));

      const service = new QueueService(prismaMock as PrismaClient);
      const queue = await service.createQueue('tenant-1', { name: 'New Queue' });

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(transactionQueueFindFirst).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        orderBy: { orderIndex: 'desc' },
        select: { orderIndex: true },
        lock: { mode: 'ForUpdate' },
      });
      expect(transactionQueueCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ tenantId: 'tenant-1', orderIndex: 3 }),
        select: expect.objectContaining({ id: true, orderIndex: true }),
      });
      expect(queue.orderIndex).toBe(3);
    });

    it('assigns sequential orderIndex values when creating concurrently', async () => {
      const { prismaMock } = createPrismaMock();
      const service = new QueueService(prismaMock as PrismaClient);

      const [first, second, third] = await Promise.all([
        service.createQueue('tenant-1', { name: 'Queue A' }),
        service.createQueue('tenant-1', { name: 'Queue B' }),
        service.createQueue('tenant-1', { name: 'Queue C' }),
      ]);

      expect([first.orderIndex, second.orderIndex, third.orderIndex]).toEqual([0, 1, 2]);
    });
  });
});
