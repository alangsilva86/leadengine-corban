import { Prisma } from '@prisma/client';

import { prisma as defaultPrisma } from '../../lib/prisma';
import type {
  QueueEntity,
  QueueInput,
  QueueReorderItem,
  QueueReorderResult,
  QueueUpdateInput,
} from './queue.types';

const queueSelect = {
  id: true,
  tenantId: true,
  name: true,
  description: true,
  color: true,
  isActive: true,
  orderIndex: true,
  settings: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class QueueService {
  constructor(private readonly prisma = defaultPrisma) {}

  async listQueues(tenantId: string): Promise<QueueEntity[]> {
    return this.prisma.queue.findMany({
      where: { tenantId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      select: queueSelect,
    });
  }

  async createQueue(tenantId: string, input: QueueInput): Promise<QueueEntity> {
    return this.prisma.$transaction(async (tx) => {
      const nextOrderIndex =
        typeof input.orderIndex === 'number'
          ? input.orderIndex
          : await this.getNextOrderIndex(tx, tenantId);

      return tx.queue.create({
        data: {
          tenantId,
          name: input.name,
          ...(input.description !== undefined ? { description: input.description ?? null } : {}),
          ...(input.color !== undefined ? { color: input.color ?? null } : {}),
          isActive: typeof input.isActive === 'boolean' ? input.isActive : true,
          orderIndex: nextOrderIndex,
          ...(input.settings !== undefined
            ? {
                settings:
                  typeof input.settings === 'object' && input.settings !== null
                    ? (input.settings as Prisma.JsonObject)
                    : {},
              }
            : {}),
        },
        select: queueSelect,
      });
    });
  }

  private async getNextOrderIndex(
    tx: Prisma.TransactionClient,
    tenantId: string
  ): Promise<number> {
    const lastQueue = await tx.queue.findFirst({
      where: { tenantId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    return (lastQueue?.orderIndex ?? -1) + 1;
  }

  async updateQueue(tenantId: string, queueId: string, updates: QueueUpdateInput): Promise<QueueEntity | null> {
    const data: Prisma.QueueUpdateManyMutationInput = { ...updates } as Prisma.QueueUpdateManyMutationInput;

    if ('settings' in updates) {
      const settings = updates.settings;
      if (settings === null) {
        (data as any).settings = Prisma.JsonNull;
      } else if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
        (data as any).settings = settings as Prisma.InputJsonValue;
      }
    }

    const updatedCount = await this.prisma.queue.updateMany({
      where: { id: queueId, tenantId },
      data,
    });

    if (updatedCount.count === 0) {
      return null;
    }

    return this.prisma.queue.findUnique({
      where: { id: queueId },
      select: queueSelect,
    });
  }

  async reorderQueues(
    tenantId: string,
    items: QueueReorderItem[],
    includeItems = true
  ): Promise<QueueReorderResult> {
    const queueIds = await this.prisma.queue.findMany({
      where: { tenantId, id: { in: items.map((item) => item.id) } },
      select: { id: true },
    });

    const allowedIds = new Set(queueIds.map((item) => item.id));
    const updates = items.filter((item) => allowedIds.has(item.id));

    if (updates.length === 0) {
      return { updated: false };
    }

    await this.prisma.$transaction(
      updates.map((item) =>
        this.prisma.queue.updateMany({
          where: { id: item.id, tenantId },
          data: { orderIndex: item.orderIndex },
        })
      )
    );

    if (!includeItems) {
      return { updated: true };
    }

    const queues = await this.listQueues(tenantId);
    return { updated: true, queues };
  }

  async deleteQueue(tenantId: string, queueId: string): Promise<boolean> {
    const deleted = await this.prisma.queue.deleteMany({
      where: { id: queueId, tenantId },
    });

    return deleted.count > 0;
  }
}
