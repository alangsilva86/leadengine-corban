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

// Emula o Postgres em READ COMMITTED: transações rodam de fato em paralelo (cada leitura/escrita cede o event
// loop) e só o advisory lock de transação (`pg_advisory_xact_lock` via $executeRaw) as serializa, liberado ao fim
// do callback (COMMIT/ROLLBACK). O mock anterior encadeava as transações, então nunca expunha a corrida.
const createPrismaMock = () => {
  const queues: ReturnType<typeof buildQueueRecord>[] = [];
  const advisoryLocks = new Map<string, Promise<void>>();
  const yieldToOtherTransactions = () => new Promise((resolve) => setTimeout(resolve, 0));

  const transactionQueueFindFirst = vi.fn(async ({ where }: { where?: { tenantId?: string } }) => {
    await yieldToOtherTransactions();
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
    await yieldToOtherTransactions();
    const record = buildQueueRecord({
      tenantId: data.tenantId as string,
      orderIndex: data.orderIndex as number,
      name: data.name as string,
    });
    queues.push(record);
    return record;
  });

  const executeRaw = vi.fn();

  const prismaMock = {
    $transaction: vi.fn(async (callback: (tx: Prisma.TransactionClient) => unknown) => {
      const releases: Array<() => void> = [];
      const transactionClient = {
        $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
          executeRaw(strings.join('?'), ...values);
          const key = `${strings.join('?')}|${JSON.stringify(values)}`;
          const previous = advisoryLocks.get(key) ?? Promise.resolve();
          let release: () => void = () => {};
          const held = new Promise<void>((resolve) => {
            release = resolve;
          });
          advisoryLocks.set(key, previous.then(() => held));
          releases.push(release);
          await previous;
          return 1;
        },
        queue: {
          findFirst: transactionQueueFindFirst,
          create: transactionQueueCreate,
        },
      };

      try {
        return await callback(transactionClient as unknown as Prisma.TransactionClient);
      } finally {
        releases.forEach((release) => release());
      }
    }),
  } satisfies Partial<PrismaClient>;

  return { queues, prismaMock, transactionQueueCreate, transactionQueueFindFirst, executeRaw };
};

describe('QueueService', () => {
  describe('createQueue', () => {
    it('derives the next orderIndex from the max lookup inside a transaction', async () => {
      const { prismaMock, transactionQueueCreate, transactionQueueFindFirst, queues, executeRaw } = createPrismaMock();
      queues.push(buildQueueRecord({ tenantId: 'tenant-1', orderIndex: 2, name: 'Existing' }));

      const service = new QueueService(prismaMock as PrismaClient);
      const queue = await service.createQueue('tenant-1', { name: 'New Queue' });

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      // O advisory lock do tenant é tomado antes de ler o máximo.
      expect(executeRaw).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), 'tenant-1');
      expect(executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        transactionQueueFindFirst.mock.invocationCallOrder[0] ?? 0
      );
      expect(transactionQueueFindFirst).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        orderBy: { orderIndex: 'desc' },
        select: { orderIndex: true },
      });
      // 6f3dcc26 removeu `lock: { mode: 'ForUpdate' }`, que não é um argumento válido do Prisma
      // (falhava com PrismaClientValidationError em runtime).
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

      expect([first.orderIndex, second.orderIndex, third.orderIndex].sort()).toEqual([0, 1, 2]);
    });

    it('locks per tenant and skips the lock when the caller sets orderIndex', async () => {
      const { prismaMock, executeRaw } = createPrismaMock();
      const service = new QueueService(prismaMock as PrismaClient);

      const [tenantA, tenantB] = await Promise.all([
        service.createQueue('tenant-a', { name: 'Queue A' }),
        service.createQueue('tenant-b', { name: 'Queue B' }),
      ]);
      expect([tenantA.orderIndex, tenantB.orderIndex]).toEqual([0, 0]);
      expect(executeRaw.mock.calls.map((call) => call[1]).sort()).toEqual(['tenant-a', 'tenant-b']);

      const pinned = await service.createQueue('tenant-a', { name: 'Pinned', orderIndex: 10 });
      expect(pinned.orderIndex).toBe(10);
      expect(executeRaw).toHaveBeenCalledTimes(2);
    });
  });
});
